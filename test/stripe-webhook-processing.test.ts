import type Stripe from "stripe";
import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { payments, registrations, stripeWebhookEvents, trainingGroups } from "@/db/schema";
import { databaseHarness, NOW, FUTURE, sqlQuery } from "./database-harness";
const h = databaseHarness();
let processEvent: typeof import("@/lib/process-stripe-webhook-event").processStripeWebhookEvent;
const payment = { paymentId: 2, registrationId: 1, trainingGroupId: 3, playerId: 4, reservationExpiresAt: FUTURE, paymentStatus: "pending", registrationStatus: "pending_payment", totalCents: 11300, currency: "CAD", startsOn: "2026-10-01", endsOn: "2026-12-31" };
const session = { id: "cs_fixture", object: "checkout.session", mode: "payment", status: "complete", payment_status: "paid", client_reference_id: "1", amount_total: 11300, currency: "cad", metadata: { registrationId: "1", paymentId: "2" }, payment_intent: "pi_fixture" };
function event(type = "checkout.session.completed", change: object = {}) { return { id: "evt_fixture", type, livemode: false, data: { object: { ...session, ...change } } } as unknown as Stripe.Event; }
function initial(change: object = {}) { h.read(stripeWebhookEvents, { id: 9, processingStatus: "received" }); h.read(payments, { ...payment, ...change }); }
beforeAll(async () => { jest.doMock("@/db", () => ({ db: h.db })); ({ processStripeWebhookEvent: processEvent } = await import("@/lib/process-stripe-webhook-event")); });
beforeEach(() => h.reset());
describe("verified Stripe event processor", () => {
  it("does not overfill a group when paid confirmation arrives after reservation expiry", async () => {
    initial({ reservationExpiresAt: NOW, registrationStatus: "expired" }); h.read(trainingGroups, { capacity: 2 }); h.read(registrations, { occupiedSpots: 2 }); h.read(stripeWebhookEvents, { id: 9, processingStatus: "received" });
    await expect(processEvent(event(), NOW)).rejects.toThrow("capacity"); expect(h.writes(payments)).toEqual([]); expect(h.writes(registrations)).toEqual([]); expect(h.queries(trainingGroups)[0].lock).toBe("update");
  });
  it("reclaims an expired reservation only while group capacity is locked and available", async () => {
    initial({ reservationExpiresAt: NOW, registrationStatus: "expired" }); h.read(trainingGroups, { capacity: 2 }); h.read(registrations, { occupiedSpots: 1 });
    expect(await processEvent(event(), NOW)).toMatchObject({ action: "payment-confirmed" }); expect(h.queries(trainingGroups)[0].lock).toBe("update"); expect(sqlQuery(h.queries(registrations)[0]).params).toEqual(expect.arrayContaining([3, 4, "2026-10-01", "2026-12-31", "pending_payment"]));
  });
  it.each(["checkout.session.expired", "checkout.session.async_payment_failed"])("does not cancel mismatched amounts in %s", async type => { initial(); expect(await processEvent(event(type, { amount_total: 1 }), NOW)).toMatchObject({ action: "ignored" }); expect(h.writes(payments)).toEqual([]); expect(h.writes(registrations)).toEqual([]); });
  it.each(["checkout.session.completed", "checkout.session.async_payment_succeeded"])("confirms %s in one locked transaction", async type => {
    initial(); expect(await processEvent(event(type), NOW)).toEqual({ status: "processed", action: "payment-confirmed" });
    expect(h.queries(stripeWebhookEvents)[0].lock).toBe("update"); expect(h.queries(payments)[0].lock).toBe("update");
    expect(sqlQuery(h.queries(payments)[0]).params).toEqual([2, 1, 1, "stripe", "cs_fixture"]);
    expect(h.writes(payments)[0].values).toEqual({ status: "succeeded", stripePaymentIntentId: "pi_fixture", paidAt: NOW });
    expect(h.writes(registrations)[0].values).toEqual({ status: "scheduled", activatedAt: null });
    expect(h.writes().at(-1)?.values).toMatchObject({ processingStatus: "processed", processedAt: NOW, lastError: null }); expect(h.operations.at(-1)?.kind).toBe("commit");
  });
  it.each([["2026-09-01", "2026-09-30", "active"], ["2026-08-01", "2026-08-31", "expired"]])("maps paid dates %s to %s", async (startsOn, endsOn, status) => { initial({ startsOn, endsOn }); await processEvent(event(), NOW); expect(h.writes(registrations)[0].values).toEqual({ status, activatedAt: status === "active" ? NOW : null }); });
  it.each([["checkout.session.expired", "cancelled", "payment-cancelled"], ["checkout.session.async_payment_failed", "failed", "payment-failed"]])("handles %s without refund logic", async (type, status, action) => { initial(); expect(await processEvent(event(type), NOW)).toEqual({ status: "processed", action }); expect(h.writes(payments)[0].values).toEqual({ status }); expect(h.writes(registrations)[0].values).toEqual({ status: "cancelled", cancelledAt: NOW }); });
  it("ignores duplicate delivery before payment lookup or mutation", async () => { h.read(stripeWebhookEvents, { id: 9, processingStatus: "processed" }); expect(await processEvent(event(), NOW)).toEqual({ status: "duplicate" }); expect(h.queries(payments)).toEqual([]); expect(h.writes(payments)).toEqual([]); });
  it("does not apply the payment twice across distinct event IDs", async () => { initial({ paymentStatus: "succeeded", registrationStatus: "active" }); expect(await processEvent(event(), NOW)).toMatchObject({ action: "payment-confirmed" }); expect(h.writes(payments)).toEqual([]); expect(h.writes(registrations)).toEqual([]); });
  it.each(["customer.created", "payment_intent.succeeded"])("safely records unsupported %s", async type => { h.read(stripeWebhookEvents, { id: 9, processingStatus: "received" }); expect(await processEvent(event(type), NOW)).toMatchObject({ action: "ignored" }); expect(h.queries(payments)).toEqual([]); });
  it.each([{ metadata: null }, { metadata: { registrationId: "01", paymentId: "2" } }, { metadata: { registrationId: "1", paymentId: "4294967296" } }, { payment_intent: "bad" }, { object: "customer" }])("ignores malformed identifiers/object %p", async change => { h.read(stripeWebhookEvents, { id: 9, processingStatus: "received" }); expect(await processEvent(event(undefined, change), NOW)).toMatchObject({ action: "ignored" }); expect(h.queries(payments)).toEqual([]); });
  it.each([{ amount_total: 1 }, { currency: "usd" }, { client_reference_id: "7" }, { mode: "subscription" }, { status: "open" }, { payment_status: "unpaid" }])("does not confirm mismatched checkout %p", async change => { initial(); expect(await processEvent(event(undefined, change), NOW)).toMatchObject({ action: "ignored" }); expect(h.writes(payments)).toEqual([]); expect(h.writes(registrations)).toEqual([]); });
  it.each([{ registrationStatus: "cancelled" }, { paymentStatus: "failed" }, { startsOn: null }])("does not confirm unsafe stored state %p", async change => { initial(change); expect(await processEvent(event(), NOW)).toMatchObject({ action: "ignored" }); expect(h.writes(payments)).toEqual([]); });
  it("ignores unmatched payment relationship/session", async () => { h.read(stripeWebhookEvents, { id: 9, processingStatus: "received" }); h.read(payments); expect(await processEvent(event(), NOW)).toMatchObject({ action: "ignored" }); expect(h.writes(payments)).toEqual([]); });
  it.each([2, 3, 4])("rolls back concurrent mutation failure at write %i and records sanitized failure separately", async index => {
    initial(); h.read(stripeWebhookEvents, { id: 9, processingStatus: "received" }); h.results.push(...Array.from({ length: index }, () => ({ insertId: 9, affectedRows: 1 })), { affectedRows: 0 });
    await expect(processEvent(event(), NOW)).rejects.toThrow(/could not/);
    expect(h.operations.some(op => op.kind === "rollback")).toBe(true); expect(h.committed.filter(op => op.table === payments || op.table === registrations)).toEqual([]);
    expect(h.writes(stripeWebhookEvents).at(-1)?.values).toMatchObject({ processingStatus: "failed", lastError: "Webhook processing failed: Error" });
  });
  it.each(["", "x".repeat(256)])("rejects invalid event envelope", async id => { await expect(processEvent({ ...event(), id }, NOW)).rejects.toThrow(TypeError); expect(h.db.transaction).not.toHaveBeenCalled(); });
  it("rejects invalid processing date", async () => { await expect(processEvent(event(), new Date("invalid"))).rejects.toThrow(TypeError); expect(h.db.transaction).not.toHaveBeenCalled(); });
});

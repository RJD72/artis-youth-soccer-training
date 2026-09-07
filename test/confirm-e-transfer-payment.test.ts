import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { payments, registrations, trainingGroups } from "@/db/schema";
import { databaseHarness, NOW, FUTURE, sqlQuery } from "./database-harness";

const h = databaseHarness();
const admin = jest.fn<() => Promise<unknown>>();
let confirm: typeof import("@/lib/confirm-e-transfer-payment").confirmETransferPayment;
const payment = { paymentId: 2, registrationId: 1, trainingGroupId: 3, paymentStatus: "pending", registrationStatus: "pending_payment", startsOn: "2026-10-01", endsOn: "2026-12-31", reservationExpiresAt: FUTURE };
beforeAll(async () => {
  jest.doMock("@/db", () => ({ db: h.db }));
  jest.doMock("@/lib/admin-auth", () => ({ requireAdminSession: admin }));
  ({ confirmETransferPayment: confirm } = await import("@/lib/confirm-e-transfer-payment"));
});
beforeEach(() => { h.reset(); admin.mockResolvedValue({}); });
describe("manual e-transfer confirmation", () => {
  it("authenticates before input validation or queries", async () => {
    admin.mockRejectedValue(new Error("Unauthorized"));
    await expect(confirm(0, 0, NOW)).rejects.toThrow("Unauthorized");
    expect(h.db.transaction).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5, "bad", null, undefined, 4294967296])("rejects invalid ID %p", async id => {
    expect(await confirm(id, 2, NOW)).toEqual({ status: "rejected", code: "invalid-identifiers" });
    expect(h.db.transaction).not.toHaveBeenCalled();
  });
  it("constrains the payment relationship and method in SQL", async () => {
    h.read(payments);
    expect(await confirm("1", "2", NOW)).toEqual({ status: "rejected", code: "payment-not-found" });
    expect(sqlQuery(h.queries(payments)[0]).params).toEqual([2, 1, 1, "e_transfer"]);
    expect(h.queries(payments)[0].lock).toBe("update");
    expect(h.writes()).toEqual([]);
  });
  it.each(["scheduled", "active", "expired"])("is idempotent for paid %s registrations", async status => {
    h.read(payments, { ...payment, paymentStatus: "succeeded", registrationStatus: status });
    expect(await confirm(1, 2, NOW)).toEqual({ status: "already-confirmed", registrationStatus: status });
    expect(h.writes()).toEqual([]);
  });
  it.each([
    [{ paymentStatus: "failed" }, "payment-already-resolved"],
    [{ registrationStatus: "cancelled" }, "registration-not-confirmable"],
    [{ registrationStatus: "active" }, "registration-not-confirmable"],
    [{ startsOn: null }, "registration-period-invalid"],
    [{ endsOn: "2026-08-31" }, "registration-period-ended"],
  ])("rejects unsafe state %p", async (change, code) => {
    h.read(payments, { ...payment, ...(change as object) });
    expect(await confirm(1, 2, NOW)).toEqual({ status: "rejected", code });
    expect(h.writes()).toEqual([]);
  });
  it.each([["2026-10-01", "scheduled"], ["2026-09-01", "active"]])("confirms %s with correct activation timestamp", async (startsOn, status) => {
    h.read(payments, { ...payment, startsOn });
    expect(await confirm(1, 2, NOW)).toEqual({ status: "confirmed", registrationStatus: status });
    expect(h.writes().map(op => op.table)).toEqual([payments, registrations]);
    expect(h.writes(payments)[0].values).toEqual({ status: "succeeded", paidAt: NOW });
    expect(h.writes(registrations)[0].values).toEqual({ status, activatedAt: status === "active" ? NOW : null });
    expect(h.operations.at(-1)?.kind).toBe("commit");
  });
  it.each([0, 1, 2])("rechecks expired reservation capacity: %i occupied", async occupiedSpots => {
    h.read(payments, { ...payment, registrationStatus: "expired", reservationExpiresAt: NOW });
    h.read(trainingGroups, { capacity: 2 }); h.read(registrations, { occupiedSpots });
    const result = await confirm(1, 2, NOW);
    expect(result).toEqual(occupiedSpots < 2 ? { status: "confirmed", registrationStatus: "scheduled" } : { status: "rejected", code: "training-group-full" });
    expect(h.queries(trainingGroups)[0].lock).toBe("update");
    const query = sqlQuery(h.queries(registrations)[0]);
    expect(query.params).toEqual(expect.arrayContaining([3, 1, "2026-12-31", "2026-10-01", "active", "scheduled", "pending_payment"]));
    expect(query.sql).toContain("reservation_expires_at");
  });
  it("rejects a missing group after reservation expiry", async () => {
    h.read(payments, { ...payment, reservationExpiresAt: null }); h.read(trainingGroups);
    expect(await confirm(1, 2, NOW)).toEqual({ status: "rejected", code: "training-group-unavailable" });
  });
  it.each([0, 1])("propagates concurrent write failure at update %i for rollback", async index => {
    h.read(payments, payment);
    h.results.push(...Array.from({ length: index }, () => ({ affectedRows: 1 })), { affectedRows: 0 });
    await expect(confirm(1, 2, NOW)).rejects.toThrow(/could not be confirmed/);
    expect(h.committed).toEqual([]); expect(h.operations.at(-1)?.kind).toBe("rollback");
  });
  it("rejects invalid dates before opening a transaction", async () => {
    await expect(confirm(1, 2, new Date("invalid"))).rejects.toThrow(TypeError);
    expect(h.db.transaction).not.toHaveBeenCalled();
  });
});

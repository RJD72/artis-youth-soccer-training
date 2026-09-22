import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { registrations } from "@/db/schema";
import { databaseHarness, NOW, FUTURE, sqlQuery } from "./database-harness";
type Delivery = { from: string; to: string; replyTo?: string; subject: string; react: ReactElement; text: string };
type DeliveryOptions = { idempotencyKey?: string };
const send = jest.fn<(message: Delivery, options?: DeliveryOptions) => Promise<unknown>>(); const h = databaseHarness();
let contact: typeof import("@/lib/send-contact-message-email").sendContactMessageEmail;
let confirm: typeof import("@/lib/send-e-transfer-payment-confirmation-email").sendETransferPaymentConfirmationEmail;
let update: typeof import("@/lib/send-registration-admin-update-email").sendRegistrationAdminUpdateEmail;
let pending: typeof import("@/lib/send-e-transfer-pending-notification-email").sendETransferPendingNotificationEmail;
let paid: typeof import("@/lib/send-stripe-paid-registration-notification-email").sendStripePaidRegistrationNotificationEmail;
const token = "a".repeat(43);
const family = { guardianName: " Test   Guardian ", guardianEmail: " GUARDIAN@EXAMPLE.COM ", playerName: "Test Player" };
const confirmation = { ...family, registrationId: 1, trainingGroupName: "Development", programPackageName: "Three months", amountCents: 11300, currency: "cad", paymentReference: "artis-2", paidAt: NOW, startsOn: "2026-10-01", endsOn: "2026-12-31", registrationStatus: "scheduled" as const };
const pendingRecord = { ...confirmation, guardianPhone: "519-555-0123", reservationExpiresAt: FUTURE };
const paidNotification = { ...family, guardianPhone: "519-555-0123", registrationId: 1, trainingGroupName: "Development", programPackageName: "Three months", amountCents: 11300, currency: "cad", startsOn: "2026-10-01", endsOn: "2026-12-31" };
beforeAll(async () => {
  jest.doMock("resend", () => ({ Resend: class { emails = { send }; } })); jest.doMock("@/db", () => ({ db: h.db }));
  ({ sendContactMessageEmail: contact } = await import("@/lib/send-contact-message-email")); ({ sendETransferPaymentConfirmationEmail: confirm } = await import("@/lib/send-e-transfer-payment-confirmation-email")); ({ sendRegistrationAdminUpdateEmail: update } = await import("@/lib/send-registration-admin-update-email")); ({ sendETransferPendingNotificationEmail: pending } = await import("@/lib/send-e-transfer-pending-notification-email")); ({ sendStripePaidRegistrationNotificationEmail: paid } = await import("@/lib/send-stripe-paid-registration-notification-email"));
});
beforeEach(() => { h.reset(); send.mockReset().mockResolvedValue({ data: { id: "synthetic" }, error: null }); jest.useFakeTimers().setSystemTime(NOW); jest.replaceProperty(process, "env", { ...process.env, RESEND_API_KEY: "re_synthetic_key_never_sent", RESEND_FROM_EMAIL: "ARTIS <noreply@example.com>", RESEND_TEST_RECIPIENT: "", CONTACT_FORM_RECIPIENT_EMAIL: "contact@example.com", E_TRANSFER_NOTIFICATION_EMAIL: "academy@example.com", STRIPE_REGISTRATION_NOTIFICATION_EMAIL: "academy@example.com", NEXT_PUBLIC_SITE_URL: "https://academy.example" }); jest.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
const cases = [
  { name: "contact", call: () => contact({ senderName: " Test   Visitor ", senderEmail: " VISITOR@EXAMPLE.COM ", enquiryType: "Training", message: "Synthetic training enquiry.", submittedAt: NOW }), subject: "ARTIS website enquiry: Training", to: "contact@example.com", replyTo: "visitor@example.com", text: "Synthetic training enquiry." },
  { name: "payment confirmation", call: () => confirm(confirmation), subject: "Your ARTIS Soccer Academy payment confirmation", to: "guardian@example.com", text: "ARTIS-2" },
  { name: "cancellation", call: () => update({ ...confirmation, updateType: "cancelled" }), subject: "Your ARTIS Soccer Academy registration was cancelled", to: "guardian@example.com", text: "place has been released" },
  { name: "rescheduling", call: () => update({ ...confirmation, updateType: "rescheduled" }), subject: "Your ARTIS Soccer Academy training dates were updated", to: "guardian@example.com", text: "recorded payment have not changed" },
  { name: "pending e-transfer", call: () => { h.read(registrations, pendingRecord); return pending(1, 2); }, subject: "New e-transfer registration awaiting payment: ARTIS-2", to: "academy@example.com", replyTo: "guardian@example.com", text: "does not confirm that payment was received" },
  { name: "paid Stripe registration", call: () => paid(paidNotification), subject: "New paid Stripe registration: Test Player", to: "academy@example.com", replyTo: "guardian@example.com", text: "Credit card / Stripe" },
];
describe.each(cases)("$name sender and template", entry => {
  it("sets sender, recipient, subject and optional reply-to and renders essential content", async () => {
    await entry.call(); expect(send).toHaveBeenCalledTimes(1); const message = send.mock.calls[0][0];
    expect(message).toMatchObject({ from: "ARTIS <noreply@example.com>", to: entry.to, subject: entry.subject }); expect(message.replyTo).toBe(entry.replyTo); expect(message.text).toContain(entry.text);
    const html = renderToStaticMarkup(message.react); expect(html).toContain("ARTIS"); expect(html).not.toContain("undefined"); expect(html).toMatch(/<h[12]/);
    if (entry.name.includes("transfer") || entry.name === "payment confirmation") { expect(message.text).toContain("ARTIS-2"); expect(message.text).toContain("113.00"); expect(html).toContain("ARTIS-2"); }
    if (entry.name === "paid Stripe registration") { for (const value of ["Test Player", "Test Guardian", "guardian@example.com", "519-555-0123", "Development", "Three months", "113.00", "Oct 1, 2026", "Dec 31, 2026", "Registration number: 1", "Paid", "Credit card / Stripe"]) expect(message.text).toContain(value); expect(html).toContain("PAYMENT STATUS"); expect(html).toContain("Paid"); expect(send.mock.calls[0][1]).toEqual({ idempotencyKey: "stripe-paid-registration-notification/1" }); }
  });
  it("routes to the test recipient outside production", async () => { process.env.RESEND_TEST_RECIPIENT = " TEST@EXAMPLE.COM "; await entry.call(); expect(send.mock.calls[0][0].to).toBe("test@example.com"); });
  it("ignores test-recipient override in production", async () => { jest.replaceProperty(process, "env", { ...process.env, NODE_ENV: "production", RESEND_TEST_RECIPIENT: "test@example.com" }); await entry.call(); expect(send.mock.calls[0][0].to).toBe(entry.to); });
  it.each(["rejection", "exception"])("handles provider %s with sanitized logging and safe error", async failure => {
    const error = { name: "SyntheticProviderError", statusCode: 429, message: `guardian@example.com ${token} private-payload`, response: "private-response" };
    if (failure === "rejection") send.mockResolvedValue({ error }); else send.mockRejectedValue(error);
    await expect(entry.call()).rejects.toThrow(/could not be sent/); const logged = JSON.stringify(jest.mocked(console.error).mock.calls); expect(logged).toContain("SyntheticProviderError"); expect(logged).toContain("429"); for (const secret of ["guardian@example.com", token, "private-payload", "private-response"]) expect(logged).not.toContain(secret);
  });
});
describe("email validation", () => {
  it.each([{ amountCents: 0 }, { amountCents: 1.5 }, { currency: "bad-currency" }, { startsOn: "2026-02-30" }, { endsOn: "2026-09-01" }, { paymentReference: "bad reference" }, { registrationId: 0 }, { paidAt: new Date("invalid") }])("rejects unsafe confirmation values %p", async change => { await expect(confirm({ ...confirmation, ...change })).rejects.toThrow(TypeError); expect(send).not.toHaveBeenCalled(); });
  it("escapes untrusted text in rendered HTML", async () => { await contact({ senderName: "Test Visitor", senderEmail: "visitor@example.com", enquiryType: "Training", message: "<script>alert('synthetic')</script>", submittedAt: NOW }); const message = send.mock.calls[0][0]; const html = renderToStaticMarkup(message.react); expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;"); expect(message.text).toContain("<script>"); });
  it("requires pending e-transfer relationship and reference before notifying", async () => { h.read(registrations); await expect(pending(1, 2)).rejects.toThrow("could not be found"); expect(sqlQuery(h.queries(registrations)[0]).params).toEqual([1, "pending_payment", "pending", "e_transfer"]); expect(send).not.toHaveBeenCalled(); });
  it("uses contact recipient fallback for internal notification", async () => { delete process.env.E_TRANSFER_NOTIFICATION_EMAIL; h.read(registrations, pendingRecord); await pending(1, 2); expect(send.mock.calls[0][0].to).toBe("contact@example.com"); });
  it.each([{ registrationId: 0 }, { amountCents: 0 }, { amountCents: 1.5 }, { currency: "bad-currency" }, { guardianPhone: "bad" }, { startsOn: "2026-02-30" }, { endsOn: "2026-09-01" }])("rejects unsafe Stripe notification values %p", async change => { await expect(paid({ ...paidNotification, ...change })).rejects.toThrow(TypeError); expect(send).not.toHaveBeenCalled(); });
});
describe("Stripe notification recipient fallback", () => {
  it("prefers the Stripe-specific recipient", async () => { await paid(paidNotification); expect(send.mock.calls[0][0].to).toBe("academy@example.com"); });
  it("falls back to the e-transfer recipient", async () => { delete process.env.STRIPE_REGISTRATION_NOTIFICATION_EMAIL; process.env.E_TRANSFER_NOTIFICATION_EMAIL = "fallback@example.com"; await paid(paidNotification); expect(send.mock.calls[0][0].to).toBe("fallback@example.com"); });
  it("falls back to the contact recipient", async () => { delete process.env.STRIPE_REGISTRATION_NOTIFICATION_EMAIL; delete process.env.E_TRANSFER_NOTIFICATION_EMAIL; await paid(paidNotification); expect(send.mock.calls[0][0].to).toBe("contact@example.com"); });
  it("fails safely when no academy recipient is configured", async () => { delete process.env.STRIPE_REGISTRATION_NOTIFICATION_EMAIL; delete process.env.E_TRANSFER_NOTIFICATION_EMAIL; delete process.env.CONTACT_FORM_RECIPIENT_EMAIL; await expect(paid(paidNotification)).rejects.toThrow("could not be sent"); expect(send).not.toHaveBeenCalled(); });
});

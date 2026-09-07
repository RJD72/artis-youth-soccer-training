import { describe, expect, it } from "@jest/globals";

describe("default external service isolation", () => {
  it("refuses an unmocked database import", async () => {
    await expect(import("@/db")).rejects.toThrow("explicitly mock the database");
  });
  it("refuses an unmocked authentication import", async () => {
    await expect(import("@/lib/auth")).rejects.toThrow("explicitly mock the authentication");
  });
  it("refuses an unmocked Stripe client", async () => {
    const { getStripeClient } = await import("@/lib/stripe");
    expect(() => getStripeClient()).toThrow("explicitly mock the Stripe");
  });
  it("refuses an unmocked email send", async () => {
    const { Resend } = await import("resend");
    expect(() => new Resend("synthetic-key").emails.send({
      from: "sender@example.com", to: "recipient@example.com", subject: "Synthetic", text: "Test",
    })).toThrow("explicitly mock the Resend");
  });
});

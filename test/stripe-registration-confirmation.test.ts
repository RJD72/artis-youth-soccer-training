import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import { payments } from "@/db/schema";
import { databaseHarness, NOW } from "./database-harness";

import type { StripeRegistrationConfirmation } from "@/lib/send-stripe-registration-confirmation-email";
import type { StripePaidRegistrationNotification } from "@/lib/send-stripe-paid-registration-notification-email";

const h = databaseHarness();

const sendConfirmation =
  jest.fn<(confirmation: StripeRegistrationConfirmation) => Promise<void>>();
const sendAcademyNotification =
  jest.fn<(notification: StripePaidRegistrationNotification) => Promise<void>>();

let sendConfirmedStripeRegistrationEmail: typeof import("@/lib/send-confirmed-stripe-registration-email").sendConfirmedStripeRegistrationEmail;

const confirmedRegistration = {
  paymentId: 2,
  confirmationSentAt: null,
  registrationId: 1,
  registrationStatus: "scheduled",
  startsOn: "2026-10-01",
  endsOn: "2026-10-31",
  guardianName: "Test Guardian",
  guardianEmail: "guardian@example.com",
  guardianPhone: "519-555-0123",
  playerName: "Test Player",
  trainingGroupName: "Ages 8–10",
  programPackageName: "1 Month",
  amountCents: 11_300,
  currency: "CAD",
};

beforeAll(async () => {
  jest.doMock("@/db", () => ({
    db: h.db,
  }));

  jest.doMock("@/lib/send-stripe-registration-confirmation-email", () => ({
    sendStripeRegistrationConfirmationEmail: sendConfirmation,
  }));

  jest.doMock(
    "@/lib/send-stripe-paid-registration-notification-email",
    () => ({
      sendStripePaidRegistrationNotificationEmail: sendAcademyNotification,
    }),
  );

  ({ sendConfirmedStripeRegistrationEmail } =
    await import("@/lib/send-confirmed-stripe-registration-email"));
});

beforeEach(() => {
  h.reset();
  sendConfirmation.mockReset();
  sendConfirmation.mockResolvedValue();
  sendAcademyNotification.mockReset();
  sendAcademyNotification.mockResolvedValue();
});

describe("confirmed Stripe registration email", () => {
  it("sends both emails and records the sent timestamp", async () => {
    h.read(payments, confirmedRegistration);

    await expect(
      sendConfirmedStripeRegistrationEmail("cs_fixture", NOW),
    ).resolves.toBe("sent");

    expect(sendConfirmation).toHaveBeenCalledTimes(1);
    expect(sendAcademyNotification).toHaveBeenCalledTimes(1);

    expect(sendConfirmation).toHaveBeenCalledWith({
      registrationId: 1,
      guardianName: "Test Guardian",
      guardianEmail: "guardian@example.com",
      playerName: "Test Player",
      trainingGroupName: "Ages 8–10",
      programPackageName: "1 Month",
      startsOn: "2026-10-01",
      endsOn: "2026-10-31",
      registrationStatus: "scheduled",
    });

    expect(sendAcademyNotification).toHaveBeenCalledWith({
      registrationId: 1,
      playerName: "Test Player",
      guardianName: "Test Guardian",
      guardianEmail: "guardian@example.com",
      guardianPhone: "519-555-0123",
      trainingGroupName: "Ages 8–10",
      programPackageName: "1 Month",
      amountCents: 11_300,
      currency: "CAD",
      startsOn: "2026-10-01",
      endsOn: "2026-10-31",
    });

    expect(sendConfirmation.mock.invocationCallOrder[0]).toBeLessThan(
      sendAcademyNotification.mock.invocationCallOrder[0],
    );

    expect(h.queries(payments)[0].lock).toBe("update");

    expect(h.writes(payments)).toHaveLength(1);

    expect(h.writes(payments)[0].values).toEqual({
      stripeRegistrationConfirmationSentAt: NOW,
    });

    expect(h.operations.at(-1)?.kind).toBe("commit");
  });

  it("does not send again when the confirmation was already recorded", async () => {
    h.read(payments, {
      ...confirmedRegistration,
      confirmationSentAt: new Date("2026-09-06T12:00:00.000Z"),
    });

    await expect(
      sendConfirmedStripeRegistrationEmail("cs_fixture", NOW),
    ).resolves.toBe("already-sent");

    expect(sendConfirmation).not.toHaveBeenCalled();
    expect(sendAcademyNotification).not.toHaveBeenCalled();
    expect(h.writes(payments)).toEqual([]);
  });

  it("returns unavailable when no confirmed Stripe registration matches", async () => {
    h.read(payments);

    await expect(
      sendConfirmedStripeRegistrationEmail("cs_fixture", NOW),
    ).resolves.toBe("unavailable");

    expect(sendConfirmation).not.toHaveBeenCalled();
    expect(sendAcademyNotification).not.toHaveBeenCalled();
    expect(h.writes(payments)).toEqual([]);
  });

  it("does not send when required registration dates are missing", async () => {
    h.read(payments, {
      ...confirmedRegistration,
      startsOn: null,
    });

    await expect(
      sendConfirmedStripeRegistrationEmail("cs_fixture", NOW),
    ).resolves.toBe("unavailable");

    expect(sendConfirmation).not.toHaveBeenCalled();
    expect(sendAcademyNotification).not.toHaveBeenCalled();
    expect(h.writes(payments)).toEqual([]);
  });

  it("does not notify ARTIS or record the timestamp when the guardian email fails", async () => {
    h.read(payments, confirmedRegistration);

    sendConfirmation.mockRejectedValueOnce(
      new Error("Email provider unavailable"),
    );

    await expect(
      sendConfirmedStripeRegistrationEmail("cs_fixture", NOW),
    ).rejects.toThrow("Email provider unavailable");

    expect(sendConfirmation).toHaveBeenCalledTimes(1);
    expect(sendAcademyNotification).not.toHaveBeenCalled();
    expect(h.writes(payments)).toEqual([]);

    expect(
      h.operations.some((operation) => operation.kind === "rollback"),
    ).toBe(true);
  });

  it("does not record the timestamp when the ARTIS notification fails", async () => {
    h.read(payments, confirmedRegistration);

    sendAcademyNotification.mockRejectedValueOnce(
      new Error("Email provider unavailable"),
    );

    await expect(
      sendConfirmedStripeRegistrationEmail("cs_fixture", NOW),
    ).rejects.toThrow("Email provider unavailable");

    expect(sendConfirmation).toHaveBeenCalledTimes(1);
    expect(sendAcademyNotification).toHaveBeenCalledTimes(1);
    expect(h.writes(payments)).toEqual([]);
    expect(h.operations.at(-1)?.kind).toBe("rollback");
  });

  it("throws if the sent timestamp cannot be recorded", async () => {
    h.read(payments, confirmedRegistration);

    h.results.push({
      affectedRows: 0,
    });

    await expect(
      sendConfirmedStripeRegistrationEmail("cs_fixture", NOW),
    ).rejects.toThrow(
      "The Stripe registration confirmation could not be recorded.",
    );

    expect(sendConfirmation).toHaveBeenCalledTimes(1);
    expect(sendAcademyNotification).toHaveBeenCalledTimes(1);

    expect(
      h.operations.some((operation) => operation.kind === "rollback"),
    ).toBe(true);
  });

  it.each(["", "not-a-stripe-session", "x".repeat(256)])(
    "rejects invalid Stripe session ID %p",
    async (sessionId) => {
      await expect(
        sendConfirmedStripeRegistrationEmail(sessionId, NOW),
      ).rejects.toThrow(TypeError);

      expect(h.db.transaction).not.toHaveBeenCalled();
      expect(sendConfirmation).not.toHaveBeenCalled();
      expect(sendAcademyNotification).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid confirmation date", async () => {
    await expect(
      sendConfirmedStripeRegistrationEmail("cs_fixture", new Date("invalid")),
    ).rejects.toThrow(TypeError);

    expect(h.db.transaction).not.toHaveBeenCalled();
    expect(sendConfirmation).not.toHaveBeenCalled();
    expect(sendAcademyNotification).not.toHaveBeenCalled();
  });
});

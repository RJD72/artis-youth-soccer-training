import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  guardianVerificationTokens,
  renewalVerificationTokens,
} from "@/db/schema";
import { verifyRegistrationPaymentReference } from "@/lib/registration-payment-reference";
import { databaseHarness, NOW, FUTURE, sqlQuery } from "./database-harness";
import { registrationForm } from "./registration-fixtures";
const h = databaseHarness();
const createRegistration =
  jest.fn<
    typeof import("@/lib/create-pending-registration").createPendingRegistration
  >();
const createRenewal =
  jest.fn<typeof import("@/lib/create-pending-renewal").createPendingRenewal>();
const guardianRequest =
  jest.fn<
    typeof import("@/lib/create-guardian-verification-request").createGuardianVerificationRequest
  >();
const renewalRequest =
  jest.fn<
    typeof import("@/lib/create-renewal-verification-request").createRenewalVerificationRequest
  >();
const guardianEmail = jest.fn<(...args: unknown[]) => Promise<void>>();
const renewalEmail = jest.fn<(...args: unknown[]) => Promise<void>>();
const pendingEmail = jest.fn<(...args: unknown[]) => Promise<void>>();
const getToken = jest.fn<() => Promise<string | null>>();
const clearToken = jest.fn<() => Promise<void>>();
const redirect = jest.fn((url: string): never => {
  throw Object.assign(new Error("NEXT_REDIRECT"), {
    digest: `NEXT_REDIRECT;replace;${url};307;`,
  });
});
const deferred: Array<() => Promise<void>> = [];
let register: typeof import("@/app/register/actions").submitRegistration;
let renew: typeof import("@/app/register/renew/verify/actions").submitRenewal;
let requestRenewal: typeof import("@/app/register/renew/actions").requestRenewalVerification;
const token = "a".repeat(43);
const created = {
  status: "created" as const,
  registrationId: 1,
  paymentId: 2,
  paymentMethod: "stripe" as const,
  manualPaymentReference: null,
  trainingGroupSlug: "development",
  startsOn: "2026-10-01",
  endsOn: "2026-12-31",
  subtotalCents: 10000,
  taxCents: 1300,
  totalCents: 11300,
  currency: "CAD",
};
const verification = {
  status: "created" as const,
  guardianName: "Test Guardian",
  guardianEmail: "guardian@example.com",
  playerName: "Test Player",
  token,
  expiresAt: FUTURE,
};
beforeAll(async () => {
  jest.doMock("@/db", () => ({ db: h.db }));
  jest.doMock("next/navigation", () => ({ redirect }));
  jest.doMock("next/server", () => ({
    after: (callback: () => Promise<void>) => deferred.push(callback),
  }));
  jest.doMock("@/lib/create-pending-registration", () => ({
    createPendingRegistration: createRegistration,
  }));
  jest.doMock("@/lib/create-pending-renewal", () => ({
    createPendingRenewal: createRenewal,
  }));
  jest.doMock("@/lib/create-guardian-verification-request", () => ({
    createGuardianVerificationRequest: guardianRequest,
  }));
  jest.doMock("@/lib/create-renewal-verification-request", () => ({
    createRenewalVerificationRequest: renewalRequest,
  }));
  jest.doMock("@/lib/guardian-verification-session", () => ({
    getGuardianVerificationSessionToken: getToken,
    clearGuardianVerificationSession: clearToken,
  }));
  jest.doMock("@/lib/send-guardian-verification-email", () => ({
    sendGuardianVerificationEmail: guardianEmail,
  }));
  jest.doMock("@/lib/send-renewal-verification-email", () => ({
    sendRenewalVerificationEmail: renewalEmail,
  }));
  jest.doMock("@/lib/send-e-transfer-pending-notification-email", () => ({
    sendETransferPendingNotificationEmail: pendingEmail,
  }));
  ({ submitRegistration: register } = await import("@/app/register/actions"));
  ({ submitRenewal: renew } =
    await import("@/app/register/renew/verify/actions"));
  ({ requestRenewalVerification: requestRenewal } =
    await import("@/app/register/renew/actions"));
});
beforeEach(() => {
  h.reset();
  deferred.length = 0;
  jest.useFakeTimers().setSystemTime(NOW);
  jest.replaceProperty(process, "env", {
    ...process.env,
    BETTER_AUTH_SECRET: "synthetic-action-signing-secret-".repeat(2),
  });
  jest.spyOn(console, "error").mockImplementation(() => {});
  createRegistration.mockReset().mockResolvedValue(created);
  createRenewal.mockReset().mockResolvedValue(created);
  guardianRequest.mockReset().mockResolvedValue(verification);
  renewalRequest.mockReset().mockResolvedValue(verification);
  getToken.mockReset().mockResolvedValue(token);
  clearToken.mockReset().mockResolvedValue();
  guardianEmail.mockReset().mockResolvedValue();
  renewalEmail.mockReset().mockResolvedValue();
  pendingEmail.mockReset().mockResolvedValue();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
describe("registration server action", () => {
  it("returns field-specific validation errors without creating records", async () => {
    const result = await register(
      { status: "idle" },
      registrationForm({ email: "bad", childFirstName: "" }),
    );
    expect(result).toMatchObject({
      status: "error",
      code: "invalid-form",
      fieldErrors: { childFirstName: expect.any(String) },
    });
    expect(createRegistration).not.toHaveBeenCalled();
  });
  it("blocks honeypot submissions", async () => {
    expect(
      await register({ status: "idle" }, registrationForm({ website: "bot" })),
    ).toEqual({ status: "error", code: "unable-to-submit" });
    expect(createRegistration).not.toHaveBeenCalled();
  });
  it.each([
    "age-mismatch",
    "already-registered",
    "renewal-required",
    "group-full",
    "registration-closed",
    "invalid-selection",
    "legal-documents-unavailable",
  ] as const)("maps %s rejection", async (code) => {
    createRegistration.mockResolvedValue({ status: "rejected", code });
    expect(await register({ status: "idle" }, registrationForm())).toEqual({
      status: "error",
      code,
    });
    expect(redirect).not.toHaveBeenCalled();
  });
  it.each(["stripe", "e_transfer"] as const)(
    "normalizes data and redirects to signed %s payment instructions",
    async (paymentMethod) => {
      createRegistration.mockResolvedValue({ ...created, paymentMethod });
      await expect(
        register(
          { status: "idle" },
          registrationForm({
            paymentMethod,
            email: " GUARDIAN@EXAMPLE.COM ",
            totalCents: "1",
          }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(createRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "guardian@example.com",
          paymentMethod,
        }),
        new Date(
          NOW.getTime() + (paymentMethod === "stripe" ? 3600000 : 86400000),
        ),
        token,
      );
      const url = new URL(redirect.mock.calls[0][0], "https://academy.example");
      expect(url.pathname).toBe(
        `/register/payment/${paymentMethod === "stripe" ? "stripe" : "e-transfer"}`,
      );
      const p = url.searchParams;
      expect(
        verifyRegistrationPaymentReference(
          p.get("registration")!,
          p.get("payment")!,
          p.get("method")!,
          p.get("expires")!,
          p.get("signature")!,
        ),
      ).toEqual({ registrationId: 1, paymentId: 2, method: paymentMethod });
      expect(url.toString()).not.toContain(token);
      expect(url.toString()).not.toContain("guardian");
      expect(clearToken).toHaveBeenCalled();
      if (paymentMethod === "e_transfer") {
        expect(pendingEmail).not.toHaveBeenCalled();
        await deferred[0]();
        expect(pendingEmail).toHaveBeenCalledWith(1, 2);
      }
    },
  );
  it.each([true, false])(
    "requests guardian verification, including suppressed requests: %p",
    async (suppressed) => {
      createRegistration.mockResolvedValue({
        status: "rejected",
        code: "guardian-verification-required",
      });
      if (suppressed)
        guardianRequest.mockResolvedValue({ status: "not-created" });
      expect(await register({ status: "idle" }, registrationForm())).toEqual({
        status: "error",
        code: "guardian-verification-required",
      });
      expect(guardianRequest).toHaveBeenCalledWith("guardian@example.com");
      expect(guardianEmail).toHaveBeenCalledTimes(suppressed ? 0 : 1);
    },
  );
  it("removes only the hashed undelivered verification token after email failure", async () => {
    createRegistration.mockResolvedValue({
      status: "rejected",
      code: "guardian-verification-required",
    });
    guardianEmail.mockRejectedValue(new Error("synthetic-private-error"));
    expect(await register({ status: "idle" }, registrationForm())).toEqual({
      status: "error",
      code: "unable-to-submit",
    });
    expect(h.writes(guardianVerificationTokens)).toHaveLength(1);
    expect(sqlQuery(h.writes()[0]).params).not.toContain(token);
    expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain(
      "synthetic-private-error",
    );
  });
  it("returns a safe state after database failure", async () => {
    createRegistration.mockRejectedValue(
      new Error("guardian@example.com synthetic-private-error"),
    );
    expect(await register({ status: "idle" }, registrationForm())).toEqual({
      status: "error",
      code: "unable-to-submit",
    });
    expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain(
      "guardian@example.com",
    );
  });
  it("preserves successful registration despite cookie cleanup and deferred notification errors", async () => {
    clearToken.mockRejectedValue(new Error("Synthetic cookie failure"));
    pendingEmail.mockRejectedValue(new Error("Synthetic email failure"));
    createRegistration.mockResolvedValue({
      ...created,
      paymentMethod: "e_transfer",
    });
    await expect(
      register(
        { status: "idle" },
        registrationForm({ paymentMethod: "e_transfer" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    await expect(deferred[0]()).resolves.toBeUndefined();
  });
});
function renewalForm(changes: Record<string, string> = {}) {
  return registrationForm({ token, ...changes });
}
describe("verified renewal checkout action", () => {
  it.each<Record<string, string>>([
    { token: "bad" },
    { programPackageId: "01" },
    { paymentMethod: "cash" },
    { cancellationPolicyAccepted: "false" },
    { photoVideoConsent: "unexpected" },
  ])("rejects malformed fields %p", async (change) => {
    expect(await renew({ status: "idle" }, renewalForm(change))).toEqual({
      status: "error",
      code: "invalid-form",
    });
    expect(createRenewal).not.toHaveBeenCalled();
  });
  it.each([
    "invalid-token",
    "invalid-submission",
    "invalid-selection",
    "payment-pending",
    "upcoming-registration",
    "registration-history-unavailable",
    "age-mismatch",
    "legal-documents-unavailable",
    "group-full",
  ] as const)("maps %s rejection", async (code) => {
    createRenewal.mockResolvedValue({ status: "rejected", code });
    expect(await renew({ status: "idle" }, renewalForm())).toEqual({
      status: "error",
      code,
    });
  });
  it.each(["stripe", "e_transfer"] as const)(
    "preserves %s redirect exceptions and signed identifiers",
    async (paymentMethod) => {
      createRenewal.mockResolvedValue({ ...created, paymentMethod });
      await expect(
        renew({ status: "idle" }, renewalForm({ paymentMethod })),
      ).rejects.toThrow("NEXT_REDIRECT");
      const url = new URL(redirect.mock.calls[0][0], "https://academy.example");
      expect(url.pathname).toBe(
        `/register/payment/${paymentMethod === "stripe" ? "stripe" : "e-transfer"}`,
      );
      expect(url.searchParams.has("signature")).toBe(true);
      expect(url.toString()).not.toContain(token);
    },
  );
  it("blocks spam and safely maps service errors", async () => {
    expect(
      await renew({ status: "idle" }, renewalForm({ website: "bot" })),
    ).toEqual({ status: "error", code: "unable-to-submit" });
    createRenewal.mockRejectedValue(new Error("synthetic-private-error"));
    expect(await renew({ status: "idle" }, renewalForm())).toEqual({
      status: "error",
      code: "unable-to-submit",
    });
    expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain(
      "synthetic-private-error",
    );
  });
});
function identityForm(changes: Record<string, string> = {}) {
  const form = new FormData();
  Object.entries({
    guardianEmail: " GUARDIAN@EXAMPLE.COM ",
    playerFullName: " Test   Player ",
    dateOfBirth: "2015-06-15",
    ...changes,
  }).forEach(([key, value]) => form.set(key, value));
  return form;
}
describe("renewal verification request action", () => {
  it.each(["created", "not-created"] as const)(
    "returns the same enumeration-resistant response for %s",
    async (status) => {
      renewalRequest.mockResolvedValue(
        status === "created" ? verification : { status },
      );
      expect(await requestRenewal({ status: "idle" }, identityForm())).toEqual({
        status: "submitted",
      });
      expect(renewalRequest).toHaveBeenCalledWith({
        guardianEmail: "guardian@example.com",
        playerFullName: "Test Player",
        dateOfBirth: "2015-06-15",
      });
      expect(renewalEmail).not.toHaveBeenCalled();
      if (status === "created") {
        await deferred[0]();
        expect(renewalEmail).toHaveBeenCalledWith(
          expect.objectContaining({ token, playerName: "Test Player" }),
        );
      }
    },
  );
  it.each<Record<string, string>>([
    { guardianEmail: "bad" },
    { dateOfBirth: "2026-02-30" },
    { dateOfBirth: "2027-01-01" },
    { playerFullName: "x" },
  ])("rejects malformed identity %p", async (change) => {
    expect(
      await requestRenewal({ status: "idle" }, identityForm(change)),
    ).toEqual({ status: "error", code: "invalid-form" });
    expect(renewalRequest).not.toHaveBeenCalled();
  });
  it("returns submitted for honeypot without querying", async () => {
    expect(
      await requestRenewal(
        { status: "idle" },
        identityForm({ website: "bot" }),
      ),
    ).toEqual({ status: "submitted" });
    expect(renewalRequest).not.toHaveBeenCalled();
  });
  it("handles deferred email failure and deletes only its hashed token", async () => {
    renewalEmail.mockRejectedValue(new Error("synthetic-private-error"));
    expect(await requestRenewal({ status: "idle" }, identityForm())).toEqual({
      status: "submitted",
    });
    await deferred[0]();
    expect(h.writes(renewalVerificationTokens)).toHaveLength(1);
    expect(sqlQuery(h.writes()[0]).params).not.toContain(token);
    expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain(
      "synthetic-private-error",
    );
  });
  it("maps database failure to safe error", async () => {
    renewalRequest.mockRejectedValue(new Error("synthetic-private-error"));
    expect(await requestRenewal({ status: "idle" }, identityForm())).toEqual({
      status: "error",
      code: "unable-to-submit",
    });
  });
});

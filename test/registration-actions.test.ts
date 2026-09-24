import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { verifyRegistrationPaymentReference } from "@/lib/registration-payment-reference";
import { databaseHarness, NOW } from "./database-harness";
import { registrationForm } from "./registration-fixtures";
const h = databaseHarness();
const createRegistration =
  jest.fn<
    typeof import("@/lib/create-pending-registration").createPendingRegistration
  >();
const createRenewalForPlayer =
  jest.fn<
    typeof import("@/lib/create-pending-renewal").createPendingRenewalForPlayer
  >();
const findRenewalPlayer =
  jest.fn<typeof import("@/lib/find-renewal-player").findRenewalPlayer>();
const createRenewalPlayerReference =
  jest.fn<
    typeof import("@/lib/renewal-player-reference").createRenewalPlayerReference
  >();
const readRenewalPlayerReference =
  jest.fn<
    typeof import("@/lib/renewal-player-reference").readRenewalPlayerReference
  >();
const pendingEmail = jest.fn<(...args: unknown[]) => Promise<void>>();
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
const renewalPlayerReference = {
  player: "4",
  expires: "1790000000",
  signature: "a".repeat(64),
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
    createPendingRenewalForPlayer: createRenewalForPlayer,
  }));
  jest.doMock("@/lib/find-renewal-player", () => ({ findRenewalPlayer }));
  jest.doMock("@/lib/renewal-player-reference", () => ({
    createRenewalPlayerReference,
    readRenewalPlayerReference,
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
  createRenewalForPlayer.mockReset().mockResolvedValue(created);
  findRenewalPlayer.mockReset().mockResolvedValue({ status: "found", playerId: 4 });
  createRenewalPlayerReference.mockReset().mockReturnValue(renewalPlayerReference);
  readRenewalPlayerReference.mockReset().mockReturnValue({ playerId: 4 });
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
    "payment-pending",
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
      if (paymentMethod === "e_transfer") {
        expect(pendingEmail).not.toHaveBeenCalled();
        expect(deferred).toHaveLength(1);
        await deferred[0]();
        expect(pendingEmail).toHaveBeenCalledWith(1, 2, "registration");
      } else {
        expect(deferred).toEqual([]);
        expect(pendingEmail).not.toHaveBeenCalled();
      }
    },
  );
  it("redirects a resumed Stripe attempt with a fresh signed payment reference", async () => {
    createRegistration.mockResolvedValue({
      ...created,
      status: "resumed",
      registrationId: 9,
      paymentId: 10,
    });
    await expect(
      register({ status: "idle" }, registrationForm()),
    ).rejects.toThrow("NEXT_REDIRECT");
    const url = new URL(redirect.mock.calls[0][0], "https://academy.example");
    expect(url.pathname).toBe("/register/payment/stripe");
    expect(
      verifyRegistrationPaymentReference(
        url.searchParams.get("registration")!,
        url.searchParams.get("payment")!,
        url.searchParams.get("method")!,
        url.searchParams.get("expires")!,
        url.searchParams.get("signature")!,
      ),
    ).toEqual({ registrationId: 9, paymentId: 10, method: "stripe" });
    expect(url.toString()).not.toContain("guardian");
    expect(deferred).toEqual([]);
  });
  it("does not notify the academy when an e-transfer attempt is resumed", async () => {
    createRegistration.mockResolvedValue({
      ...created,
      status: "resumed",
      paymentMethod: "e_transfer",
      manualPaymentReference: "ARTIS-2",
    });
    await expect(
      register(
        { status: "idle" },
        registrationForm({ paymentMethod: "e_transfer" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(pendingEmail).not.toHaveBeenCalled();
    expect(deferred).toEqual([]);
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
  it("preserves successful registration despite deferred notification errors", async () => {
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
function signedReferenceRenewalForm(changes: Record<string, string> = {}) {
  return registrationForm({ ...renewalPlayerReference, ...changes });
}
describe("verified renewal checkout action", () => {
  it.each<Record<string, string>>([
    { programPackageId: "01" },
    { paymentMethod: "cash" },
    { cancellationPolicyAccepted: "false" },
    { photoVideoConsent: "unexpected" },
  ])("rejects malformed fields %p", async (change) => {
    expect(
      await renew({ status: "idle" }, signedReferenceRenewalForm(change)),
    ).toEqual({
      status: "error",
      code: "invalid-form",
    });
    expect(createRenewalForPlayer).not.toHaveBeenCalled();
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
    createRenewalForPlayer.mockResolvedValue({ status: "rejected", code });
    expect(
      await renew({ status: "idle" }, signedReferenceRenewalForm()),
    ).toEqual({
      status: "error",
      code,
    });
    expect(deferred).toEqual([]);
    expect(pendingEmail).not.toHaveBeenCalled();
  });
  it.each(["stripe", "e_transfer"] as const)(
    "preserves %s redirect exceptions and signed identifiers",
    async (paymentMethod) => {
      createRenewalForPlayer.mockResolvedValue({ ...created, paymentMethod });
      await expect(
        renew(
          { status: "idle" },
          signedReferenceRenewalForm({ paymentMethod }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT");
      const url = new URL(redirect.mock.calls[0][0], "https://academy.example");
      expect(url.pathname).toBe(
        `/register/payment/${paymentMethod === "stripe" ? "stripe" : "e-transfer"}`,
      );
      expect(url.searchParams.has("signature")).toBe(true);
      expect(url.toString()).not.toContain(token);
      if (paymentMethod === "e_transfer") {
        expect(pendingEmail).not.toHaveBeenCalled();
        expect(deferred).toHaveLength(1);
        await deferred[0]();
        expect(pendingEmail).toHaveBeenCalledWith(1, 2, "renewal");
      } else {
        expect(deferred).toEqual([]);
        expect(pendingEmail).not.toHaveBeenCalled();
      }
    },
  );
  it("preserves a successful renewal despite deferred notification errors", async () => {
    pendingEmail.mockRejectedValue(
      new Error("guardian@example.com synthetic-private-provider-error"),
    );
    createRenewalForPlayer.mockResolvedValue({
      ...created,
      paymentMethod: "e_transfer",
    });

    await expect(
      renew(
        { status: "idle" },
        signedReferenceRenewalForm({ paymentMethod: "e_transfer" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect.mock.calls[0][0]).toContain(
      "/register/payment/e-transfer",
    );
    expect(deferred).toHaveLength(1);
    await expect(deferred[0]()).resolves.toBeUndefined();
    expect(pendingEmail).toHaveBeenCalledWith(1, 2, "renewal");

    const loggedOutput = JSON.stringify(
      jest.mocked(console.error).mock.calls,
    );
    expect(loggedOutput).toContain("Error");
    expect(loggedOutput).not.toContain("guardian@example.com");
    expect(loggedOutput).not.toContain("synthetic-private-provider-error");
  });
  it("uses a valid signed player reference for renewal checkout", async () => {
    await expect(
      renew({ status: "idle" }, signedReferenceRenewalForm()),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(readRenewalPlayerReference).toHaveBeenCalledWith(
      "4",
      "1790000000",
      "a".repeat(64),
    );
    expect(createRenewalForPlayer).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        programPackageId: expect.any(Number),
        paymentMethod: expect.any(String),
      }),
    );
    const url = new URL(redirect.mock.calls[0][0], "https://academy.example");
    expect(url.pathname).toBe("/register/payment/stripe");
    expect(url.searchParams.has("signature")).toBe(true);
    expect(url.toString()).not.toContain(token);
  });
  it("rejects an invalid signed player reference", async () => {
    readRenewalPlayerReference.mockReturnValue(null);
    expect(
      await renew({ status: "idle" }, signedReferenceRenewalForm()),
    ).toEqual({ status: "error", code: "invalid-token" });
    expect(createRenewalForPlayer).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("returns a safe error when signed reference validation throws", async () => {
    readRenewalPlayerReference.mockImplementation(() => {
      throw new Error("synthetic-private-error");
    });
    expect(
      await renew({ status: "idle" }, signedReferenceRenewalForm()),
    ).toEqual({ status: "error", code: "unable-to-submit" });
    expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain(
      "synthetic-private-error",
    );
  });
  it.each([
    {
      name: "both token and signed-player-reference fields",
      form: () => {
        const form = signedReferenceRenewalForm();
        form.set("token", token);
        return form;
      },
    },
    {
      name: "an incomplete signed player reference",
      form: () => {
        const form = signedReferenceRenewalForm();
        form.delete("signature");
        return form;
      },
    },
    {
      name: "neither token nor a signed player reference",
      form: () => registrationForm(),
    },
  ])("rejects $name", async ({ form }) => {
    expect(await renew({ status: "idle" }, form())).toEqual({
      status: "error",
      code: "invalid-form",
    });
    expect(createRenewalForPlayer).not.toHaveBeenCalled();
    expect(readRenewalPlayerReference).not.toHaveBeenCalled();
  });
  it("blocks spam and safely maps service errors", async () => {
    expect(
      await renew(
        { status: "idle" },
        signedReferenceRenewalForm({ website: "bot" }),
      ),
    ).toEqual({ status: "error", code: "unable-to-submit" });
    createRenewalForPlayer.mockRejectedValue(
      new Error("synthetic-private-error"),
    );
    expect(
      await renew({ status: "idle" }, signedReferenceRenewalForm()),
    ).toEqual({
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
describe("renewal player lookup action", () => {
  it("redirects a matched player directly to renewal options", async () => {
    await expect(
      requestRenewal({ status: "idle" }, identityForm()),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(findRenewalPlayer).toHaveBeenCalledWith({
      guardianEmail: "guardian@example.com",
      playerFullName: "Test Player",
      dateOfBirth: "2015-06-15",
    });
    expect(createRenewalPlayerReference).toHaveBeenCalledWith(4);
    const url = new URL(redirect.mock.calls[0][0], "https://academy.example");
    expect(url.pathname).toBe("/register/renew/verify");
    expect(Array.from(url.searchParams.entries())).toEqual([
      ["player", "4"],
      ["expires", "1790000000"],
      ["signature", "a".repeat(64)],
    ]);
    const decodedUrl = decodeURIComponent(url.toString());
    expect(decodedUrl).not.toContain("guardian@example.com");
    expect(decodedUrl).not.toContain("Test Player");
    expect(decodedUrl).not.toContain("2015-06-15");
    expect(deferred).toEqual([]);
  });
  it("returns the generic submitted state when no player matches", async () => {
    findRenewalPlayer.mockResolvedValue({ status: "not-found" });
    expect(await requestRenewal({ status: "idle" }, identityForm())).toEqual({
      status: "submitted",
    });
    expect(redirect).not.toHaveBeenCalled();
    expect(createRenewalPlayerReference).not.toHaveBeenCalled();
  });
  it.each<Record<string, string>>([
    { guardianEmail: "bad" },
    { dateOfBirth: "2026-02-30" },
    { dateOfBirth: "2027-01-01" },
    { playerFullName: "x" },
  ])("rejects malformed identity %p", async (change) => {
    expect(
      await requestRenewal({ status: "idle" }, identityForm(change)),
    ).toEqual({ status: "error", code: "invalid-form" });
    expect(findRenewalPlayer).not.toHaveBeenCalled();
  });
  it("returns submitted for honeypot without querying", async () => {
    expect(
      await requestRenewal(
        { status: "idle" },
        identityForm({ website: "bot" }),
      ),
    ).toEqual({ status: "submitted" });
    expect(findRenewalPlayer).not.toHaveBeenCalled();
  });
  it("returns a safe error when renewal player lookup fails", async () => {
    findRenewalPlayer.mockRejectedValue(
      new Error("guardian@example.com synthetic-private-error"),
    );
    expect(await requestRenewal({ status: "idle" }, identityForm())).toEqual({
      status: "error",
      code: "unable-to-submit",
    });
    expect(console.error).toHaveBeenCalledWith(
      "Renewal player lookup failed.",
      { errorType: "Error" },
    );
    const loggedOutput = JSON.stringify(jest.mocked(console.error).mock.calls);
    expect(loggedOutput).not.toContain("guardian@example.com");
    expect(loggedOutput).not.toContain("synthetic-private-error");
    expect(redirect).not.toHaveBeenCalled();
    expect(createRenewalPlayerReference).not.toHaveBeenCalled();
  });
});

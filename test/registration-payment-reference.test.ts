import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import {
  createManualPaymentReference,
  createRegistrationPaymentReference,
  verifyRegistrationPaymentReference,
} from "@/lib/registration-payment-reference";

const originalSigningSecret = process.env.BETTER_AUTH_SECRET;
const signingSecret =
  "a-secure-test-secret-that-is-longer-than-thirty-two-bytes";
const fixedTimeMilliseconds = 1_800_000_000_000;
const fixedTimeSeconds = fixedTimeMilliseconds / 1_000;

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(fixedTimeMilliseconds);
  process.env.BETTER_AUTH_SECRET = signingSecret;
});

afterAll(() => {
  jest.restoreAllMocks();

  if (originalSigningSecret === undefined) {
    delete process.env.BETTER_AUTH_SECRET;
  } else {
    process.env.BETTER_AUTH_SECRET = originalSigningSecret;
  }
});

describe("createManualPaymentReference", () => {
  it("creates the bank-transfer reference from the payment ID", () => {
    expect(createManualPaymentReference(1047)).toBe("ARTIS-1047");
  });

  it.each([0, -1, 1.5, Number.NaN, 4_294_967_296])(
    "rejects the invalid payment ID %s",
    (paymentId) => {
      expect(() => createManualPaymentReference(paymentId)).toThrow(
        "A valid payment ID is required.",
      );
    },
  );
});

describe("registration payment references", () => {
  it("creates and verifies a 30-minute Stripe reference", () => {
    const reference = createRegistrationPaymentReference(11, 21, "stripe");

    expect(reference).toMatchObject({
      registration: "11",
      payment: "21",
      method: "stripe",
      expires: String(fixedTimeSeconds + 30 * 60),
    });
    expect(reference.signature).toMatch(/^[a-f0-9]{64}$/);

    expect(
      verifyRegistrationPaymentReference(
        reference.registration,
        reference.payment,
        reference.method,
        reference.expires,
        reference.signature,
      ),
    ).toEqual({
      registrationId: 11,
      paymentId: 21,
      method: "stripe",
    });
  });

  it("creates and verifies a 24-hour e-transfer reference", () => {
    const reference = createRegistrationPaymentReference(12, 22, "e_transfer");

    expect(reference.expires).toBe(String(fixedTimeSeconds + 24 * 60 * 60));
    expect(
      verifyRegistrationPaymentReference(
        reference.registration,
        reference.payment,
        reference.method,
        reference.expires,
        reference.signature,
      ),
    ).toEqual({
      registrationId: 12,
      paymentId: 22,
      method: "e_transfer",
    });
  });

  it.each([
    ["registration ID", { registration: "999" }],
    ["payment ID", { payment: "999" }],
    ["payment method", { method: "e_transfer" }],
    ["expiry", { expires: String(fixedTimeSeconds + 60) }],
    ["signature", { signature: "0".repeat(64) }],
  ])("rejects a reference with a changed %s", (_label, changedValues) => {
    const reference = createRegistrationPaymentReference(13, 23, "stripe");
    const tamperedReference = { ...reference, ...changedValues };

    expect(
      verifyRegistrationPaymentReference(
        tamperedReference.registration,
        tamperedReference.payment,
        tamperedReference.method,
        tamperedReference.expires,
        tamperedReference.signature,
      ),
    ).toBeNull();
  });

  it("rejects a reference as soon as it expires", () => {
    const reference = createRegistrationPaymentReference(14, 24, "stripe");
    jest.spyOn(Date, "now").mockReturnValue(Number(reference.expires) * 1_000);

    expect(
      verifyRegistrationPaymentReference(
        reference.registration,
        reference.payment,
        reference.method,
        reference.expires,
        reference.signature,
      ),
    ).toBeNull();
  });

  it.each([
    ["zero registration ID", "0", "25", "stripe"],
    ["decimal payment ID", "15", "25.5", "stripe"],
    ["unsupported method", "15", "25", "cash"],
  ])(
    "rejects malformed reference values: %s",
    (_label, registration, payment, method) => {
      const reference = createRegistrationPaymentReference(15, 25, "stripe");

      expect(
        verifyRegistrationPaymentReference(
          registration,
          payment,
          method,
          reference.expires,
          reference.signature,
        ),
      ).toBeNull();
    },
  );

  it.each([0, -1, 1.5, 4_294_967_296])(
    "refuses to sign the invalid registration ID %s",
    (registrationId) => {
      expect(() =>
        createRegistrationPaymentReference(registrationId, 26, "stripe"),
      ).toThrow("A valid registration ID is required.");
    },
  );

  it("refuses to sign an unsupported payment method", () => {
    expect(() =>
      createRegistrationPaymentReference(16, 26, "cash" as "stripe"),
    ).toThrow("A valid payment method is required.");
  });

  it("requires a signing secret", () => {
    delete process.env.BETTER_AUTH_SECRET;

    expect(() => createRegistrationPaymentReference(17, 27, "stripe")).toThrow(
      "BETTER_AUTH_SECRET is required to sign registration payment references.",
    );
  });

  it("rejects a signing secret shorter than 32 bytes", () => {
    process.env.BETTER_AUTH_SECRET = "too-short";

    expect(() => createRegistrationPaymentReference(18, 28, "stripe")).toThrow(
      "BETTER_AUTH_SECRET must contain at least 32 bytes of unpredictable data.",
    );
  });
});

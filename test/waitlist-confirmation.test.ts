import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import {
  createWaitlistConfirmationReference,
  verifyWaitlistConfirmationReference,
} from "@/lib/waitlist-confirmation";

const originalSigningSecret = process.env.BETTER_AUTH_SECRET;
const signingSecret = "waitlist-test-secret-that-is-not-used-outside-jest";
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

describe("waitlist confirmation references", () => {
  it("creates a signed reference that expires after one hour", () => {
    const reference = createWaitlistConfirmationReference(41);

    expect(reference).toEqual({
      entry: "41",
      expires: String(fixedTimeSeconds + 60 * 60),
      signature: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("verifies an unchanged reference", () => {
    const reference = createWaitlistConfirmationReference(42);

    expect(
      verifyWaitlistConfirmationReference(
        reference.entry,
        reference.expires,
        reference.signature,
      ),
    ).toBe(42);
  });

  it.each([
    ["entry ID", { entry: "999" }],
    ["expiry", { expires: String(fixedTimeSeconds + 60) }],
    ["signature", { signature: "0".repeat(64) }],
  ])("rejects a reference with a changed %s", (_label, changedValues) => {
    const reference = createWaitlistConfirmationReference(43);
    const tamperedReference = { ...reference, ...changedValues };

    expect(
      verifyWaitlistConfirmationReference(
        tamperedReference.entry,
        tamperedReference.expires,
        tamperedReference.signature,
      ),
    ).toBeNull();
  });

  it("rejects a reference as soon as it expires", () => {
    const reference = createWaitlistConfirmationReference(44);
    jest.spyOn(Date, "now").mockReturnValue(Number(reference.expires) * 1_000);

    expect(
      verifyWaitlistConfirmationReference(
        reference.entry,
        reference.expires,
        reference.signature,
      ),
    ).toBeNull();
  });

  it("rejects a reference signed with a different secret", () => {
    const reference = createWaitlistConfirmationReference(45);
    process.env.BETTER_AUTH_SECRET =
      "a-completely-different-secret-that-is-also-long-enough";

    expect(
      verifyWaitlistConfirmationReference(
        reference.entry,
        reference.expires,
        reference.signature,
      ),
    ).toBeNull();
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "refuses to sign the invalid entry ID %s",
    (entryId) => {
      expect(() => createWaitlistConfirmationReference(entryId)).toThrow(
        "A valid waitlist entry ID is required",
      );
    },
  );

  it.each([
    ["zero entry ID", "0"],
    ["negative entry ID", "-1"],
    ["decimal entry ID", "1.5"],
    ["non-numeric entry ID", "entry"],
  ])("rejects malformed input: %s", (_label, entryValue) => {
    const reference = createWaitlistConfirmationReference(46);

    expect(
      verifyWaitlistConfirmationReference(
        entryValue,
        reference.expires,
        reference.signature,
      ),
    ).toBeNull();
  });

  it.each(["", "abc", "A".repeat(64), "0".repeat(63)])(
    "rejects the malformed signature %s",
    (signature) => {
      const reference = createWaitlistConfirmationReference(47);

      expect(
        verifyWaitlistConfirmationReference(
          reference.entry,
          reference.expires,
          signature,
        ),
      ).toBeNull();
    },
  );

  it("requires a signing secret", () => {
    delete process.env.BETTER_AUTH_SECRET;

    expect(() => createWaitlistConfirmationReference(48)).toThrow(
      "BETTER_AUTH_SECRET is required to sign waitlist confirmations.",
    );
  });
  it("rejects a signing secret shorter than 32 bytes", () => {
    process.env.BETTER_AUTH_SECRET = "too-short";

    expect(() => createWaitlistConfirmationReference(49)).toThrow(
      "BETTER_AUTH_SECRET must contain at least 32 bytes of unpredictable data.",
    );
  });
});

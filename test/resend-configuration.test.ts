import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

type ResendConfigurationModule = typeof import("@/lib/email/resend");

const mutableEnvironment = process.env as Record<string, string | undefined>;

const environmentNames = [
  "NODE_ENV",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_TEST_RECIPIENT",
] as const;

const originalEnvironment = Object.fromEntries(
  environmentNames.map((name) => [name, mutableEnvironment[name]]),
) as Record<(typeof environmentNames)[number], string | undefined>;

async function loadFreshModule(): Promise<ResendConfigurationModule> {
  jest.resetModules();
  return import("@/lib/email/resend");
}

beforeEach(() => {
  mutableEnvironment.NODE_ENV = "test";
  mutableEnvironment.RESEND_API_KEY =
    "re_test_key_that_is_long_enough_for_validation";
  mutableEnvironment.RESEND_FROM_EMAIL =
    "ARTIS Soccer Academy <noreply@example.com>";
  delete mutableEnvironment.RESEND_TEST_RECIPIENT;
});

afterAll(() => {
  for (const name of environmentNames) {
    const originalValue = originalEnvironment[name];

    if (originalValue === undefined) {
      delete mutableEnvironment[name];
    } else {
      mutableEnvironment[name] = originalValue;
    }
  }
});

describe("getResendFromAddress", () => {
  it.each([
    ["a bare address", "noreply@example.com"],
    [
      "a display name and address",
      "ARTIS Soccer Academy <noreply@example.com>",
    ],
  ])("accepts %s", async (_label, sender) => {
    mutableEnvironment.RESEND_FROM_EMAIL = `  ${sender}  `;
    const { getResendFromAddress } = await loadFreshModule();

    expect(getResendFromAddress()).toBe(sender);
  });

  it("rejects a missing sender", async () => {
    delete mutableEnvironment.RESEND_FROM_EMAIL;
    const { getResendFromAddress } = await loadFreshModule();

    expect(() => getResendFromAddress()).toThrow(
      "RESEND_FROM_EMAIL is missing. Check the project's .env.local file.",
    );
  });

  it.each([
    "not-an-email",
    "ARTIS Soccer Academy <not-an-email>",
    "ARTIS Soccer Academy\n<noreply@example.com>",
    `${"A".repeat(310)} <noreply@example.com>`,
  ])("rejects the invalid sender %s", async (sender) => {
    mutableEnvironment.RESEND_FROM_EMAIL = sender;
    const { getResendFromAddress } = await loadFreshModule();

    expect(() => getResendFromAddress()).toThrow(
      "RESEND_FROM_EMAIL is not a valid sender address.",
    );
  });
});

describe("getResendRecipient", () => {
  it("normalizes the intended recipient", async () => {
    const { getResendRecipient } = await loadFreshModule();

    expect(getResendRecipient("  FAMILY@EXAMPLE.COM ")).toBe(
      "family@example.com",
    );
  });

  it("routes development email to the configured test recipient", async () => {
    mutableEnvironment.RESEND_TEST_RECIPIENT = "  TESTER@EXAMPLE.COM ";
    const { getResendRecipient } = await loadFreshModule();

    expect(getResendRecipient("family@example.com")).toBe("tester@example.com");
  });

  it("ignores the test recipient in production", async () => {
    mutableEnvironment.NODE_ENV = "production";
    mutableEnvironment.RESEND_TEST_RECIPIENT = "tester@example.com";
    const { getResendRecipient } = await loadFreshModule();

    expect(getResendRecipient("FAMILY@EXAMPLE.COM")).toBe("family@example.com");
  });

  it("validates the intended recipient before applying a test override", async () => {
    mutableEnvironment.RESEND_TEST_RECIPIENT = "tester@example.com";
    const { getResendRecipient } = await loadFreshModule();

    expect(() => getResendRecipient("not-an-email")).toThrow(
      "The intended recipient is not a valid email address.",
    );
  });

  it("rejects an invalid test recipient", async () => {
    mutableEnvironment.RESEND_TEST_RECIPIENT = "not-an-email";
    const { getResendRecipient } = await loadFreshModule();

    expect(() => getResendRecipient("family@example.com")).toThrow(
      "RESEND_TEST_RECIPIENT is not a valid email address.",
    );
  });
});

describe("getResendClient", () => {
  it("creates one reusable client for a valid API key", async () => {
    const { getResendClient } = await loadFreshModule();
    const firstClient = getResendClient();

    expect(firstClient).toBeDefined();
    expect(getResendClient()).toBe(firstClient);
  });

  it("rejects a missing API key", async () => {
    delete mutableEnvironment.RESEND_API_KEY;
    const { getResendClient } = await loadFreshModule();

    expect(() => getResendClient()).toThrow(
      "RESEND_API_KEY is missing. Check the project's .env.local file.",
    );
  });

  it.each([
    "invalid_key_that_is_long_enough",
    "re_short",
    "re_key containing whitespace",
    `re_${"a".repeat(255)}`,
  ])("rejects the invalid API key %s", async (apiKey) => {
    mutableEnvironment.RESEND_API_KEY = apiKey;
    const { getResendClient } = await loadFreshModule();

    expect(() => getResendClient()).toThrow(
      "RESEND_API_KEY is not a valid Resend API key.",
    );
  });
});

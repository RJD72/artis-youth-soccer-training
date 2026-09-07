import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";

import {
  decryptRegistrationText,
  encryptRegistrationText,
} from "@/lib/registration-encryption";

const originalEncryptionKey = process.env.REGISTRATION_DATA_ENCRYPTION_KEY;
const encryptionKey = Buffer.alloc(32, 1).toString("base64");
const differentEncryptionKey = Buffer.alloc(32, 2).toString("base64");

beforeEach(() => {
  process.env.REGISTRATION_DATA_ENCRYPTION_KEY = encryptionKey;
});

afterAll(() => {
  if (originalEncryptionKey === undefined) {
    delete process.env.REGISTRATION_DATA_ENCRYPTION_KEY;
  } else {
    process.env.REGISTRATION_DATA_ENCRYPTION_KEY = originalEncryptionKey;
  }
});

function requireEncryptedValue(value: string | null): string {
  expect(value).not.toBeNull();

  if (value === null) {
    throw new Error("Expected registration text to be encrypted.");
  }

  return value;
}

function changeFirstCharacter(value: string): string {
  return `${value.startsWith("A") ? "B" : "A"}${value.slice(1)}`;
}

describe("registration data encryption", () => {
  it("encrypts and decrypts sensitive registration text", () => {
    const plaintext = "Severe peanut allergy; carries an EpiPen.";
    const encryptedValue = requireEncryptedValue(
      encryptRegistrationText(plaintext),
    );

    expect(encryptedValue).not.toContain(plaintext);
    expect(decryptRegistrationText(encryptedValue)).toBe(plaintext);
  });

  it("trims surrounding whitespace without changing internal content", () => {
    const encryptedValue = requireEncryptedValue(
      encryptRegistrationText("  Line one\n\nLine two  "),
    );

    expect(decryptRegistrationText(encryptedValue)).toBe(
      "Line one\n\nLine two",
    );
  });

  it("uses a new initialization vector for each encryption", () => {
    const firstValue = requireEncryptedValue(
      encryptRegistrationText("Same sensitive information"),
    );
    const secondValue = requireEncryptedValue(
      encryptRegistrationText("Same sensitive information"),
    );

    expect(secondValue).not.toBe(firstValue);
    expect(decryptRegistrationText(firstValue)).toBe(
      "Same sensitive information",
    );
    expect(decryptRegistrationText(secondValue)).toBe(
      "Same sensitive information",
    );
  });

  it("creates the expected versioned encryption format", () => {
    const encryptedValue = requireEncryptedValue(
      encryptRegistrationText("Sensitive information"),
    );
    const [version, initializationVector, authenticationTag, data] =
      encryptedValue.split(":");

    expect(encryptedValue.split(":")).toHaveLength(4);
    expect(version).toBe("v1");
    expect(Buffer.from(initializationVector, "base64url")).toHaveLength(12);
    expect(Buffer.from(authenticationTag, "base64url")).toHaveLength(16);
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([null, "", "   ", "\n\t"])(
    "stores the empty value %p as null",
    (value) => {
      expect(encryptRegistrationText(value)).toBeNull();
    },
  );

  it.each([null, ""])("decrypts the empty value %p as null", (value) => {
    expect(decryptRegistrationText(value)).toBeNull();
  });

  it("rejects ciphertext encrypted with another key", () => {
    const encryptedValue = requireEncryptedValue(
      encryptRegistrationText("Sensitive information"),
    );
    process.env.REGISTRATION_DATA_ENCRYPTION_KEY = differentEncryptionKey;

    expect(() => decryptRegistrationText(encryptedValue)).toThrow(
      "The encrypted registration data could not be verified.",
    );
  });

  it.each([
    ["initialization vector", 1],
    ["authentication tag", 2],
    ["encrypted data", 3],
  ] as const)("detects a changed %s", (_partToChange, partIndex) => {
    const encryptedValue = requireEncryptedValue(
      encryptRegistrationText("Sensitive information"),
    );
    const parts = encryptedValue.split(":");

    parts[partIndex] = changeFirstCharacter(parts[partIndex]);

    expect(() => decryptRegistrationText(parts.join(":"))).toThrow(
      "The encrypted registration data could not be verified.",
    );
  });

  it.each([
    "v2:abc:def:ghi",
    "not-encrypted-data",
    "v1::def:ghi",
    "v1:abc::ghi",
    "v1:abc:def",
    "v1:YQ:YWJjZGVmZ2hpamtsbW5vcA:data",
    "v1:YWJjZGVmZ2hpamts:YQ:data",
  ])("rejects the invalid encrypted format %s", (value) => {
    expect(() => decryptRegistrationText(value)).toThrow(
      "The encrypted registration data has an invalid format.",
    );
  });

  it("requires an encryption key when protecting non-empty text", () => {
    delete process.env.REGISTRATION_DATA_ENCRYPTION_KEY;

    expect(() => encryptRegistrationText("Sensitive information")).toThrow(
      "REGISTRATION_DATA_ENCRYPTION_KEY is required to protect registration data.",
    );
  });

  it.each([
    Buffer.alloc(31).toString("base64"),
    Buffer.alloc(33).toString("base64"),
    "not-base64!",
  ])("rejects an invalid encryption key", (invalidKey) => {
    process.env.REGISTRATION_DATA_ENCRYPTION_KEY = invalidKey;

    expect(() => encryptRegistrationText("Sensitive information")).toThrow(
      "REGISTRATION_DATA_ENCRYPTION_KEY must be a Base64-encoded 32-byte key.",
    );
  });
});

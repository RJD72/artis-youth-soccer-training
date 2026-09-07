import { createHash } from "node:crypto";

import { describe, expect, it } from "@jest/globals";

import {
  createGuardianVerificationToken,
  getGuardianVerificationTokenHash,
} from "@/lib/guardian-verification-token";
import {
  createRenewalVerificationToken,
  getRenewalVerificationTokenHash,
} from "@/lib/renewal-verification-token";

const tokenImplementations = [
  {
    label: "guardian verification",
    createToken: createGuardianVerificationToken,
    getTokenHash: getGuardianVerificationTokenHash,
  },
  {
    label: "renewal verification",
    createToken: createRenewalVerificationToken,
    getTokenHash: getRenewalVerificationTokenHash,
  },
] as const;

const creationDate = new Date("2026-09-07T12:00:00.000Z");
const expectedExpiryDate = new Date("2026-09-07T12:30:00.000Z");

describe.each(tokenImplementations)(
  "$label tokens",
  ({ createToken, getTokenHash }) => {
    it("creates a URL-safe 256-bit token and its SHA-256 hash", () => {
      const result = createToken(creationDate);
      const independentlyCalculatedHash = createHash("sha256")
        .update(result.token, "utf8")
        .digest("hex");

      expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(result.token, "base64url")).toHaveLength(32);
      expect(result.tokenHash).toBe(independentlyCalculatedHash);
      expect(result.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.expiresAt).toEqual(expectedExpiryDate);
    });

    it("creates a different random token each time", () => {
      const firstToken = createToken(creationDate);
      const secondToken = createToken(creationDate);

      expect(secondToken.token).not.toBe(firstToken.token);
      expect(secondToken.tokenHash).not.toBe(firstToken.tokenHash);
    });

    it("recreates the stored hash from a valid emailed token", () => {
      const result = createToken(creationDate);

      expect(getTokenHash(result.token)).toBe(result.tokenHash);
    });

    it.each([
      null,
      undefined,
      123,
      "",
      "a".repeat(42),
      "a".repeat(44),
      `${"a".repeat(42)}+`,
      `${"a".repeat(42)}=`,
      ` ${"a".repeat(42)}`,
    ])("rejects the malformed token %#", (value) => {
      expect(getTokenHash(value)).toBeNull();
    });

    it("rejects an invalid creation date", () => {
      expect(() => createToken(new Date("invalid"))).toThrow(
        "A valid token creation date is required.",
      );
    });
  },
);

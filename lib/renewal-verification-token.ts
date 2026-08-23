// This server-only helper creates the short-lived secret used in a returning
// player's email verification link. The raw token is emailed to the guardian,
// while only its SHA-256 hash is stored in MySQL.

import "server-only";

import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTE_LENGTH = 32;
const ENCODED_TOKEN_LENGTH = 43;
const TOKEN_LIFETIME_MILLISECONDS = 30 * 60 * 1_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type CreatedRenewalVerificationToken = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

function requireValidDate(value: Date): void {
  if (Number.isNaN(value.getTime())) {
    throw new TypeError("A valid token creation date is required.");
  }
}

function createTokenHash(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createRenewalVerificationToken(
  now: Date = new Date(),
): CreatedRenewalVerificationToken {
  requireValidDate(now);

  // Thirty-two random bytes provide 256 bits of entropy. Base64url encoding
  // keeps the token safe to place in a URL without additional escaping.
  const token = randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");

  if (token.length !== ENCODED_TOKEN_LENGTH || !TOKEN_PATTERN.test(token)) {
    throw new Error("The renewal verification token could not be created.");
  }

  return {
    token,
    tokenHash: createTokenHash(token),
    expiresAt: new Date(now.getTime() + TOKEN_LIFETIME_MILLISECONDS),
  };
}

export function getRenewalVerificationTokenHash(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length !== ENCODED_TOKEN_LENGTH ||
    !TOKEN_PATTERN.test(value)
  ) {
    return null;
  }

  return createTokenHash(value);
}

// This file creates and verifies short-lived confirmation references for
// waitlist submissions. The browser receives an entry ID, expiry time, and
// signature—not the child or guardian's personal information.

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const confirmationLifetimeSeconds = 60 * 60; // 1 hour

type WaitlistConfirmationReference = {
  entry: string;
  expires: string;
  signature: string;
};

function getSigningSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new TypeError(
      "BETTER_AUTH_SECRET is required to sign waitlist confirmations.",
    );
  }
  return secret;
}

function createSignature(entryId: number, expiresAt: number): string {
  return createHmac("sha256", getSigningSecret())
    .update(`${entryId}:${expiresAt}`)
    .digest("hex");
}

export function createWaitlistConfirmationReference(
  entryId: number,
): WaitlistConfirmationReference {
  if (!Number.isSafeInteger(entryId) || entryId <= 0) {
    throw new TypeError("A valid waitlist entry ID is required");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + confirmationLifetimeSeconds;

  return {
    entry: String(entryId),
    expires: String(expiresAt),
    signature: createSignature(entryId, expiresAt),
  };
}

export function verifyWaitlistConfirmationReference(
  entryValue: string,
  expiresValue: string,
  signatureValue: string,
): number | null {
  const entryId = Number(entryValue);
  const expiresAt = Number(expiresValue);

  if (
    !Number.isSafeInteger(entryId) ||
    entryId <= 0 ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000) ||
    !/^[a-f0-9]{64}$/.test(signatureValue)
  ) {
    return null;
  }

  const expectedSignature = Buffer.from(
    createSignature(entryId, expiresAt),
    "hex",
  );
  const suppliedSignature = Buffer.from(signatureValue, "hex");

  if (
    expectedSignature.length !== suppliedSignature.length ||
    !timingSafeEqual(expectedSignature, suppliedSignature)
  ) {
    return null;
  }

  return entryId;
}

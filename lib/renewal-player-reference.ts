// This signed, expiring reference prevents changes to the player ID in a
// renewal URL. It does not verify the visitor's identity or email address.

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type RenewalPlayerReference = {
  player: string;
  expires: string;
  signature: string;
};

const signingContext = "artis-renewal-player-reference:v1";
const referenceLifetimeSeconds = 60 * 60;
const maximumUnsignedInteger = 4_294_967_295;

function getSigningSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new TypeError(
      "BETTER_AUTH_SECRET is required to sign renewal player references.",
    );
  }

  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new TypeError(
      "BETTER_AUTH_SECRET must contain at least 32 bytes of unpredictable data.",
    );
  }

  return secret;
}

function isValidDatabaseId(value: number): boolean {
  return (
    Number.isSafeInteger(value) && value > 0 && value <= maximumUnsignedInteger
  );
}

function createSignature(playerId: number, expiresAt: number): string {
  const payload = [signingContext, playerId, expiresAt].join(".");

  return createHmac("sha256", getSigningSecret())
    .update(payload, "utf8")
    .digest("hex");
}

export function createRenewalPlayerReference(
  playerId: number,
): RenewalPlayerReference {
  if (!isValidDatabaseId(playerId)) {
    throw new TypeError("A valid player ID is required.");
  }

  const expiresAt = Math.floor(Date.now() / 1_000) + referenceLifetimeSeconds;

  return {
    player: String(playerId),
    expires: String(expiresAt),
    signature: createSignature(playerId, expiresAt),
  };
}

export function readRenewalPlayerReference(
  playerValue: string,
  expiresValue: string,
  signatureValue: string,
): { playerId: number } | null {
  const playerId = Number(playerValue);
  const expiresAt = Number(expiresValue);

  if (
    !isValidDatabaseId(playerId) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1_000) ||
    !/^[a-f0-9]{64}$/.test(signatureValue)
  ) {
    return null;
  }

  const expectedSignature = Buffer.from(
    createSignature(playerId, expiresAt),
    "hex",
  );
  const suppliedSignature = Buffer.from(signatureValue, "hex");

  if (
    expectedSignature.length !== suppliedSignature.length ||
    !timingSafeEqual(expectedSignature, suppliedSignature)
  ) {
    return null;
  }

  return { playerId };
}

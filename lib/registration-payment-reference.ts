// This server-only helper creates signed, expiring payment-page references.
// Numeric database IDs may appear in the URL, but the HMAC signature prevents
// a visitor from changing those IDs to access another registration or payment.

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type RegistrationPaymentMethod = "stripe" | "e_transfer";

export type RegistrationPaymentReference = {
  registration: string;
  payment: string;
  method: RegistrationPaymentMethod;
  expires: string;
  signature: string;
};

export type VerifiedRegistrationPaymentReference = {
  registrationId: number;
  paymentId: number;
  method: RegistrationPaymentMethod;
};

const signingContext = "artis-registration-payment-reference:v1";
const stripeReferenceLifetimeSeconds = 30 * 60;
const eTransferReferenceLifetimeSeconds = 24 * 60 * 60;
const maximumUnsignedInteger = 4_294_967_295;

function getSigningSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;

  if (!secret) {
    throw new TypeError(
      "BETTER_AUTH_SECRET is required to sign registration payment references.",
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

function isRegistrationPaymentMethod(
  value: string,
): value is RegistrationPaymentMethod {
  return value === "stripe" || value === "e_transfer";
}

function createSignature(
  registrationId: number,
  paymentId: number,
  method: RegistrationPaymentMethod,
  expiresAt: number,
): string {
  const payload = [
    signingContext,
    registrationId,
    paymentId,
    method,
    expiresAt,
  ].join(".");

  return createHmac("sha256", getSigningSecret())
    .update(payload, "utf8")
    .digest("hex");
}

export function createManualPaymentReference(paymentId: number): string {
  if (!isValidDatabaseId(paymentId)) {
    throw new TypeError("A valid payment ID is required.");
  }

  return `ARTIS-${paymentId}`;
}

export function createRegistrationPaymentReference(
  registrationId: number,
  paymentId: number,
  method: RegistrationPaymentMethod,
): RegistrationPaymentReference {
  if (!isValidDatabaseId(registrationId)) {
    throw new TypeError("A valid registration ID is required.");
  }

  if (!isValidDatabaseId(paymentId)) {
    throw new TypeError("A valid payment ID is required.");
  }

  if (!isRegistrationPaymentMethod(method)) {
    throw new TypeError("A valid payment method is required.");
  }

  const lifetimeSeconds =
    method === "stripe"
      ? stripeReferenceLifetimeSeconds
      : eTransferReferenceLifetimeSeconds;
  const expiresAt = Math.floor(Date.now() / 1_000) + lifetimeSeconds;

  return {
    registration: String(registrationId),
    payment: String(paymentId),
    method,
    expires: String(expiresAt),
    signature: createSignature(registrationId, paymentId, method, expiresAt),
  };
}

export function verifyRegistrationPaymentReference(
  registrationValue: string,
  paymentValue: string,
  methodValue: string,
  expiresValue: string,
  signatureValue: string,
): VerifiedRegistrationPaymentReference | null {
  const registrationId = Number(registrationValue);
  const paymentId = Number(paymentValue);
  const expiresAt = Number(expiresValue);

  if (
    !isValidDatabaseId(registrationId) ||
    !isValidDatabaseId(paymentId) ||
    !isRegistrationPaymentMethod(methodValue) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1_000) ||
    !/^[a-f0-9]{64}$/.test(signatureValue)
  ) {
    return null;
  }

  const expectedSignature = Buffer.from(
    createSignature(registrationId, paymentId, methodValue, expiresAt),
    "hex",
  );
  const suppliedSignature = Buffer.from(signatureValue, "hex");

  if (
    expectedSignature.length !== suppliedSignature.length ||
    !timingSafeEqual(expectedSignature, suppliedSignature)
  ) {
    return null;
  }

  return {
    registrationId,
    paymentId,
    method: methodValue,
  };
}

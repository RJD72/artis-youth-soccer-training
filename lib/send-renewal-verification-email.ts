// This server-only module sends a returning player's verification link through
// a predefined EmailJS template. Keeping EmailJS behind this function means the
// rest of the renewal flow will not need to change if the email provider does.

import "server-only";

import { getRenewalVerificationTokenHash } from "@/lib/renewal-verification-token";

const EMAILJS_SEND_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";
const EMAILJS_REQUEST_TIMEOUT_MILLISECONDS = 10_000;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const EMAILJS_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export type RenewalVerificationEmail = {
  guardianName: string;
  guardianEmail: string;
  playerName: string;
  token: string;
  expiresAt: Date;
};

type EmailJsConfiguration = {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey: string;
};

function getRequiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new TypeError(
      `${name} is missing. Check the project's .env.local file.`,
    );
  }

  return value;
}

function getEmailJsIdentifier(name: string): string {
  const value = getRequiredEnvironmentValue(name);

  if (!EMAILJS_IDENTIFIER_PATTERN.test(value)) {
    throw new TypeError(`${name} contains an invalid EmailJS identifier.`);
  }

  return value;
}

function getEmailJsConfiguration(): EmailJsConfiguration {
  return {
    serviceId: getEmailJsIdentifier("EMAILJS_SERVICE_ID"),
    templateId: getEmailJsIdentifier("EMAILJS_RENEWAL_TEMPLATE_ID"),
    publicKey: getEmailJsIdentifier("EMAILJS_PUBLIC_KEY"),
    privateKey: getEmailJsIdentifier("EMAILJS_PRIVATE_KEY"),
  };
}

function getApplicationOrigin(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ??
    process.env.BETTER_AUTH_URL?.trim();

  if (!configuredUrl) {
    throw new TypeError(
      "NEXT_PUBLIC_SITE_URL or BETTER_AUTH_URL is required for renewal links.",
    );
  }

  let url: URL;

  try {
    url = new URL(configuredUrl);
  } catch {
    throw new TypeError(
      "NEXT_PUBLIC_SITE_URL or BETTER_AUTH_URL must be a valid absolute URL.",
    );
  }

  const isLocalDevelopmentUrl =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");

  if (url.protocol !== "https:" && !isLocalDevelopmentUrl) {
    throw new TypeError(
      "The renewal verification URL must use HTTPS outside local development.",
    );
  }

  return url.origin;
}

function normalizeName(value: string, fieldName: string): string {
  const normalizedValue = value.trim().replace(/\s+/g, " ");

  if (
    normalizedValue.length < 2 ||
    normalizedValue.length > MAX_NAME_LENGTH ||
    /[\r\n]/.test(value)
  ) {
    throw new TypeError(`${fieldName} is invalid.`);
  }

  return normalizedValue;
}

function normalizeEmail(value: string): string {
  const normalizedEmail = value.trim().toLowerCase();

  if (
    normalizedEmail.length < 3 ||
    normalizedEmail.length > MAX_EMAIL_LENGTH ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    throw new TypeError("The guardian email address is invalid.");
  }

  return normalizedEmail;
}

function createRenewalVerificationUrl(token: string): string {
  if (getRenewalVerificationTokenHash(token) === null) {
    throw new TypeError("The renewal verification token is invalid.");
  }

  const verificationUrl = new URL(
    "/register/renew/verify",
    getApplicationOrigin(),
  );
  verificationUrl.searchParams.set("token", token);

  return verificationUrl.toString();
}

function getExpiryIsoString(expiresAt: Date): string {
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new TypeError("The renewal verification expiry is invalid.");
  }

  return expiresAt.toISOString();
}

export async function sendRenewalVerificationEmail(
  email: RenewalVerificationEmail,
): Promise<void> {
  const configuration = getEmailJsConfiguration();
  const requestBody = {
    service_id: configuration.serviceId,
    template_id: configuration.templateId,
    user_id: configuration.publicKey,
    accessToken: configuration.privateKey,
    template_params: {
      guardian_name: normalizeName(email.guardianName, "The guardian name"),
      guardian_email: normalizeEmail(email.guardianEmail),
      player_name: normalizeName(email.playerName, "The player name"),
      renewal_url: createRenewalVerificationUrl(email.token),
      expires_at: getExpiryIsoString(email.expiresAt),
      expires_in: "30 minutes",
    },
  };

  let response: Response;

  try {
    response = await fetch(EMAILJS_SEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(EMAILJS_REQUEST_TIMEOUT_MILLISECONDS),
    });
  } catch {
    throw new Error("The renewal verification email could not be sent.");
  }

  if (!response.ok) {
    // Do not include EmailJS's response body: provider errors can contain
    // account details that should not be exposed to the browser or logs.
    throw new Error("The renewal verification email could not be sent.");
  }
}

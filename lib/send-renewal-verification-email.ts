// Sends a returning player's private renewal link through Resend. The public
// function and input type stay provider-neutral so the renewal flow does not
// need to know which email service delivers the message.

import "server-only";

import RenewalVerificationEmail from "@/emails/renewal-verification-email";
import {
  getResendClient,
  getResendFromAddress,
  getResendRecipient,
} from "@/lib/email/resend";
import { getRenewalVerificationTokenHash } from "@/lib/renewal-verification-token";

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_SUBJECT = "Your ARTIS Soccer Academy renewal link";

export type RenewalVerificationEmail = {
  guardianName: string;
  guardianEmail: string;
  playerName: string;
  token: string;
  expiresAt: Date;
};

const torontoDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

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
    !EMAIL_PATTERN.test(normalizedEmail)
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

function getValidExpiry(expiresAt: Date): Date {
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new TypeError("The renewal verification expiry is invalid.");
  }

  return expiresAt;
}

function createPlainTextMessage(
  guardianName: string,
  playerName: string,
  renewalUrl: string,
  expiresAt: string,
): string {
  return [
    `Hello ${guardianName},`,
    "",
    `We received a request to review renewal options for ${playerName}.`,
    "",
    `Continue securely: ${renewalUrl}`,
    "",
    `This private, single-use link expires at ${expiresAt}.`,
    "",
    "If you did not request this email, you can safely ignore it. No changes will be made.",
    "",
    "ARTIS Soccer Academy",
  ].join("\n");
}

function getResendErrorSummary(error: unknown): {
  errorType: string;
  status?: number;
} {
  if (!error || typeof error !== "object") {
    return { errorType: "UnknownError" };
  }

  const errorRecord = error as Record<string, unknown>;
  const errorType =
    typeof errorRecord.name === "string" ? errorRecord.name : "UnknownError";
  const status =
    typeof errorRecord.statusCode === "number"
      ? errorRecord.statusCode
      : undefined;

  return status === undefined ? { errorType } : { errorType, status };
}

export async function sendRenewalVerificationEmail(
  email: RenewalVerificationEmail,
): Promise<void> {
  const guardianName = normalizeName(email.guardianName, "The guardian name");
  const guardianEmail = normalizeEmail(email.guardianEmail);
  const playerName = normalizeName(email.playerName, "The player name");
  const renewalUrl = createRenewalVerificationUrl(email.token);
  const expiresAt = torontoDateTimeFormatter.format(
    getValidExpiry(email.expiresAt),
  );

  let result: Awaited<
    ReturnType<ReturnType<typeof getResendClient>["emails"]["send"]>
  >;

  try {
    result = await getResendClient().emails.send({
      from: getResendFromAddress(),
      to: getResendRecipient(guardianEmail),
      subject: EMAIL_SUBJECT,
      react: RenewalVerificationEmail({
        guardianName,
        playerName,
        renewalUrl,
        expiresAt,
      }),
      text: createPlainTextMessage(
        guardianName,
        playerName,
        renewalUrl,
        expiresAt,
      ),
    });
  } catch (error) {
    console.error(
      "Resend renewal verification request failed before receiving a response.",
      getResendErrorSummary(error),
    );

    throw new Error("The renewal verification email could not be sent.");
  }

  if (result.error) {
    // Never log the raw provider message: it may include recipient or account
    // details. The error category and status are enough for diagnosis.
    console.error(
      "Resend rejected the renewal verification email.",
      getResendErrorSummary(result.error),
    );

    throw new Error("The renewal verification email could not be sent.");
  }
}

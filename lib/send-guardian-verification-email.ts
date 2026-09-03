// Sends the private guardian-verification link through Resend. The public
// function and input type remain provider-neutral so the registration flow
// does not need to know which email service delivers the message.

import "server-only";

import GuardianVerificationEmail from "@/emails/guardian-verification-email";
import {
  getResendClient,
  getResendFromAddress,
  getResendRecipient,
} from "@/lib/email/resend";
import { getGuardianVerificationTokenHash } from "@/lib/guardian-verification-token";

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_SUBJECT = "Verify your email for ARTIS Soccer Academy";

export type GuardianVerificationEmailMessage = {
  guardianName: string;
  guardianEmail: string;
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
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim();

  if (!configuredUrl) {
    throw new TypeError(
      "NEXT_PUBLIC_SITE_URL or BETTER_AUTH_URL is required for guardian verification links.",
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
      "The guardian verification URL must use HTTPS outside local development.",
    );
  }

  return url.origin;
}

function normalizeName(value: string): string {
  const normalizedValue = value.trim().replace(/\s+/g, " ");

  if (
    normalizedValue.length < 2 ||
    normalizedValue.length > MAX_NAME_LENGTH ||
    /[\r\n]/.test(value)
  ) {
    throw new TypeError("The guardian name is invalid.");
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

function createGuardianVerificationUrl(token: string): string {
  if (getGuardianVerificationTokenHash(token) === null) {
    throw new TypeError("The guardian verification token is invalid.");
  }

  const verificationUrl = new URL(
    "/register/verify-guardian/complete",
    getApplicationOrigin(),
  );
  verificationUrl.searchParams.set("token", token);

  return verificationUrl.toString();
}

function getValidExpiry(expiresAt: Date): Date {
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new TypeError("The guardian verification expiry is invalid.");
  }

  return expiresAt;
}

function createPlainTextMessage(
  guardianName: string,
  verificationUrl: string,
  expiresAt: string,
): string {
  return [
    `Hello ${guardianName},`,
    "",
    "We received a request to use this email address for another ARTIS Soccer Academy player registration.",
    "",
    `Verify your email and continue: ${verificationUrl}`,
    "",
    `This private, single-use link expires at ${expiresAt}.`,
    "",
    "If you did not request this email, you can safely ignore it. No registration will be created and no existing family information will be changed.",
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

export async function sendGuardianVerificationEmail(
  message: GuardianVerificationEmailMessage,
): Promise<void> {
  const guardianName = normalizeName(message.guardianName);
  const guardianEmail = normalizeEmail(message.guardianEmail);
  const verificationUrl = createGuardianVerificationUrl(message.token);
  const expiresAt = torontoDateTimeFormatter.format(
    getValidExpiry(message.expiresAt),
  );

  let result: Awaited<
    ReturnType<ReturnType<typeof getResendClient>["emails"]["send"]>
  >;

  try {
    result = await getResendClient().emails.send({
      from: getResendFromAddress(),
      to: getResendRecipient(guardianEmail),
      subject: EMAIL_SUBJECT,
      react: GuardianVerificationEmail({
        guardianName,
        verificationUrl,
        expiresAt,
      }),
      text: createPlainTextMessage(guardianName, verificationUrl, expiresAt),
    });
  } catch (error) {
    console.error(
      "Resend guardian verification request failed before receiving a response.",
      getResendErrorSummary(error),
    );

    throw new Error("The guardian verification email could not be sent.");
  }

  if (result.error) {
    // Never log the raw provider message because it may include recipient or
    // account details. The error category and status are enough for diagnosis.
    console.error(
      "Resend rejected the guardian verification email.",
      getResendErrorSummary(result.error),
    );

    throw new Error("The guardian verification email could not be sent.");
  }
}

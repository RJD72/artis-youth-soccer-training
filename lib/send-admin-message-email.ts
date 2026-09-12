import "server-only";

import AdminMessageEmail from "@/emails/admin-message-email";
import {
  getResendClient,
  getResendFromAddress,
  getResendRecipient,
} from "@/lib/email/resend";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_SUBJECT_LENGTH = 150;
const MIN_SUBJECT_LENGTH = 2;
const MAX_MESSAGE_LENGTH = 5_000;
const MIN_MESSAGE_LENGTH = 2;

export type AdminMessageEmailInput = {
  guardianName: string;
  guardianEmail: string;
  subject: string;
  message: string;
};

type NormalizedAdminMessage = {
  guardianName: string;
  guardianEmail: string;
  subject: string;
  message: string;
};

function normalizeName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (
    normalized.length < 2 ||
    normalized.length > MAX_NAME_LENGTH ||
    /[\r\n]/.test(value) ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new TypeError("The guardian name is invalid.");
  }

  return normalized;
}

function normalizeEmail(value: string, fieldName: string): string {
  const normalized = value.trim().toLowerCase();

  if (
    normalized.length < 3 ||
    normalized.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(normalized)
  ) {
    throw new TypeError(`${fieldName} is invalid.`);
  }

  return normalized;
}

function normalizeSubject(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (
    normalized.length < MIN_SUBJECT_LENGTH ||
    normalized.length > MAX_SUBJECT_LENGTH ||
    /[\r\n]/.test(value) ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new TypeError("The email subject is invalid.");
  }

  return normalized;
}

function normalizeMessage(value: string): string {
  const normalized = value.replace(/\r\n?/g, "\n").trim();

  if (
    normalized.length < MIN_MESSAGE_LENGTH ||
    normalized.length > MAX_MESSAGE_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(normalized)
  ) {
    throw new TypeError("The email message is invalid.");
  }

  return normalized;
}

function getAcademyReplyToAddress(): string {
  const value = process.env.CONTACT_FORM_RECIPIENT_EMAIL?.trim();

  if (!value) {
    throw new TypeError(
      "CONTACT_FORM_RECIPIENT_EMAIL is required for administrator messages.",
    );
  }

  return normalizeEmail(value, "The academy reply-to email address");
}

function normalizeAdminMessage(
  input: AdminMessageEmailInput,
): NormalizedAdminMessage {
  return {
    guardianName: normalizeName(input.guardianName),
    guardianEmail: normalizeEmail(
      input.guardianEmail,
      "The guardian email address",
    ),
    subject: normalizeSubject(input.subject),
    message: normalizeMessage(input.message),
  };
}

function createPlainTextMessage(details: NormalizedAdminMessage): string {
  return [
    `Hello ${details.guardianName},`,
    "",
    details.message,
    "",
    "If you have questions, reply to this email and ARTIS Soccer Academy will assist you.",
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

export async function sendAdminMessageEmail(
  input: AdminMessageEmailInput,
): Promise<void> {
  const details = normalizeAdminMessage(input);

  let result: Awaited<
    ReturnType<ReturnType<typeof getResendClient>["emails"]["send"]>
  >;

  try {
    result = await getResendClient().emails.send({
      from: getResendFromAddress(),
      to: getResendRecipient(details.guardianEmail),
      replyTo: getAcademyReplyToAddress(),
      subject: details.subject,
      react: AdminMessageEmail({
        guardianName: details.guardianName,
        subject: details.subject,
        message: details.message,
      }),
      text: createPlainTextMessage(details),
    });
  } catch (error) {
    console.error(
      "Resend administrator-message request failed before receiving a response.",
      getResendErrorSummary(error),
    );

    throw new Error("The administrator message could not be sent.");
  }

  if (result.error) {
    console.error(
      "Resend rejected the administrator message.",
      getResendErrorSummary(result.error),
    );

    throw new Error("The administrator message could not be sent.");
  }
}

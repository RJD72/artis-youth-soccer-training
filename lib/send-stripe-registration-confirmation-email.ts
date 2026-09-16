// Sends an ARTIS registration confirmation after a Stripe card payment
// has been successfully verified and recorded.
//
// Stripe sends the financial receipt separately. This email confirms the
// player's ARTIS Soccer Academy registration.

import "server-only";

import StripeRegistrationConfirmationEmail from "@/emails/stripe-registration-confirmation-email";
import {
  getResendClient,
  getResendFromAddress,
  getResendRecipient,
} from "@/lib/email/resend";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MAX_NAME_LENGTH = 100;
const MAX_LABEL_LENGTH = 150;
const MAX_EMAIL_LENGTH = 254;

const EMAIL_SUBJECT = "Your ARTIS Soccer Academy registration is confirmed";

export type StripeRegistrationConfirmation = Readonly<{
  registrationId: number;
  guardianName: string;
  guardianEmail: string;
  playerName: string;
  trainingGroupName: string;
  programPackageName: string;
  startsOn: string;
  endsOn: string;
  registrationStatus: "scheduled" | "active";
}>;

type FormattedConfirmation = Readonly<{
  guardianName: string;
  guardianEmail: string;
  playerName: string;
  trainingGroupName: string;
  programPackageName: string;
  registrationId: string;
  trainingDates: string;
  registrationStatus: string;
}>;

const calendarDateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function normalizeText(
  value: string,
  fieldName: string,
  maximumLength: number,
): string {
  const normalizedValue = value.trim().replace(/\s+/g, " ");

  if (
    normalizedValue.length < 2 ||
    normalizedValue.length > maximumLength ||
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

function getRegistrationId(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError("The registration ID is invalid.");
  }

  return String(value);
}

function getCalendarDate(value: string, fieldName: string): Date {
  if (!CALENDAR_DATE_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} is invalid.`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  const dateIsExact =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!dateIsExact) {
    throw new TypeError(`${fieldName} is invalid.`);
  }

  return date;
}

function formatTrainingDates(startsOn: string, endsOn: string): string {
  const startDate = getCalendarDate(startsOn, "The training start date");
  const endDate = getCalendarDate(endsOn, "The training end date");

  if (endDate.getTime() < startDate.getTime()) {
    throw new TypeError("The training date range is invalid.");
  }

  return `${calendarDateFormatter.format(startDate)} – ${calendarDateFormatter.format(endDate)}`;
}

function formatRegistrationStatus(status: "scheduled" | "active"): string {
  return status === "active" ? "Active" : "Scheduled";
}

function formatConfirmation(
  confirmation: StripeRegistrationConfirmation,
): FormattedConfirmation {
  return {
    guardianName: normalizeText(
      confirmation.guardianName,
      "The guardian name",
      MAX_NAME_LENGTH,
    ),

    guardianEmail: normalizeEmail(confirmation.guardianEmail),

    playerName: normalizeText(
      confirmation.playerName,
      "The player name",
      MAX_NAME_LENGTH,
    ),

    trainingGroupName: normalizeText(
      confirmation.trainingGroupName,
      "The training group name",
      MAX_LABEL_LENGTH,
    ),

    programPackageName: normalizeText(
      confirmation.programPackageName,
      "The package name",
      MAX_LABEL_LENGTH,
    ),

    registrationId: getRegistrationId(confirmation.registrationId),

    trainingDates: formatTrainingDates(
      confirmation.startsOn,
      confirmation.endsOn,
    ),

    registrationStatus: formatRegistrationStatus(
      confirmation.registrationStatus,
    ),
  };
}

function createPlainTextMessage(details: FormattedConfirmation): string {
  return [
    `Hello ${details.guardianName},`,
    "",
    `Payment has been received and ${details.playerName}'s registration with ARTIS Soccer Academy is confirmed.`,
    "",
    `Registration status: ${details.registrationStatus}`,
    `Training group: ${details.trainingGroupName}`,
    `Package: ${details.programPackageName}`,
    `Training dates: ${details.trainingDates}`,
    `Registration number: ${details.registrationId}`,
    "",
    "Stripe will send a separate receipt for your card payment.",
    "Please keep this email for your registration records.",
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

export async function sendStripeRegistrationConfirmationEmail(
  confirmation: StripeRegistrationConfirmation,
): Promise<void> {
  const details = formatConfirmation(confirmation);

  let result: Awaited<
    ReturnType<ReturnType<typeof getResendClient>["emails"]["send"]>
  >;

  try {
    result = await getResendClient().emails.send(
      {
        from: getResendFromAddress(),
        to: getResendRecipient(details.guardianEmail),
        subject: EMAIL_SUBJECT,
        react: StripeRegistrationConfirmationEmail(details),
        text: createPlainTextMessage(details),
      },
      {
        idempotencyKey: `stripe-registration-confirmation/${details.registrationId}`,
      },
    );
  } catch (error) {
    console.error(
      "Resend Stripe registration confirmation request failed before receiving a response.",
      getResendErrorSummary(error),
    );

    throw new Error(
      "The Stripe registration confirmation email could not be sent.",
    );
  }

  if (result.error) {
    console.error(
      "Resend rejected the Stripe registration confirmation email.",
      getResendErrorSummary(result.error),
    );

    throw new Error(
      "The Stripe registration confirmation email could not be sent.",
    );
  }
}

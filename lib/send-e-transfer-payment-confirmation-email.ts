// Sends an e-transfer confirmation after an administrator verifies payment.
// The exported type and function stay provider-neutral so the admin action does
// not need to know that Resend delivers the message.

import "server-only";

import ETransferConfirmationEmail from "@/emails/e-transfer-confirmation-email";
import {
  getResendClient,
  getResendFromAddress,
  getResendRecipient,
} from "@/lib/email/resend";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_REFERENCE_PATTERN = /^[A-Za-z0-9-]{1,50}$/;
const MAX_NAME_LENGTH = 100;
const MAX_LABEL_LENGTH = 150;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_SUBJECT = "Your ARTIS Soccer Academy payment confirmation";

export type ETransferPaymentConfirmationEmail = {
  registrationId: number;
  guardianName: string;
  guardianEmail: string;
  playerName: string;
  trainingGroupName: string;
  programPackageName: string;
  amountCents: number;
  currency: string;
  paymentReference: string;
  paidAt: Date;
  startsOn: string;
  endsOn: string;
  registrationStatus: "scheduled" | "active";
};

type FormattedConfirmation = {
  guardianName: string;
  guardianEmail: string;
  playerName: string;
  trainingGroupName: string;
  programPackageName: string;
  registrationId: string;
  paymentReference: string;
  amount: string;
  paidAt: string;
  trainingDates: string;
  registrationStatus: string;
};

const torontoDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

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

function normalizePaymentReference(value: string): string {
  const normalizedReference = value.trim().toUpperCase();

  if (!PAYMENT_REFERENCE_PATTERN.test(normalizedReference)) {
    throw new TypeError("The e-transfer payment reference is invalid.");
  }

  return normalizedReference;
}

function getCurrency(value: string): string {
  const currency = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new TypeError("The payment currency is invalid.");
  }

  return currency;
}

function formatAmount(amountCents: number, currencyValue: string): string {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new TypeError("The payment amount is invalid.");
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: getCurrency(currencyValue),
  }).format(amountCents / 100);
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

function formatPaidAt(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    throw new TypeError("The payment confirmation date is invalid.");
  }

  return torontoDateTimeFormatter.format(value);
}

function formatRegistrationStatus(status: "scheduled" | "active"): string {
  return status === "active" ? "Active" : "Scheduled";
}

function formatConfirmation(
  email: ETransferPaymentConfirmationEmail,
): FormattedConfirmation {
  return {
    guardianName: normalizeText(
      email.guardianName,
      "The guardian name",
      MAX_NAME_LENGTH,
    ),
    guardianEmail: normalizeEmail(email.guardianEmail),
    playerName: normalizeText(
      email.playerName,
      "The player name",
      MAX_NAME_LENGTH,
    ),
    trainingGroupName: normalizeText(
      email.trainingGroupName,
      "The training group name",
      MAX_LABEL_LENGTH,
    ),
    programPackageName: normalizeText(
      email.programPackageName,
      "The package name",
      MAX_LABEL_LENGTH,
    ),
    registrationId: getRegistrationId(email.registrationId),
    paymentReference: normalizePaymentReference(email.paymentReference),
    amount: formatAmount(email.amountCents, email.currency),
    paidAt: formatPaidAt(email.paidAt),
    trainingDates: formatTrainingDates(email.startsOn, email.endsOn),
    registrationStatus: formatRegistrationStatus(email.registrationStatus),
  };
}

function createPlainTextMessage(details: FormattedConfirmation): string {
  return [
    `Hello ${details.guardianName},`,
    "",
    `ARTIS Soccer Academy has received and verified your e-transfer payment for ${details.playerName}.`,
    "",
    `Registration status: ${details.registrationStatus}`,
    `Training group: ${details.trainingGroupName}`,
    `Package: ${details.programPackageName}`,
    `Training dates: ${details.trainingDates}`,
    `Amount paid: ${details.amount}`,
    `Payment reference: ${details.paymentReference}`,
    `Payment confirmed: ${details.paidAt}`,
    `Registration number: ${details.registrationId}`,
    "",
    "Please keep this email for your records.",
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

export async function sendETransferPaymentConfirmationEmail(
  email: ETransferPaymentConfirmationEmail,
): Promise<void> {
  const details = formatConfirmation(email);
  let result: Awaited<
    ReturnType<ReturnType<typeof getResendClient>["emails"]["send"]>
  >;

  try {
    result = await getResendClient().emails.send({
      from: getResendFromAddress(),
      to: getResendRecipient(details.guardianEmail),
      subject: EMAIL_SUBJECT,
      react: ETransferConfirmationEmail(details),
      text: createPlainTextMessage(details),
    });
  } catch (error) {
    console.error(
      "Resend e-transfer confirmation request failed before receiving a response.",
      getResendErrorSummary(error),
    );

    throw new Error("The e-transfer confirmation email could not be sent.");
  }

  if (result.error) {
    // Never log the raw provider message: it may include recipient or account
    // details. The error category and status are enough for diagnosis.
    console.error(
      "Resend rejected the e-transfer confirmation email.",
      getResendErrorSummary(result.error),
    );

    throw new Error("The e-transfer confirmation email could not be sent.");
  }
}

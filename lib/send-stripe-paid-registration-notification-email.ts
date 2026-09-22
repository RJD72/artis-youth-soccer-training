// Sends ARTIS an internal notification after a Stripe payment has already
// been verified and recorded as succeeded. Only trusted database values from
// the confirmed-registration workflow are accepted by this sender.

import "server-only";

import StripePaidRegistrationNotificationEmail, {
  type StripePaidRegistrationNotificationEmailProps,
} from "@/emails/stripe-paid-registration-notification-email";
import {
  getResendClient,
  getResendFromAddress,
  getResendRecipient,
} from "@/lib/email/resend";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()0-9.\-\sA-Za-z]{7,30}$/;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NAME_LENGTH = 100;
const MAX_LABEL_LENGTH = 150;
const MAX_EMAIL_LENGTH = 254;
const PAYMENT_METHOD = "Credit card / Stripe";
const EMAIL_SUBJECT_PREFIX = "New paid Stripe registration";

export type StripePaidRegistrationNotification = Readonly<{
  registrationId: number;
  playerName: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  trainingGroupName: string;
  programPackageName: string;
  amountCents: number;
  currency: string;
  startsOn: string;
  endsOn: string;
}>;

type FormattedNotification = StripePaidRegistrationNotificationEmailProps;

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

function normalizeEmail(value: string, fieldName: string): string {
  const normalizedEmail = value.trim().toLowerCase();

  if (
    normalizedEmail.length < 3 ||
    normalizedEmail.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    throw new TypeError(`${fieldName} is invalid.`);
  }

  return normalizedEmail;
}

function normalizePhone(value: string): string {
  const normalizedPhone = value.trim().replace(/\s+/g, " ");

  if (!PHONE_PATTERN.test(normalizedPhone)) {
    throw new TypeError("The guardian phone number is invalid.");
  }

  return normalizedPhone;
}

function getRegistrationId(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError("The registration ID is invalid.");
  }

  return String(value);
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

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
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

function formatNotification(
  notification: StripePaidRegistrationNotification,
): FormattedNotification {
  return {
    registrationId: getRegistrationId(notification.registrationId),
    playerName: normalizeText(
      notification.playerName,
      "The player name",
      MAX_NAME_LENGTH,
    ),
    guardianName: normalizeText(
      notification.guardianName,
      "The guardian name",
      MAX_NAME_LENGTH,
    ),
    guardianEmail: normalizeEmail(
      notification.guardianEmail,
      "The guardian email",
    ),
    guardianPhone: normalizePhone(notification.guardianPhone),
    trainingGroupName: normalizeText(
      notification.trainingGroupName,
      "The training group name",
      MAX_LABEL_LENGTH,
    ),
    programPackageName: normalizeText(
      notification.programPackageName,
      "The package name",
      MAX_LABEL_LENGTH,
    ),
    amount: formatAmount(notification.amountCents, notification.currency),
    trainingDates: formatTrainingDates(
      notification.startsOn,
      notification.endsOn,
    ),
    paymentMethod: PAYMENT_METHOD,
  };
}

function getAcademyNotificationRecipient(): string {
  const configuredRecipient =
    process.env.STRIPE_REGISTRATION_NOTIFICATION_EMAIL?.trim() ||
    process.env.E_TRANSFER_NOTIFICATION_EMAIL?.trim() ||
    process.env.CONTACT_FORM_RECIPIENT_EMAIL?.trim();

  if (!configuredRecipient) {
    throw new TypeError(
      "STRIPE_REGISTRATION_NOTIFICATION_EMAIL, E_TRANSFER_NOTIFICATION_EMAIL, or CONTACT_FORM_RECIPIENT_EMAIL is required.",
    );
  }

  return getResendRecipient(
    normalizeEmail(configuredRecipient, "The academy notification email"),
  );
}

function createPlainTextMessage(details: FormattedNotification): string {
  return [
    "A Stripe payment has been verified and the registration is confirmed.",
    "",
    "Payment status: Paid",
    "",
    `Player: ${details.playerName}`,
    `Guardian: ${details.guardianName}`,
    `Guardian email: ${details.guardianEmail}`,
    `Guardian phone: ${details.guardianPhone}`,
    `Training group: ${details.trainingGroupName}`,
    `Package: ${details.programPackageName}`,
    `Amount paid: ${details.amount}`,
    `Training dates: ${details.trainingDates}`,
    `Registration number: ${details.registrationId}`,
    `Payment method: ${details.paymentMethod}`,
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

export async function sendStripePaidRegistrationNotificationEmail(
  notification: StripePaidRegistrationNotification,
): Promise<void> {
  const details = formatNotification(notification);
  let result: Awaited<
    ReturnType<ReturnType<typeof getResendClient>["emails"]["send"]>
  >;

  try {
    result = await getResendClient().emails.send(
      {
        from: getResendFromAddress(),
        to: getAcademyNotificationRecipient(),
        replyTo: details.guardianEmail,
        subject: `${EMAIL_SUBJECT_PREFIX}: ${details.playerName}`,
        react: StripePaidRegistrationNotificationEmail(details),
        text: createPlainTextMessage(details),
      },
      {
        idempotencyKey: `stripe-paid-registration-notification/${details.registrationId}`,
      },
    );
  } catch (error) {
    console.error(
      "Resend Stripe paid-registration notification failed before receiving a response.",
      getResendErrorSummary(error),
    );

    throw new Error(
      "The Stripe paid-registration notification email could not be sent.",
    );
  }

  if (result.error) {
    console.error(
      "Resend rejected the Stripe paid-registration notification email.",
      getResendErrorSummary(result.error),
    );

    throw new Error(
      "The Stripe paid-registration notification email could not be sent.",
    );
  }
}

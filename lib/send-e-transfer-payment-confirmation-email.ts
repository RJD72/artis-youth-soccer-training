// Sends a payment-confirmation email after an administrator verifies an
// e-transfer. EmailJS credentials remain server-only, and every value sent to
// the template is validated before the external request is made.

import "server-only";

const EMAILJS_SEND_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";
const EMAILJS_REQUEST_TIMEOUT_MILLISECONDS = 10_000;
const EMAILJS_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PAYMENT_REFERENCE_PATTERN = /^[A-Za-z0-9-]{1,50}$/;
const MAX_NAME_LENGTH = 100;
const MAX_LABEL_LENGTH = 150;
const MAX_EMAIL_LENGTH = 254;

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

type EmailJsConfiguration = {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey: string;
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

function getRequiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new TypeError(`${name} is missing. Check project's .env.local file`);
  }
  return value;
}

function getEmailJsIdentifier(name: string): string {
  const value = getRequiredEnvironmentValue(name);

  if (!EMAILJS_IDENTIFIER_PATTERN.test(value)) {
    throw new TypeError(`${name} is not a valid EmailJS identifier`);
  }
  return value;
}

function getEmailJsConfiguration(): EmailJsConfiguration {
  return {
    serviceId: getEmailJsIdentifier("EMAILJS_SERVICE_ID"),
    templateId: getEmailJsIdentifier(
      "EMAILJS_E_TRANSFER_CONFIRMATION_TEMPLATE_ID",
    ),
    publicKey: getEmailJsIdentifier("EMAILJS_PUBLIC_KEY"),
    privateKey: getRequiredEnvironmentValue("EMAILJS_PRIVATE_KEY"),
  };
}

function normalizeText(
  value: string,
  fieldName: string,
  maximumLength: number,
): string {
  const normaliedValue = value.trim().replace(/\s+/g, " ");

  if (
    normaliedValue.length < 2 ||
    normaliedValue.length > maximumLength ||
    /[\r\n]/.test(value)
  ) {
    throw new TypeError(`${fieldName} is invalid`);
  }
  return normaliedValue;
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

  const currency = getCurrency(currencyValue);

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
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

export async function sendETransferPaymentConfirmationEmail(
  email: ETransferPaymentConfirmationEmail,
): Promise<void> {
  const configuration = getEmailJsConfiguration();
  const requestBody = {
    service_id: configuration.serviceId,
    template_id: configuration.templateId,
    user_id: configuration.publicKey,
    accessToken: configuration.privateKey,
    template_params: {
      guardian_name: normalizeText(
        email.guardianName,
        "The guardian name",
        MAX_NAME_LENGTH,
      ),
      guardian_email: normalizeEmail(email.guardianEmail),
      player_name: normalizeText(
        email.playerName,
        "The player name",
        MAX_NAME_LENGTH,
      ),
      training_group: normalizeText(
        email.trainingGroupName,
        "The training group name",
        MAX_LABEL_LENGTH,
      ),
      package_name: normalizeText(
        email.programPackageName,
        "The package name",
        MAX_LABEL_LENGTH,
      ),
      registration_id: getRegistrationId(email.registrationId),
      payment_method: "E-transfer",
      payment_reference: normalizePaymentReference(email.paymentReference),
      amount: formatAmount(email.amountCents, email.currency),
      paid_at: formatPaidAt(email.paidAt),
      training_dates: formatTrainingDates(email.startsOn, email.endsOn),
      registration_status: formatRegistrationStatus(email.registrationStatus),
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
    throw new Error("The e-transfer confirmation email could not be sent.");
  }

  if (!response.ok) {
    // Provider responses can contain account details. Do not copy their body
    // into browser errors or application logs.
    throw new Error("The e-transfer confirmation email could not be sent.");
  }
}

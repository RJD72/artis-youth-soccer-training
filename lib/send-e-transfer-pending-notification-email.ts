// Sends ARTIS an internal notice when a registration chooses e-transfer.
// Trusted details are loaded from the database instead of being accepted from
// the browser, and the message never claims that payment has been received.

import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  guardians,
  payments,
  players,
  programPackages,
  registrations,
  trainingGroups,
} from "@/db/schema";
import ETransferPendingNotificationEmail, {
  type ETransferPendingNotificationEmailProps,
} from "@/emails/e-transfer-pending-notification-email";
import {
  getResendClient,
  getResendFromAddress,
  getResendRecipient,
} from "@/lib/email/resend";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()0-9.\-\sA-Za-z]{7,30}$/;
const PAYMENT_REFERENCE_PATTERN = /^[A-Za-z0-9-]{1,50}$/;
const MAX_NAME_LENGTH = 100;
const MAX_LABEL_LENGTH = 150;
const MAX_EMAIL_LENGTH = 254;
const EMAIL_SUBJECT_PREFIX = "New e-transfer registration awaiting payment";

type PendingNotificationDetails = ETransferPendingNotificationEmailProps;

const torontoDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

function getDatabaseId(value: number, fieldName: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${fieldName} is invalid.`);
  }

  return value;
}

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

function formatReservationExpiry(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    throw new TypeError("The reservation expiry is invalid.");
  }

  return torontoDateTimeFormatter.format(value);
}

function getAcademyNotificationRecipient(): string {
  const configuredRecipient =
    process.env.E_TRANSFER_NOTIFICATION_EMAIL?.trim() ||
    process.env.CONTACT_FORM_RECIPIENT_EMAIL?.trim();

  if (!configuredRecipient) {
    throw new TypeError(
      "E_TRANSFER_NOTIFICATION_EMAIL or CONTACT_FORM_RECIPIENT_EMAIL is required.",
    );
  }

  return getResendRecipient(
    normalizeEmail(configuredRecipient, "The academy notification email"),
  );
}

async function getPendingNotificationDetails(
  registrationIdValue: number,
  paymentIdValue: number,
): Promise<PendingNotificationDetails> {
  const registrationId = getDatabaseId(
    registrationIdValue,
    "The registration ID",
  );
  const paymentId = getDatabaseId(paymentIdValue, "The payment ID");
  const [record] = await db
    .select({
      registrationId: registrations.id,
      reservationExpiresAt: registrations.reservationExpiresAt,
      playerName: players.fullName,
      guardianName: guardians.fullName,
      guardianEmail: guardians.email,
      guardianPhone: guardians.phone,
      trainingGroupName: trainingGroups.displayName,
      programPackageName: programPackages.displayName,
      amountCents: payments.totalCents,
      currency: payments.currency,
      paymentReference: payments.manualPaymentReference,
    })
    .from(registrations)
    .innerJoin(players, eq(registrations.playerId, players.id))
    .innerJoin(guardians, eq(players.guardianId, guardians.id))
    .innerJoin(
      trainingGroups,
      eq(registrations.trainingGroupId, trainingGroups.id),
    )
    .innerJoin(
      programPackages,
      eq(registrations.programPackageId, programPackages.id),
    )
    .innerJoin(
      payments,
      and(
        eq(payments.id, paymentId),
        eq(payments.registrationId, registrations.id),
      ),
    )
    .where(
      and(
        eq(registrations.id, registrationId),
        eq(registrations.status, "pending_payment"),
        eq(payments.status, "pending"),
        eq(payments.paymentMethod, "e_transfer"),
      ),
    )
    .limit(1);

  if (!record?.paymentReference || !record.reservationExpiresAt) {
    throw new Error("The pending e-transfer registration could not be found.");
  }

  return {
    playerName: normalizeText(
      record.playerName,
      "The player name",
      MAX_NAME_LENGTH,
    ),
    guardianName: normalizeText(
      record.guardianName,
      "The guardian name",
      MAX_NAME_LENGTH,
    ),
    guardianEmail: normalizeEmail(record.guardianEmail, "The guardian email"),
    guardianPhone: normalizePhone(record.guardianPhone),
    trainingGroupName: normalizeText(
      record.trainingGroupName,
      "The training group name",
      MAX_LABEL_LENGTH,
    ),
    programPackageName: normalizeText(
      record.programPackageName,
      "The package name",
      MAX_LABEL_LENGTH,
    ),
    registrationId: String(record.registrationId),
    paymentReference: normalizePaymentReference(record.paymentReference),
    amount: formatAmount(record.amountCents, record.currency),
    reservationExpiresAt: formatReservationExpiry(record.reservationExpiresAt),
  };
}

function createPlainTextMessage(details: PendingNotificationDetails): string {
  return [
    "A parent or guardian selected e-transfer for a new registration.",
    "",
    "Payment status: Awaiting e-transfer",
    "This email does not confirm that payment was received.",
    "",
    `Player: ${details.playerName}`,
    `Guardian: ${details.guardianName}`,
    `Guardian email: ${details.guardianEmail}`,
    `Guardian phone: ${details.guardianPhone}`,
    `Training group: ${details.trainingGroupName}`,
    `Package: ${details.programPackageName}`,
    `Amount due: ${details.amount}`,
    `Payment reference: ${details.paymentReference}`,
    `Reservation expires: ${details.reservationExpiresAt}`,
    `Registration number: ${details.registrationId}`,
    "",
    "Match the payment reference against the bank notification before confirming the payment in Admin Registrations.",
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

export async function sendETransferPendingNotificationEmail(
  registrationId: number,
  paymentId: number,
): Promise<void> {
  const details = await getPendingNotificationDetails(
    registrationId,
    paymentId,
  );
  let result: Awaited<
    ReturnType<ReturnType<typeof getResendClient>["emails"]["send"]>
  >;

  try {
    result = await getResendClient().emails.send({
      from: getResendFromAddress(),
      to: getAcademyNotificationRecipient(),
      replyTo: details.guardianEmail,
      subject: `${EMAIL_SUBJECT_PREFIX}: ${details.paymentReference}`,
      react: ETransferPendingNotificationEmail(details),
      text: createPlainTextMessage(details),
    });
  } catch (error) {
    console.error(
      "Resend e-transfer notification failed before receiving a response.",
      getResendErrorSummary(error),
    );

    throw new Error("The e-transfer notification email could not be sent.");
  }

  if (result.error) {
    // Never log the raw response because it can contain private registration
    // information. The provider category and status are enough to diagnose it.
    console.error(
      "Resend rejected the e-transfer notification email.",
      getResendErrorSummary(result.error),
    );

    throw new Error("The e-transfer notification email could not be sent.");
  }
}

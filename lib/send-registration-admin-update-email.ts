// Sends a guardian notification after an administrator cancels a registration
// or changes its training dates. The caller supplies trusted database values.

import "server-only";

import RegistrationAdminUpdateEmail, {
  type RegistrationAdminUpdateEmailProps,
} from "@/emails/registration-admin-update-email";
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

type RegistrationAdminUpdateEmailBaseMessage = {
  registrationId: number;
  guardianName: string;
  guardianEmail: string;
  playerName: string;
  trainingGroupName: string;
};

type RegistrationCancelledEmailMessage =
  RegistrationAdminUpdateEmailBaseMessage & {
    updateType: "cancelled";
  };

type RegistrationRescheduledEmailMessage =
  RegistrationAdminUpdateEmailBaseMessage & {
    updateType: "rescheduled";
    startsOn: string;
    endsOn: string;
  };

export type RegistrationAdminUpdateEmailMessage =
  RegistrationCancelledEmailMessage | RegistrationRescheduledEmailMessage;

type FormattedRegistrationAdminUpdate = RegistrationAdminUpdateEmailProps & {
  guardianEmail: string;
};

const calendarDateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "long",
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

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypeError(`${fieldName} is invalid.`);
  }

  return date;
}

function formatTrainingDates(
  startsOn: string,
  endsOn: string,
): {
  startsOn: string;
  endsOn: string;
} {
  const startDate = getCalendarDate(startsOn, "The training start date");
  const endDate = getCalendarDate(endsOn, "The training end date");

  if (endDate.getTime() < startDate.getTime()) {
    throw new TypeError("The training date range is invalid.");
  }

  return {
    startsOn: calendarDateFormatter.format(startDate),
    endsOn: calendarDateFormatter.format(endDate),
  };
}

function formatMessage(
  message: RegistrationAdminUpdateEmailMessage,
): FormattedRegistrationAdminUpdate {
  const commonDetails = {
    guardianName: normalizeText(
      message.guardianName,
      "The guardian name",
      MAX_NAME_LENGTH,
    ),
    guardianEmail: normalizeEmail(message.guardianEmail),
    playerName: normalizeText(
      message.playerName,
      "The player name",
      MAX_NAME_LENGTH,
    ),
    trainingGroupName: normalizeText(
      message.trainingGroupName,
      "The training group name",
      MAX_LABEL_LENGTH,
    ),
    registrationId: getRegistrationId(message.registrationId),
  };

  if (message.updateType === "cancelled") {
    return {
      ...commonDetails,
      updateType: "cancelled",
    };
  }

  const trainingDates = formatTrainingDates(message.startsOn, message.endsOn);

  return {
    ...commonDetails,
    updateType: "rescheduled",
    ...trainingDates,
  };
}

function getEmailSubject(updateType: "cancelled" | "rescheduled"): string {
  return updateType === "cancelled"
    ? "Your ARTIS Soccer Academy registration was cancelled"
    : "Your ARTIS Soccer Academy training dates were updated";
}

function createPlainTextMessage(
  details: FormattedRegistrationAdminUpdate,
): string {
  const lines = [
    `Hello ${details.guardianName},`,
    "",
    details.updateType === "cancelled"
      ? `ARTIS Soccer Academy has cancelled ${details.playerName}’s registration.`
      : `ARTIS Soccer Academy has updated ${details.playerName}’s training dates.`,
    "",
    `Registration status: ${details.updateType === "cancelled" ? "Cancelled" : "Dates updated"}`,
    `Player: ${details.playerName}`,
    `Training group: ${details.trainingGroupName}`,
  ];

  if (details.updateType === "rescheduled") {
    lines.push(
      `New starting date: ${details.startsOn}`,
      `New ending date: ${details.endsOn}`,
    );
  }

  lines.push(
    `Registration number: ${details.registrationId}`,
    "",
    details.updateType === "cancelled"
      ? "This registration is no longer scheduled, and the player’s place has been released."
      : "The purchased package length and recorded payment have not changed.",
    "",
    "If you believe this update was made in error or have questions, reply to this email and ARTIS Soccer Academy will assist you.",
    "",
    "ARTIS Soccer Academy",
  );

  return lines.join("\n");
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

export async function sendRegistrationAdminUpdateEmail(
  message: RegistrationAdminUpdateEmailMessage,
): Promise<void> {
  const details = formatMessage(message);
  let result: Awaited<
    ReturnType<ReturnType<typeof getResendClient>["emails"]["send"]>
  >;

  try {
    result = await getResendClient().emails.send({
      from: getResendFromAddress(),
      to: getResendRecipient(details.guardianEmail),
      subject: getEmailSubject(details.updateType),
      react: RegistrationAdminUpdateEmail(details),
      text: createPlainTextMessage(details),
    });
  } catch (error) {
    console.error(
      "Resend registration-update request failed before receiving a response.",
      getResendErrorSummary(error),
    );

    throw new Error("The registration-update email could not be sent.");
  }

  if (result.error) {
    // Never log the raw provider response because it may contain recipient or
    // account details. The error category and status are enough for diagnosis.
    console.error(
      "Resend rejected the registration-update email.",
      getResendErrorSummary(result.error),
    );

    throw new Error("The registration-update email could not be sent.");
  }
}

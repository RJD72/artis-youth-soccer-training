// Sends a public Contact Us submission to the academy through Resend. Input
// is normalized here as a second line of defence; the server action will also
// validate the form before it calls this provider-neutral function.

import "server-only";

import ContactMessageEmail from "@/emails/contact-message-email";
import {
  getResendClient,
  getResendFromAddress,
  getResendRecipient,
} from "@/lib/email/resend";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()0-9.\-\sA-Za-z]{7,30}$/;
const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5_000;
const MIN_MESSAGE_LENGTH = 10;
const MAX_RECIPIENT_LENGTH = 254;
const EMAIL_SUBJECT_PREFIX = "ARTIS website enquiry";

const CONTACT_ENQUIRY_TYPES = [
  "General Enquiry",
  "Training",
  "Registration",
  "Sponsorship",
] as const;

export type ContactEnquiryType = (typeof CONTACT_ENQUIRY_TYPES)[number];

export type ContactMessageEmailInput = {
  senderName: string;
  senderEmail: string;
  phoneNumber?: string | null;
  enquiryType: string;
  message: string;
  submittedAt: Date;
};

type NormalizedContactMessage = {
  senderName: string;
  senderEmail: string;
  phoneNumber: string | null;
  enquiryType: ContactEnquiryType;
  message: string;
  submittedAt: string;
};

const torontoDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

function normalizeName(value: string): string {
  const normalizedName = value.trim().replace(/\s+/g, " ");

  if (
    normalizedName.length < 2 ||
    normalizedName.length > MAX_NAME_LENGTH ||
    /[\r\n]/.test(value) ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw new TypeError("The sender name is invalid.");
  }

  return normalizedName;
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

function normalizePhoneNumber(value?: string | null): string | null {
  const normalizedPhoneNumber = value?.trim().replace(/\s+/g, " ") ?? "";

  if (!normalizedPhoneNumber) {
    return null;
  }

  if (!PHONE_PATTERN.test(normalizedPhoneNumber)) {
    throw new TypeError("The phone number is invalid.");
  }

  return normalizedPhoneNumber;
}

function normalizeEnquiryType(value: string): ContactEnquiryType {
  const normalizedEnquiryType = value.trim();

  if (
    !CONTACT_ENQUIRY_TYPES.includes(normalizedEnquiryType as ContactEnquiryType)
  ) {
    throw new TypeError("The enquiry type is invalid.");
  }

  return normalizedEnquiryType as ContactEnquiryType;
}

function normalizeMessage(value: string): string {
  const normalizedMessage = value.replace(/\r\n?/g, "\n").trim();

  if (
    normalizedMessage.length < MIN_MESSAGE_LENGTH ||
    normalizedMessage.length > MAX_MESSAGE_LENGTH ||
    CONTROL_CHARACTER_PATTERN.test(normalizedMessage)
  ) {
    throw new TypeError("The contact message is invalid.");
  }

  return normalizedMessage;
}

function formatSubmittedAt(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    throw new TypeError("The contact submission date is invalid.");
  }

  return torontoDateTimeFormatter.format(value);
}

function getContactRecipient(): string {
  const recipient = process.env.CONTACT_FORM_RECIPIENT_EMAIL?.trim();

  if (!recipient || recipient.length > MAX_RECIPIENT_LENGTH) {
    throw new TypeError(
      "CONTACT_FORM_RECIPIENT_EMAIL is missing or invalid. Check the project's .env.local file.",
    );
  }

  return getResendRecipient(
    normalizeEmail(recipient, "The contact form recipient email address"),
  );
}

function normalizeContactMessage(
  input: ContactMessageEmailInput,
): NormalizedContactMessage {
  return {
    senderName: normalizeName(input.senderName),
    senderEmail: normalizeEmail(input.senderEmail, "The sender email address"),
    phoneNumber: normalizePhoneNumber(input.phoneNumber),
    enquiryType: normalizeEnquiryType(input.enquiryType),
    message: normalizeMessage(input.message),
    submittedAt: formatSubmittedAt(input.submittedAt),
  };
}

function createPlainTextMessage(details: NormalizedContactMessage): string {
  return [
    "A visitor submitted the ARTIS Soccer Academy Contact Us form.",
    "",
    `Enquiry type: ${details.enquiryType}`,
    `Name: ${details.senderName}`,
    `Email: ${details.senderEmail}`,
    `Phone: ${details.phoneNumber ?? "Not provided"}`,
    `Submitted: ${details.submittedAt}`,
    "",
    "Message:",
    details.message,
    "",
    "Reply to this email to respond to the sender.",
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

export async function sendContactMessageEmail(
  input: ContactMessageEmailInput,
): Promise<void> {
  const details = normalizeContactMessage(input);
  let result: Awaited<
    ReturnType<ReturnType<typeof getResendClient>["emails"]["send"]>
  >;

  try {
    result = await getResendClient().emails.send({
      from: getResendFromAddress(),
      to: getContactRecipient(),
      replyTo: details.senderEmail,
      subject: `${EMAIL_SUBJECT_PREFIX}: ${details.enquiryType}`,
      react: ContactMessageEmail(details),
      text: createPlainTextMessage(details),
    });
  } catch (error) {
    console.error(
      "Resend contact message request failed before receiving a response.",
      getResendErrorSummary(error),
    );

    throw new Error("The contact message email could not be sent.");
  }

  if (result.error) {
    // Do not log the raw provider response because it can contain email
    // addresses or account details supplied by a public visitor.
    console.error(
      "Resend rejected the contact message email.",
      getResendErrorSummary(result.error),
    );

    throw new Error("The contact message email could not be sent.");
  }
}

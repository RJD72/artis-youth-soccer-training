// Public Server Action for the Contact Us form. It treats every field as
// untrusted, quietly absorbs honeypot submissions, applies a small in-memory
// rate limit, and returns only the state needed by the form UI.

"use server";

import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { headers } from "next/headers";

import {
  sendContactMessageEmail,
  type ContactEnquiryType,
  type ContactMessageEmailInput,
} from "@/lib/send-contact-message-email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARACTER_PATTERN = /^[+()0-9.\-\sEeXxTt]{7,30}$/;
const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 5_000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;
const MAX_IP_SUBMISSIONS_PER_WINDOW = 5;
const MAX_EMAIL_SUBMISSIONS_PER_WINDOW = 3;
const RATE_LIMIT_CLEANUP_THRESHOLD = 500;

const CONTACT_ENQUIRY_TYPES = [
  "General Enquiry",
  "Training",
  "Registration",
  "Sponsorship",
] as const satisfies readonly ContactEnquiryType[];

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type ValidatedContactSubmission = Omit<ContactMessageEmailInput, "submittedAt">;

export type ContactFormActionState =
  | {
      status: "idle";
    }
  | {
      status: "success";
    }
  | {
      status: "error";
      code: "invalid-form" | "rate-limited" | "unable-to-send";
    };

// This is intentionally process-local. It gives a small self-hosted site a
// useful first layer without adding another database table. Host-level rate
// limiting can be added later if traffic or abuse makes that necessary.
const contactSubmissionAttempts = new Map<string, RateLimitEntry>();

function getSingleLineField(
  formData: FormData,
  fieldName: string,
): string | null {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return null;
  }

  return value.trim().replace(/\s+/g, " ");
}

function getMessageField(formData: FormData): string | null {
  const value = formData.get("message");

  return typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").trim()
    : null;
}

function isValidName(value: string | null): value is string {
  return (
    value !== null &&
    value.length >= 2 &&
    value.length <= MAX_NAME_LENGTH &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function isValidEmail(value: string | null): value is string {
  return (
    value !== null &&
    value.length >= 3 &&
    value.length <= MAX_EMAIL_LENGTH &&
    EMAIL_PATTERN.test(value)
  );
}

function getPhoneNumber(value: string | null): string | null | undefined {
  if (value === null || value === "") {
    return null;
  }

  const digitCount = value.replace(/\D/g, "").length;

  if (
    !PHONE_CHARACTER_PATTERN.test(value) ||
    digitCount < 7 ||
    digitCount > 15
  ) {
    return undefined;
  }

  return value;
}

function getEnquiryType(value: string | null): ContactEnquiryType | null {
  return CONTACT_ENQUIRY_TYPES.includes(value as ContactEnquiryType)
    ? (value as ContactEnquiryType)
    : null;
}

function isValidMessage(value: string | null): value is string {
  return (
    value !== null &&
    value.length >= MIN_MESSAGE_LENGTH &&
    value.length <= MAX_MESSAGE_LENGTH &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function validateContactSubmission(
  formData: FormData,
): ValidatedContactSubmission | null {
  const senderName = getSingleLineField(formData, "fullName");
  const senderEmail =
    getSingleLineField(formData, "email")?.toLowerCase() ?? null;
  const phoneNumber = getPhoneNumber(getSingleLineField(formData, "phone"));
  const enquiryType = getEnquiryType(
    getSingleLineField(formData, "enquiryType"),
  );
  const message = getMessageField(formData);

  if (
    !isValidName(senderName) ||
    !isValidEmail(senderEmail) ||
    phoneNumber === undefined ||
    enquiryType === null ||
    !isValidMessage(message)
  ) {
    return null;
  }

  return {
    senderName,
    senderEmail,
    phoneNumber,
    enquiryType,
    message,
  };
}

function isHoneypotFilled(formData: FormData): boolean {
  const website = formData.get("website");

  return (
    (typeof website === "string" && website.trim() !== "") ||
    (website !== null && typeof website !== "string")
  );
}

function normalizeAddressCandidate(value: string): string | null {
  const candidate = value.trim().replace(/^\[|\]$/g, "");

  return isIP(candidate) !== 0 ? candidate : null;
}

async function getClientAddress(): Promise<string | null> {
  const requestHeaders = await headers();
  const directCandidates = [
    requestHeaders.get("cf-connecting-ip"),
    requestHeaders.get("x-real-ip"),
  ];

  for (const candidate of directCandidates) {
    if (candidate) {
      const address = normalizeAddressCandidate(candidate);

      if (address) {
        return address;
      }
    }
  }

  const forwardedFor = requestHeaders.get("x-forwarded-for");

  if (!forwardedFor) {
    return null;
  }

  for (const candidate of forwardedFor.split(",")) {
    const address = normalizeAddressCandidate(candidate);

    if (address) {
      return address;
    }
  }

  return null;
}

function hashRateLimitIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function removeExpiredRateLimitEntries(now: number): void {
  if (contactSubmissionAttempts.size < RATE_LIMIT_CLEANUP_THRESHOLD) {
    return;
  }

  for (const [key, entry] of contactSubmissionAttempts) {
    if (entry.resetAt <= now) {
      contactSubmissionAttempts.delete(key);
    }
  }
}

function isRateLimitReached(
  key: string,
  maximumSubmissions: number,
  now: number,
): boolean {
  const entry = contactSubmissionAttempts.get(key);

  return (
    entry !== undefined &&
    entry.resetAt > now &&
    entry.count >= maximumSubmissions
  );
}

function recordRateLimitAttempt(key: string, now: number): void {
  const entry = contactSubmissionAttempts.get(key);

  if (!entry || entry.resetAt <= now) {
    contactSubmissionAttempts.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  entry.count += 1;
}

async function consumeContactSubmissionAllowance(
  senderEmail: string,
): Promise<boolean> {
  const now = Date.now();
  const clientAddress = await getClientAddress();
  const emailKey = hashRateLimitIdentifier(`email:${senderEmail}`);
  const ipKey = clientAddress
    ? hashRateLimitIdentifier(`ip:${clientAddress}`)
    : null;

  removeExpiredRateLimitEntries(now);

  if (
    isRateLimitReached(emailKey, MAX_EMAIL_SUBMISSIONS_PER_WINDOW, now) ||
    (ipKey !== null &&
      isRateLimitReached(ipKey, MAX_IP_SUBMISSIONS_PER_WINDOW, now))
  ) {
    return false;
  }

  recordRateLimitAttempt(emailKey, now);

  if (ipKey !== null) {
    recordRateLimitAttempt(ipKey, now);
  }

  return true;
}

function logContactSubmissionFailure(error: unknown): void {
  // Public form data and provider responses may contain personal information.
  // Log only the broad error type needed to identify a failing code path.
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error("Contact form email failed.", { errorType });
}

export async function submitContactMessage(
  _previousState: ContactFormActionState,
  formData: FormData,
): Promise<ContactFormActionState> {
  // A bot receives a believable success response, so the honeypot does not
  // reveal itself and no Resend request is consumed.
  if (isHoneypotFilled(formData)) {
    return { status: "success" };
  }

  const submission = validateContactSubmission(formData);

  if (!submission) {
    return { status: "error", code: "invalid-form" };
  }

  if (!(await consumeContactSubmissionAllowance(submission.senderEmail))) {
    return { status: "error", code: "rate-limited" };
  }

  try {
    await sendContactMessageEmail({
      ...submission,
      submittedAt: new Date(),
    });
  } catch (error) {
    logContactSubmissionFailure(error);

    return { status: "error", code: "unable-to-send" };
  }

  return { status: "success" };
}

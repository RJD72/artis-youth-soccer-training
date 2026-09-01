// Central server-only configuration for transactional email sent through Resend.
// Keeping provider setup here prevents secret credentials from being duplicated
// across individual email senders and makes future provider changes smaller.

import "server-only";

import { Resend } from "resend";

const MINIMUM_API_KEY_LENGTH = 20;
const MAXIMUM_API_KEY_LENGTH = 256;
const MAXIMUM_SENDER_LENGTH = 320;
const MAXIMUM_EMAIL_LENGTH = 254;
const EMAIL_ADDRESS_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

let resendClient: Resend | undefined;

function getRequiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new TypeError(
      `${name} is missing. Check the project's .env.local file.`,
    );
  }

  return value;
}

function getResendApiKey(): string {
  const apiKey = getRequiredEnvironmentValue("RESEND_API_KEY");

  if (
    !apiKey.startsWith("re_") ||
    apiKey.length < MINIMUM_API_KEY_LENGTH ||
    apiKey.length > MAXIMUM_API_KEY_LENGTH ||
    /\s/.test(apiKey)
  ) {
    throw new TypeError("RESEND_API_KEY is not a valid Resend API key.");
  }

  return apiKey;
}

function getEmailAddressFromSender(sender: string): string {
  const angleBracketMatch = sender.match(/<([^<>]+)>$/);

  return angleBracketMatch?.[1]?.trim() ?? sender;
}

function normalizeEmailAddress(value: string, fieldName: string): string {
  const emailAddress = value.trim().toLowerCase();

  if (
    emailAddress.length < 3 ||
    emailAddress.length > MAXIMUM_EMAIL_LENGTH ||
    !EMAIL_ADDRESS_PATTERN.test(emailAddress)
  ) {
    throw new TypeError(`${fieldName} is not a valid email address.`);
  }

  return emailAddress;
}

export function getResendFromAddress(): string {
  const sender = getRequiredEnvironmentValue("RESEND_FROM_EMAIL");
  const emailAddress = getEmailAddressFromSender(sender);

  if (
    sender.length > MAXIMUM_SENDER_LENGTH ||
    /[\r\n]/.test(sender) ||
    !EMAIL_ADDRESS_PATTERN.test(emailAddress)
  ) {
    throw new TypeError("RESEND_FROM_EMAIL is not a valid sender address.");
  }

  return sender;
}

export function getResendRecipient(intendedRecipient: string): string {
  const normalizedIntendedRecipient = normalizeEmailAddress(
    intendedRecipient,
    "The intended recipient",
  );

  // Before a custom domain is verified, Resend permits delivery only to the
  // account owner's address. This override is deliberately ignored in
  // production so a forgotten development variable cannot redirect real mail.
  if (process.env.NODE_ENV === "production") {
    return normalizedIntendedRecipient;
  }

  const testRecipient = process.env.RESEND_TEST_RECIPIENT?.trim();

  if (!testRecipient) {
    return normalizedIntendedRecipient;
  }

  return normalizeEmailAddress(testRecipient, "RESEND_TEST_RECIPIENT");
}

export function getResendClient(): Resend {
  resendClient ??= new Resend(getResendApiKey());

  return resendClient;
}

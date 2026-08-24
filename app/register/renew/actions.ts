// This public Server Action accepts a returning family's identity details and
// requests a short-lived renewal link. Every valid-looking submission receives
// the same response so the page never confirms whether a child is registered.

"use server";

import { after } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { renewalVerificationTokens } from "@/db/schema";
import {
  createRenewalVerificationRequest,
  type RenewalVerificationIdentity,
} from "@/lib/create-renewal-verification-request";
import { getRenewalVerificationTokenHash } from "@/lib/renewal-verification-token";
import { sendRenewalVerificationEmail } from "@/lib/send-renewal-verification-email";

export type RenewalRequestActionState =
  | {
      status: "idle";
    }
  | {
      status: "submitted";
    }
  | {
      status: "error";
      code: "invalid-form" | "unable-to-submit";
    };

type CreatedRenewalRequest = Extract<
  Awaited<ReturnType<typeof createRenewalVerificationRequest>>,
  { status: "created" }
>;

function getTextField(formData: FormData, fieldName: string): string | null {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return null;
  }

  return value.trim().replace(/\s+/g, " ");
}

function isValidEmail(value: string | null): value is string {
  return (
    value !== null &&
    value.length >= 3 &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function isValidPastDate(value: string | null): value is string {
  if (value === null) {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getTime() < todayUtc
  );
}

function validateSubmission(
  formData: FormData,
): RenewalVerificationIdentity | null {
  const guardianEmail =
    getTextField(formData, "guardianEmail")?.toLowerCase() ?? null;
  const playerFullName = getTextField(formData, "playerFullName");
  const dateOfBirth = getTextField(formData, "dateOfBirth");

  if (
    !isValidEmail(guardianEmail) ||
    playerFullName === null ||
    playerFullName.length < 2 ||
    playerFullName.length > 100 ||
    !isValidPastDate(dateOfBirth)
  ) {
    return null;
  }

  return {
    guardianEmail,
    playerFullName,
    dateOfBirth,
  };
}

function isHoneypotFilled(formData: FormData): boolean {
  const website = formData.get("website");

  return (
    (typeof website === "string" && website.trim() !== "") ||
    (website !== null && typeof website !== "string")
  );
}

function logRenewalFailure(stage: "request" | "email", error: unknown): void {
  // Do not log names, email addresses, birth dates, raw tokens, FormData, or
  // database messages because they may contain private query parameters.
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error("Renewal verification failed.", { stage, errorType });
}

async function removeUndeliveredToken(token: string): Promise<void> {
  const tokenHash = getRenewalVerificationTokenHash(token);

  if (tokenHash === null) {
    return;
  }

  await db
    .delete(renewalVerificationTokens)
    .where(eq(renewalVerificationTokens.tokenHash, tokenHash));
}

async function deliverRenewalEmail(
  request: CreatedRenewalRequest,
): Promise<void> {
  try {
    await sendRenewalVerificationEmail({
      guardianName: request.guardianName,
      guardianEmail: request.guardianEmail,
      playerName: request.playerName,
      token: request.token,
      expiresAt: request.expiresAt,
    });
  } catch (error) {
    logRenewalFailure("email", error);

    try {
      // A failed delivery must not leave an unknown link blocking another
      // request during the resend cooldown.
      await removeUndeliveredToken(request.token);
    } catch (cleanupError) {
      logRenewalFailure("request", cleanupError);
    }
  }
}

export async function requestRenewalVerification(
  _previousState: RenewalRequestActionState,
  formData: FormData,
): Promise<RenewalRequestActionState> {
  // Bots receive the same result as a legitimate submission. Revealing that
  // the honeypot fired would simply teach automated callers how to avoid it.
  if (isHoneypotFilled(formData)) {
    return { status: "submitted" };
  }

  const identity = validateSubmission(formData);

  if (!identity) {
    return { status: "error", code: "invalid-form" };
  }

  let outcome: Awaited<ReturnType<typeof createRenewalVerificationRequest>>;

  try {
    outcome = await createRenewalVerificationRequest(identity);
  } catch (error) {
    logRenewalFailure("request", error);

    return { status: "error", code: "unable-to-submit" };
  }

  if (outcome.status === "created") {
    // Sending after the response avoids a timing difference that could reveal
    // whether the supplied identity matched a player in the database.
    after(() => deliverRenewalEmail(outcome));
  }

  // This response is intentionally identical for a match, a non-match, and a
  // request suppressed by the five-minute resend cooldown.
  return { status: "submitted" };
}

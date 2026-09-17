// This public Server Action matches a returning player and redirects to
// renewal checkout with a signed, short-lived player reference.

"use server";

import { redirect } from "next/navigation";

import {
  findRenewalPlayer,
  type RenewalPlayerIdentity,
} from "@/lib/find-renewal-player";
import { createRenewalPlayerReference } from "@/lib/renewal-player-reference";

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
): RenewalPlayerIdentity | null {
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

function logRenewalLookupFailure(error: unknown): void {
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error("Renewal player lookup failed.", { errorType });
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

  let result: Awaited<ReturnType<typeof findRenewalPlayer>>;

  try {
    result = await findRenewalPlayer(identity);
  } catch (error) {
    logRenewalLookupFailure(error);

    return { status: "error", code: "unable-to-submit" };
  }

  if (result.status === "not-found") {
    return { status: "submitted" };
  }

  const reference = createRenewalPlayerReference(result.playerId);
  const parameters = new URLSearchParams({
    player: reference.player,
    expires: reference.expires,
    signature: reference.signature,
  });

  redirect(`/register/renew/verify?${parameters.toString()}`);
}

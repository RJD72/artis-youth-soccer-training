// This server-only helper keeps a verified guardian token in a short-lived,
// HTTP-only cookie. That lets a parent verify from an emailed link and then
// return to the original registration tab without exposing the token to
// client-side JavaScript or browser storage.

import "server-only";

import { cookies } from "next/headers";

import { getGuardianVerificationTokenHash } from "@/lib/guardian-verification-token";

const COOKIE_NAME = "artis_guardian_verification_token";
const COOKIE_PATH = "/register";

function requireValidToken(token: string): string {
  if (getGuardianVerificationTokenHash(token) === null) {
    throw new TypeError("The guardian verification token is invalid.");
  }

  return token;
}

function requireFutureExpiry(expiresAt: Date): Date {
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new TypeError("The guardian verification expiry is invalid.");
  }

  return expiresAt;
}

export async function setGuardianVerificationSession(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set({
    name: COOKIE_NAME,
    value: requireValidToken(token),
    expires: requireFutureExpiry(expiresAt),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    priority: "high",
  });
}

export async function getGuardianVerificationSessionToken(): Promise<
  string | null
> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;

  return value && getGuardianVerificationTokenHash(value) !== null
    ? value
    : null;
}

export async function clearGuardianVerificationSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set({
    name: COOKIE_NAME,
    value: "",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    priority: "high",
  });
}

// The guardian-verification email points here. Possession of the private,
// short-lived token is the confirmation, so this route validates it, stores it
// in an HTTP-only registration cookie, and immediately redirects to a clean
// success page without exposing the token in the browser address bar.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { setGuardianVerificationSession } from "@/lib/guardian-verification-session";
import { verifyGuardianVerificationToken } from "@/lib/verify-guardian-verification-token";

function getResultUrl(request: NextRequest, verified: boolean): URL {
  const resultUrl = request.nextUrl.clone();

  resultUrl.pathname = "/register/verify-guardian";
  resultUrl.search = verified ? "?verified=true" : "";

  return resultUrl;
}

function logVerificationFailure(error: unknown): void {
  // Never log the raw token or database error message. Database messages can
  // contain query values, while the broad error type is enough for diagnosis.
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error("Guardian email link verification failed.", { errorType });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token");

  try {
    const verification = await verifyGuardianVerificationToken(token);

    if (verification.status === "invalid" || token === null) {
      return NextResponse.redirect(getResultUrl(request, false), 303);
    }

    // The token remains unconsumed until createPendingRegistration succeeds.
    // Email-security scanners may visit this URL, but they cannot consume the
    // token or place this cookie in the parent's browser.
    await setGuardianVerificationSession(token, verification.expiresAt);

    return NextResponse.redirect(getResultUrl(request, true), 303);
  } catch (error) {
    logVerificationFailure(error);

    return NextResponse.redirect(getResultUrl(request, false), 303);
  }
}

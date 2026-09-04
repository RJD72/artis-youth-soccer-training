// This public Server Action connects the registration form to the secure
// pending-registration transaction. Browser input is never trusted, and the
// payment redirect contains only signed identifiers rather than personal data.

"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { db } from "@/db";
import { guardianVerificationTokens } from "@/db/schema";
import {
  createGuardianVerificationRequest,
  type GuardianVerificationRequestOutcome,
} from "@/lib/create-guardian-verification-request";
import {
  createPendingRegistration,
  type PendingRegistrationRejectionCode,
} from "@/lib/create-pending-registration";
import {
  clearGuardianVerificationSession,
  getGuardianVerificationSessionToken,
} from "@/lib/guardian-verification-session";
import { getGuardianVerificationTokenHash } from "@/lib/guardian-verification-token";
import { validateRegistrationSubmission } from "@/lib/registration-form-validation";
import { createRegistrationPaymentReference } from "@/lib/registration-payment-reference";
import { sendETransferPendingNotificationEmail } from "@/lib/send-e-transfer-pending-notification-email";
import { sendGuardianVerificationEmail } from "@/lib/send-guardian-verification-email";

const reservationLifetimeMilliseconds = {
  // Stripe requires a Checkout Session to remain valid for at least 30
  // minutes after that session is created. Reserving the place for 60 minutes
  // gives the server enough time to create a session whose expiry still fits
  // completely inside the database reservation window.
  stripe: 60 * 60 * 1_000,
  e_transfer: 24 * 60 * 60 * 1_000,
} as const;

export type RegistrationActionErrorCode =
  "invalid-form" | "unable-to-submit" | PendingRegistrationRejectionCode;

export type RegistrationActionState =
  | {
      status: "idle";
    }
  | {
      status: "error";
      code: RegistrationActionErrorCode;
    };

type CreatedGuardianVerificationRequest = Extract<
  GuardianVerificationRequestOutcome,
  { status: "created" }
>;

function getReservationExpiresAt(paymentMethod: "stripe" | "e_transfer"): Date {
  return new Date(Date.now() + reservationLifetimeMilliseconds[paymentMethod]);
}

function getPaymentPagePath(paymentMethod: "stripe" | "e_transfer"): string {
  return paymentMethod === "stripe"
    ? "/register/payment/stripe"
    : "/register/payment/e-transfer";
}

function buildPaymentPageUrl(
  paymentPagePath: string,
  reference: ReturnType<typeof createRegistrationPaymentReference>,
): string {
  const parameters = new URLSearchParams({
    registration: reference.registration,
    payment: reference.payment,
    method: reference.method,
    expires: reference.expires,
    signature: reference.signature,
  });

  return `${paymentPagePath}?${parameters.toString()}`;
}

function logRegistrationFailure(error: unknown): void {
  // Do not log submitted names, contact details, medical notes, or FormData.
  // Some database error messages contain query parameters, so only the broad
  // error type is recorded here.
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error("Pending registration creation failed.", { errorType });
}

function logGuardianVerificationFailure(
  stage: "request" | "email" | "cleanup" | "session",
  error: unknown,
): void {
  // Do not log the guardian email, raw token, FormData, or provider response.
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error("Guardian verification failed.", { stage, errorType });
}

async function removeUndeliveredToken(token: string): Promise<void> {
  const tokenHash = getGuardianVerificationTokenHash(token);

  if (tokenHash === null) {
    return;
  }

  await db
    .delete(guardianVerificationTokens)
    .where(eq(guardianVerificationTokens.tokenHash, tokenHash));
}

async function deliverGuardianVerificationEmail(
  request: CreatedGuardianVerificationRequest,
): Promise<boolean> {
  try {
    await sendGuardianVerificationEmail(request);

    return true;
  } catch (error) {
    logGuardianVerificationFailure("email", error);

    try {
      // A failed delivery must not leave an unknown link blocking another
      // request during the five-minute resend cooldown.
      await removeUndeliveredToken(request.token);
    } catch (cleanupError) {
      logGuardianVerificationFailure("cleanup", cleanupError);
    }

    return false;
  }
}

async function requestGuardianVerificationEmail(
  guardianEmail: string,
): Promise<boolean> {
  let request: GuardianVerificationRequestOutcome;

  try {
    request = await createGuardianVerificationRequest(guardianEmail);
  } catch (error) {
    logGuardianVerificationFailure("request", error);

    return false;
  }

  // A recent request already has a valid email link, so do not send another
  // message until the five-minute cooldown has elapsed.
  if (request.status === "not-created") {
    return true;
  }

  return deliverGuardianVerificationEmail(request);
}

async function safelyClearGuardianVerificationSession(): Promise<void> {
  try {
    await clearGuardianVerificationSession();
  } catch (error) {
    // Clearing an expired or consumed cookie is cleanup. It must not undo a
    // registration that the database transaction already completed.
    logGuardianVerificationFailure("session", error);
  }
}

async function notifyAcademyOfPendingETransfer(
  registrationId: number,
  paymentId: number,
): Promise<void> {
  try {
    await sendETransferPendingNotificationEmail(registrationId, paymentId);
  } catch (error) {
    // The registration and payment records already exist, so an email outage
    // must not prevent the parent from seeing the payment instructions.
    const errorType = error instanceof Error ? error.name : "UnknownError";

    console.error("Pending e-transfer notification failed.", { errorType });
  }
}

export async function submitRegistration(
  _previousState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  const validation = validateRegistrationSubmission(formData);

  // A honeypot submission receives the same generic response as a temporary
  // server problem, so automated spam does not learn how it was detected.
  if (validation.status === "spam") {
    return { status: "error", code: "unable-to-submit" };
  }

  if (validation.status === "invalid") {
    return { status: "error", code: "invalid-form" };
  }

  let outcome: Awaited<ReturnType<typeof createPendingRegistration>>;

  try {
    const guardianVerificationToken =
      await getGuardianVerificationSessionToken();

    outcome = await createPendingRegistration(
      validation.data,
      getReservationExpiresAt(validation.data.paymentMethod),
      guardianVerificationToken,
    );
  } catch (error) {
    logRegistrationFailure(error);

    return { status: "error", code: "unable-to-submit" };
  }

  if (outcome.status === "rejected") {
    if (outcome.code === "guardian-verification-required") {
      await safelyClearGuardianVerificationSession();

      const emailWasAccepted = await requestGuardianVerificationEmail(
        validation.data.email,
      );

      return emailWasAccepted
        ? { status: "error", code: "guardian-verification-required" }
        : { status: "error", code: "unable-to-submit" };
    }

    return { status: "error", code: outcome.code };
  }

  // The database transaction consumed the one-time token. Remove its browser
  // copy before sending the parent to the selected payment page.
  await safelyClearGuardianVerificationSession();

  const reference = createRegistrationPaymentReference(
    outcome.registrationId,
    outcome.paymentId,
    outcome.paymentMethod,
  );
  const paymentPagePath = getPaymentPagePath(outcome.paymentMethod);

  if (outcome.paymentMethod === "e_transfer") {
    after(() =>
      notifyAcademyOfPendingETransfer(
        outcome.registrationId,
        outcome.paymentId,
      ),
    );
  }

  redirect(buildPaymentPageUrl(paymentPagePath, reference));
}

// This public Server Action connects the registration form to the secure
// pending-registration transaction. Browser input is never trusted, and the
// payment redirect contains only signed identifiers rather than personal data.

"use server";

import { redirect } from "next/navigation";

import {
  createPendingRegistration,
  type PendingRegistrationRejectionCode,
} from "@/lib/create-pending-registration";
import { validateRegistrationSubmission } from "@/lib/registration-form-validation";
import { createRegistrationPaymentReference } from "@/lib/registration-payment-reference";

const reservationLifetimeMilliseconds = {
  // Stripe requires a Checkout Session to remain valid for at least 30
  // minutes after that session is created. Reserving the place for 60 minutes
  // gives the server enough time to create a session whose expiry still fits
  // completely inside the database reservation window.
  stripe: 60 * 60 * 1_000,
  e_transfer: 24 * 60 * 60 * 1_000,
} as const;

export type RegistrationActionErrorCode =
  | "invalid-form"
  | "unable-to-submit"
  | PendingRegistrationRejectionCode;

export type RegistrationActionState =
  | {
      status: "idle";
    }
  | {
      status: "error";
      code: RegistrationActionErrorCode;
    };

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
    outcome = await createPendingRegistration(
      validation.data,
      getReservationExpiresAt(validation.data.paymentMethod),
    );
  } catch (error) {
    logRegistrationFailure(error);

    return { status: "error", code: "unable-to-submit" };
  }

  if (outcome.status === "rejected") {
    return { status: "error", code: outcome.code };
  }

  const reference = createRegistrationPaymentReference(
    outcome.registrationId,
    outcome.paymentId,
    outcome.paymentMethod,
  );
  const paymentPagePath = getPaymentPagePath(outcome.paymentMethod);

  redirect(buildPaymentPageUrl(paymentPagePath, reference));
}

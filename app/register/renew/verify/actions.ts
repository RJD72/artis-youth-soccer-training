// This public Server Action connects the verified renewal form to the secure
// pending-renewal transaction. It accepts only narrowly validated FormData,
// and the payment redirect contains signed identifiers rather than personal
// information or the raw renewal token.

"use server";

import { redirect } from "next/navigation";

import {
  createPendingRenewal,
  type PendingRenewalRejectionCode,
  type PendingRenewalSubmission,
} from "@/lib/create-pending-renewal";
import { createRegistrationPaymentReference } from "@/lib/registration-payment-reference";

const maximumUnsignedInteger = 4_294_967_295;
const renewalTokenPattern = /^[A-Za-z0-9_-]{43}$/;

type RenewalPaymentMethod = PendingRenewalSubmission["paymentMethod"];

type ValidatedRenewalActionSubmission = {
  token: string;
  renewal: PendingRenewalSubmission;
};

export type RenewalCheckoutActionErrorCode =
  | "invalid-form"
  | "unable-to-submit"
  | PendingRenewalRejectionCode;

export type RenewalCheckoutActionState =
  | {
      status: "idle";
    }
  | {
      status: "error";
      code: RenewalCheckoutActionErrorCode;
    };

function getTextField(formData: FormData, fieldName: string): string | null {
  const value = formData.get(fieldName);

  return typeof value === "string" ? value.trim() : null;
}

function getDatabaseId(formData: FormData, fieldName: string): number | null {
  const value = getTextField(formData, fieldName);

  if (value === null || !/^[1-9]\d{0,9}$/.test(value)) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) && id <= maximumUnsignedInteger ? id : null;
}

function getPaymentMethod(formData: FormData): RenewalPaymentMethod | null {
  const value = getTextField(formData, "paymentMethod");

  return value === "stripe" || value === "e_transfer" ? value : null;
}

function getCheckboxValue(
  formData: FormData,
  fieldName: string,
): boolean | null {
  const value = formData.get(fieldName);

  if (value === null) {
    return false;
  }

  if (typeof value !== "string") {
    return null;
  }

  return value === "on" || value === "true" || value === "accepted"
    ? true
    : null;
}

function isHoneypotFilled(formData: FormData): boolean {
  const website = formData.get("website");

  return (
    (typeof website === "string" && website.trim() !== "") ||
    (website !== null && typeof website !== "string")
  );
}

function validateRenewalSubmission(
  formData: FormData,
): ValidatedRenewalActionSubmission | null {
  const token = getTextField(formData, "token");
  const programPackageId = getDatabaseId(formData, "programPackageId");
  const paymentMethod = getPaymentMethod(formData);
  const authorizedRegistrantConfirmed = getCheckboxValue(
    formData,
    "authorizedRegistrantConfirmed",
  );
  const informationAccuracyConfirmed = getCheckboxValue(
    formData,
    "informationAccuracyConfirmed",
  );
  const termsAccepted = getCheckboxValue(formData, "termsAccepted");
  const participationWaiverAccepted = getCheckboxValue(
    formData,
    "participationWaiverAccepted",
  );
  const gymRulesAccepted = getCheckboxValue(formData, "gymRulesAccepted");
  const marketingConsent = getCheckboxValue(formData, "marketingConsent");
  const photoVideoConsent = getCheckboxValue(formData, "photoVideoConsent");

  if (
    token === null ||
    !renewalTokenPattern.test(token) ||
    programPackageId === null ||
    paymentMethod === null ||
    authorizedRegistrantConfirmed !== true ||
    informationAccuracyConfirmed !== true ||
    termsAccepted !== true ||
    participationWaiverAccepted !== true ||
    gymRulesAccepted !== true ||
    marketingConsent === null ||
    photoVideoConsent === null
  ) {
    return null;
  }

  return {
    token,
    renewal: {
      programPackageId,
      paymentMethod,
      authorizedRegistrantConfirmed: true,
      informationAccuracyConfirmed: true,
      termsAccepted: true,
      participationWaiverAccepted: true,
      gymRulesAccepted: true,
      marketingConsent,
      photoVideoConsent,
    },
  };
}

function getPaymentPagePath(paymentMethod: RenewalPaymentMethod): string {
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

function logRenewalCheckoutFailure(error: unknown): void {
  // Database messages may contain query parameters. Never log FormData, the
  // raw token, names, contact details, consent choices, or the error message.
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error("Pending renewal creation failed.", { errorType });
}

export async function submitRenewal(
  _previousState: RenewalCheckoutActionState,
  formData: FormData,
): Promise<RenewalCheckoutActionState> {
  if (isHoneypotFilled(formData)) {
    return { status: "error", code: "unable-to-submit" };
  }

  const validation = validateRenewalSubmission(formData);

  if (!validation) {
    return { status: "error", code: "invalid-form" };
  }

  let outcome: Awaited<ReturnType<typeof createPendingRenewal>>;

  try {
    outcome = await createPendingRenewal(validation.token, validation.renewal);
  } catch (error) {
    logRenewalCheckoutFailure(error);

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

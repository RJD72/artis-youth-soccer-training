// This public Server Action connects the verified renewal form to the secure
// pending-renewal transaction. It accepts only narrowly validated FormData,
// and the payment redirect contains signed identifiers rather than personal
// information or the raw renewal token.

"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";

import {
  createPendingRenewalForPlayer,
  type PendingRenewalRejectionCode,
  type PendingRenewalSubmission,
} from "@/lib/create-pending-renewal";
import { createRegistrationPaymentReference } from "@/lib/registration-payment-reference";
import { readRenewalPlayerReference } from "@/lib/renewal-player-reference";
import { sendETransferPendingNotificationEmail } from "@/lib/send-e-transfer-pending-notification-email";

const maximumUnsignedInteger = 4_294_967_295;

type RenewalPaymentMethod = PendingRenewalSubmission["paymentMethod"];

type ValidatedRenewalActionSubmission = {
  player: string;
  expires: string;
  signature: string;
  renewal: PendingRenewalSubmission;
};

export type RenewalCheckoutActionErrorCode =
  "invalid-form" | "unable-to-submit" | PendingRenewalRejectionCode;

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
  const player = getTextField(formData, "player");
  const expires = getTextField(formData, "expires");
  const signature = getTextField(formData, "signature");
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
  const participationWaiverAccepted = getCheckboxValue(
    formData,
    "participationWaiverAccepted",
  );
  const gymRulesAccepted = getCheckboxValue(formData, "gymRulesAccepted");
  const cancellationPolicyAccepted = getCheckboxValue(
    formData,
    "cancellationPolicyAccepted",
  );
  const marketingConsent = getCheckboxValue(formData, "marketingConsent");
  const photoVideoConsent = getCheckboxValue(formData, "photoVideoConsent");

  if (
    formData.has("token") ||
    player === null ||
    player === "" ||
    expires === null ||
    expires === "" ||
    signature === null ||
    signature === ""
  ) {
    return null;
  }

  if (
    programPackageId === null ||
    paymentMethod === null ||
    authorizedRegistrantConfirmed !== true ||
    informationAccuracyConfirmed !== true ||
    participationWaiverAccepted !== true ||
    gymRulesAccepted !== true ||
    cancellationPolicyAccepted !== true ||
    marketingConsent === null ||
    photoVideoConsent === null
  ) {
    return null;
  }

  return {
    player,
    expires,
    signature,
    renewal: {
      programPackageId,
      paymentMethod,
      authorizedRegistrantConfirmed: true,
      informationAccuracyConfirmed: true,
      participationWaiverAccepted: true,
      gymRulesAccepted: true,
      cancellationPolicyAccepted: true,
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
  // signed reference, names, contact details, consents, or the error message.
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error("Pending renewal creation failed.", { errorType });
}

async function notifyAcademyOfPendingETransferRenewal(
  registrationId: number,
  paymentId: number,
): Promise<void> {
  try {
    await sendETransferPendingNotificationEmail(
      registrationId,
      paymentId,
      "renewal",
    );
  } catch (error) {
    // The renewal and payment records already exist, so an email outage must
    // not prevent the parent from seeing the payment instructions.
    const errorType = error instanceof Error ? error.name : "UnknownError";

    console.error("Pending e-transfer renewal notification failed.", {
      errorType,
    });
  }
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

  let outcome: Awaited<ReturnType<typeof createPendingRenewalForPlayer>>;

  try {
    const reference = readRenewalPlayerReference(
      validation.player,
      validation.expires,
      validation.signature,
    );

    if (reference === null) {
      return { status: "error", code: "invalid-token" };
    }

    outcome = await createPendingRenewalForPlayer(
      reference.playerId,
      validation.renewal,
    );
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

  if (outcome.paymentMethod === "e_transfer") {
    after(() =>
      notifyAcademyOfPendingETransferRenewal(
        outcome.registrationId,
        outcome.paymentId,
      ),
    );
  }

  redirect(buildPaymentPageUrl(paymentPagePath, reference));
}

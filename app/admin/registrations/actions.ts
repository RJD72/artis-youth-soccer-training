// Protected Server Actions used by the registrations administration page.
// Browser-submitted identifiers are treated as untrusted input; the service
// validates them again and performs the payment update inside a transaction.

"use server";

import { revalidatePath } from "next/cache";

import {
  confirmETransferPayment,
  type ETransferConfirmationRejectionCode,
} from "@/lib/confirm-e-transfer-payment";

type ConfirmedRegistrationStatus = "scheduled" | "active" | "expired";

export type ConfirmETransferActionErrorCode =
  | ETransferConfirmationRejectionCode
  | "unable-to-confirm";

export type ConfirmETransferActionState =
  | {
      status: "idle";
    }
  | {
      status: "success";
      result: "confirmed" | "already-confirmed";
      registrationStatus: ConfirmedRegistrationStatus;
    }
  | {
      status: "error";
      code: ConfirmETransferActionErrorCode;
    };

function logConfirmationFailure(error: unknown): void {
  // Database errors can contain query parameters, so log only the broad error
  // type and never the submitted FormData or family/payment information.
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error("E-transfer confirmation failed.", { errorType });
}

export async function confirmETransferPaymentAction(
  _previousState: ConfirmETransferActionState,
  formData: FormData,
): Promise<ConfirmETransferActionState> {
  let outcome: Awaited<ReturnType<typeof confirmETransferPayment>>;

  try {
    outcome = await confirmETransferPayment(
      formData.get("registrationId"),
      formData.get("paymentId"),
    );
  } catch (error) {
    logConfirmationFailure(error);

    return { status: "error", code: "unable-to-confirm" };
  }

  if (outcome.status === "rejected") {
    return { status: "error", code: outcome.code };
  }

  revalidatePath("/admin/registrations");

  return {
    status: "success",
    result: outcome.status,
    registrationStatus: outcome.registrationStatus,
  };
}

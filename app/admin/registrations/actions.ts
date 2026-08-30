// Protected Server Actions used by the registrations administration page.
// Browser-submitted identifiers are treated as untrusted input; the service
// validates them again and performs the payment update inside a transaction.

"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  guardians,
  payments,
  players,
  programPackages,
  registrations,
  trainingGroups,
} from "@/db/schema";
import {
  confirmETransferPayment,
  type ETransferConfirmationRejectionCode,
} from "@/lib/confirm-e-transfer-payment";
import {
  sendETransferPaymentConfirmationEmail,
  type ETransferPaymentConfirmationEmail,
} from "@/lib/send-e-transfer-payment-confirmation-email";

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
      emailStatus: "sent" | "failed" | "not-sent";
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

function logConfirmationEmailFailure(error: unknown): void {
  // Do not log the recipient, player name, payment reference or query values.
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error("E-transfer confirmation email failed.", { errorType });
}

function getDatabaseId(value: FormDataEntryValue | null): number | null {
  const id = typeof value === "string" ? Number(value) : Number.NaN;

  return Number.isSafeInteger(id) && id > 0 && id <= 4_294_967_295 ? id : null;
}

async function getConfirmationEmail(
  registrationId: number,
  paymentId: number,
): Promise<ETransferPaymentConfirmationEmail | null> {
  const [email] = await db
    .select({
      registrationId: registrations.id,
      registrationStatus: registrations.status,
      startsOn: registrations.startsOn,
      endsOn: registrations.endsOn,
      guardianName: guardians.fullName,
      guardianEmail: guardians.email,
      playerName: players.fullName,
      trainingGroupName: trainingGroups.displayName,
      programPackageName: programPackages.displayName,
      amountCents: payments.totalCents,
      currency: payments.currency,
      paymentReference: payments.manualPaymentReference,
      paidAt: payments.paidAt,
    })
    .from(registrations)
    .innerJoin(players, eq(registrations.playerId, players.id))
    .innerJoin(guardians, eq(players.guardianId, guardians.id))
    .innerJoin(
      trainingGroups,
      eq(registrations.trainingGroupId, trainingGroups.id),
    )
    .innerJoin(
      programPackages,
      eq(registrations.programPackageId, programPackages.id),
    )
    .innerJoin(
      payments,
      and(
        eq(payments.id, paymentId),
        eq(payments.registrationId, registrations.id),
      ),
    )
    .where(
      and(
        eq(registrations.id, registrationId),
        eq(payments.paymentMethod, "e_transfer"),
        eq(payments.status, "succeeded"),
      ),
    )
    .limit(1);

  if (
    !email ||
    (email.registrationStatus !== "scheduled" &&
      email.registrationStatus !== "active") ||
    email.startsOn === null ||
    email.endsOn === null ||
    email.paymentReference === null ||
    email.paidAt === null
  ) {
    return null;
  }

  return {
    ...email,
    registrationStatus: email.registrationStatus,
    startsOn: email.startsOn,
    endsOn: email.endsOn,
    paymentReference: email.paymentReference,
    paidAt: email.paidAt,
  };
}

async function sendConfirmationEmail(
  registrationIdValue: FormDataEntryValue | null,
  paymentIdValue: FormDataEntryValue | null,
): Promise<"sent" | "failed"> {
  try {
    const registrationId = getDatabaseId(registrationIdValue);
    const paymentId = getDatabaseId(paymentIdValue);

    if (!registrationId || !paymentId) {
      return "failed";
    }

    const email = await getConfirmationEmail(registrationId, paymentId);

    if (!email) {
      return "failed";
    }

    await sendETransferPaymentConfirmationEmail(email);

    return "sent";
  } catch (error) {
    logConfirmationEmailFailure(error);

    return "failed";
  }
}

export async function confirmETransferPaymentAction(
  _previousState: ConfirmETransferActionState,
  formData: FormData,
): Promise<ConfirmETransferActionState> {
  const registrationIdValue = formData.get("registrationId");
  const paymentIdValue = formData.get("paymentId");
  let outcome: Awaited<ReturnType<typeof confirmETransferPayment>>;

  try {
    outcome = await confirmETransferPayment(
      registrationIdValue,
      paymentIdValue,
    );
  } catch (error) {
    logConfirmationFailure(error);

    return { status: "error", code: "unable-to-confirm" };
  }

  if (outcome.status === "rejected") {
    return { status: "error", code: outcome.code };
  }

  const emailStatus =
    outcome.status === "confirmed"
      ? await sendConfirmationEmail(registrationIdValue, paymentIdValue)
      : "not-sent";

  // If email delivery fails, leave the current component mounted long enough
  // for it to show the admin a warning. The payment remains successfully
  // confirmed and a normal refresh will show the new registration status.
  if (emailStatus !== "failed") {
    revalidatePath("/admin/registrations");
  }

  return {
    status: "success",
    result: outcome.status,
    registrationStatus: outcome.registrationStatus,
    emailStatus,
  };
}

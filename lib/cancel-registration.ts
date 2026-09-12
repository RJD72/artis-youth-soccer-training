// Cancels registrations from the admin dashboard.
//
// Paid registrations remain in payment history and their payment record is not
// changed. A pending e-transfer cancellation resolves both the unpaid payment
// and its pending registration inside the same database transaction.

import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { payments, registrations } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type CancellableRegistrationStatus = "pending_payment" | "scheduled" | "active";

export type RegistrationCancellationRejectionCode =
  | "invalid-registration-id"
  | "registration-not-found"
  | "registration-not-cancellable";

export type RegistrationCancellationOutcome =
  | {
      status: "cancelled";
      previousStatus: CancellableRegistrationStatus;
    }
  | {
      status: "already-cancelled";
    }
  | {
      status: "rejected";
      code: RegistrationCancellationRejectionCode;
    };

type LockedRegistration = {
  id: number;
  status:
    | "pending_payment"
    | "scheduled"
    | "active"
    | "waitlisted"
    | "expired"
    | "cancelled";
};

type LockedPendingETransfer = {
  paymentId: number;
  registrationId: number;
  paymentStatus:
    | "pending"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "partially_refunded"
    | "refunded";
  registrationStatus:
    | "pending_payment"
    | "scheduled"
    | "active"
    | "waitlisted"
    | "expired"
    | "cancelled";
};

function getDatabaseId(value: unknown): number | null {
  const id = typeof value === "number" ? value : Number(value);

  return Number.isSafeInteger(id) && id > 0 && id <= 4_294_967_295 ? id : null;
}

function isPaidRegistrationCancellable(
  status: LockedRegistration["status"],
): status is "scheduled" | "active" {
  return status === "scheduled" || status === "active";
}

async function executePaidRegistrationCancellation(
  transaction: DatabaseTransaction,
  registrationId: number,
  now: Date,
): Promise<RegistrationCancellationOutcome> {
  const [registration] = await transaction
    .select({
      id: registrations.id,
      status: registrations.status,
    })
    .from(registrations)
    .where(eq(registrations.id, registrationId))
    .limit(1)
    .for("update");

  if (!registration) {
    return { status: "rejected", code: "registration-not-found" };
  }

  if (registration.status === "cancelled") {
    return { status: "already-cancelled" };
  }

  if (!isPaidRegistrationCancellable(registration.status)) {
    return { status: "rejected", code: "registration-not-cancellable" };
  }

  const [updateResult] = await transaction
    .update(registrations)
    .set({
      status: "cancelled",
      cancelledAt: now,
    })
    .where(
      and(
        eq(registrations.id, registration.id),
        inArray(registrations.status, ["scheduled", "active"]),
      ),
    );

  if (updateResult.affectedRows !== 1) {
    throw new Error("The registration could not be cancelled.");
  }

  return {
    status: "cancelled",
    previousStatus: registration.status,
  };
}

async function lockPendingETransfer(
  transaction: DatabaseTransaction,
  registrationId: number,
  paymentId: number,
): Promise<LockedPendingETransfer | null> {
  const [payment] = await transaction
    .select({
      paymentId: payments.id,
      registrationId: registrations.id,
      paymentStatus: payments.status,
      registrationStatus: registrations.status,
    })
    .from(payments)
    .innerJoin(registrations, eq(payments.registrationId, registrations.id))
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.registrationId, registrationId),
        eq(registrations.id, registrationId),
        eq(payments.paymentMethod, "e_transfer"),
      ),
    )
    .limit(1)
    .for("update");

  return payment ?? null;
}

async function executePendingETransferCancellation(
  transaction: DatabaseTransaction,
  registrationId: number,
  paymentId: number,
  now: Date,
): Promise<RegistrationCancellationOutcome> {
  const payment = await lockPendingETransfer(
    transaction,
    registrationId,
    paymentId,
  );

  if (!payment) {
    return { status: "rejected", code: "registration-not-found" };
  }

  if (payment.registrationStatus === "cancelled") {
    return { status: "already-cancelled" };
  }

  if (
    payment.registrationStatus !== "pending_payment" ||
    payment.paymentStatus !== "pending"
  ) {
    return { status: "rejected", code: "registration-not-cancellable" };
  }

  const [paymentUpdate] = await transaction
    .update(payments)
    .set({
      status: "cancelled",
    })
    .where(
      and(
        eq(payments.id, payment.paymentId),
        eq(payments.registrationId, payment.registrationId),
        eq(payments.paymentMethod, "e_transfer"),
        eq(payments.status, "pending"),
      ),
    );

  if (paymentUpdate.affectedRows !== 1) {
    throw new Error("The pending e-transfer payment could not be cancelled.");
  }

  const [registrationUpdate] = await transaction
    .update(registrations)
    .set({
      status: "cancelled",
      cancelledAt: now,
      reservationExpiresAt: null,
    })
    .where(
      and(
        eq(registrations.id, payment.registrationId),
        eq(registrations.status, "pending_payment"),
      ),
    );

  if (registrationUpdate.affectedRows !== 1) {
    throw new Error(
      "The pending e-transfer registration could not be cancelled.",
    );
  }

  return {
    status: "cancelled",
    previousStatus: "pending_payment",
  };
}

export async function cancelRegistration(
  registrationIdValue: unknown,
  now: Date = new Date(),
): Promise<RegistrationCancellationOutcome> {
  await requireAdminSession();

  const registrationId = getDatabaseId(registrationIdValue);

  if (!registrationId) {
    return { status: "rejected", code: "invalid-registration-id" };
  }

  if (Number.isNaN(now.getTime())) {
    throw new TypeError("A valid registration cancellation date is required.");
  }

  return db.transaction((transaction) =>
    executePaidRegistrationCancellation(transaction, registrationId, now),
  );
}

export async function cancelPendingETransferRegistration(
  registrationIdValue: unknown,
  paymentIdValue: unknown,
  now: Date = new Date(),
): Promise<RegistrationCancellationOutcome> {
  await requireAdminSession();

  const registrationId = getDatabaseId(registrationIdValue);
  const paymentId = getDatabaseId(paymentIdValue);

  if (!registrationId || !paymentId) {
    return { status: "rejected", code: "invalid-registration-id" };
  }

  if (Number.isNaN(now.getTime())) {
    throw new TypeError("A valid registration cancellation date is required.");
  }

  return db.transaction((transaction) =>
    executePendingETransferCancellation(
      transaction,
      registrationId,
      paymentId,
      now,
    ),
  );
}

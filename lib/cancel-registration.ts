// Cancels a paid registration without deleting its history or changing its
// payment record.

import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { registrations } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type CancellableRegistrationStatus = "scheduled" | "active";

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

function getDatabaseId(value: unknown): number | null {
  const id = typeof value === "number" ? value : Number(value);

  return Number.isSafeInteger(id) && id > 0 && id <= 4_294_967_295 ? id : null;
}

function isCancellableStatus(
  status: LockedRegistration["status"],
): status is CancellableRegistrationStatus {
  return status === "scheduled" || status === "active";
}

async function executeCancellation(
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

  // Pending payments must be resolved through their payment flow, and expired
  // registrations already release their place. This action is deliberately
  // limited to registrations that are currently scheduled or active.
  if (!isCancellableStatus(registration.status)) {
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
    executeCancellation(transaction, registrationId, now),
  );
}

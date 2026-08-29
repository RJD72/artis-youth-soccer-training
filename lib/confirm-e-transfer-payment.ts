// Confirms a manually verified e-transfer payment and activates its
// registration. Every check runs on the server inside a transaction so an
// admin action cannot confirm the wrong payment or overfill a training group.

import "server-only";

import {
  and,
  countDistinct,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  lte,
  ne,
  or,
} from "drizzle-orm";

import { db } from "@/db";
import { payments, registrations, trainingGroups } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type ConfirmedRegistrationStatus = "scheduled" | "active" | "expired";

type LockedETransferPayment = {
  paymentId: number;
  registrationId: number;
  trainingGroupId: number;
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
  startsOn: string | null;
  endsOn: string | null;
  reservationExpiresAt: Date | null;
};

export type ETransferConfirmationRejectionCode =
  | "invalid-identifiers"
  | "payment-not-found"
  | "payment-already-resolved"
  | "registration-not-confirmable"
  | "registration-period-invalid"
  | "registration-period-ended"
  | "training-group-unavailable"
  | "training-group-full";

export type ETransferConfirmationOutcome =
  | {
      status: "confirmed";
      registrationStatus: Exclude<ConfirmedRegistrationStatus, "expired">;
    }
  | {
      status: "already-confirmed";
      registrationStatus: ConfirmedRegistrationStatus;
    }
  | {
      status: "rejected";
      code: ETransferConfirmationRejectionCode;
    };

function rejectConfirmation(
  code: ETransferConfirmationRejectionCode,
): ETransferConfirmationOutcome {
  return { status: "rejected", code };
}

function getDatabaseId(value: unknown): number | null {
  const id = typeof value === "number" ? value : Number(value);

  return Number.isSafeInteger(id) && id > 0 && id <= 4_294_967_295 ? id : null;
}

function getTorontoCalendarDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("The current Toronto calendar date could not be read.");
  }

  return `${year}-${month}-${day}`;
}

async function lockETransferPayment(
  transaction: DatabaseTransaction,
  registrationId: number,
  paymentId: number,
): Promise<LockedETransferPayment | null> {
  const [payment] = await transaction
    .select({
      paymentId: payments.id,
      registrationId: registrations.id,
      trainingGroupId: registrations.trainingGroupId,
      paymentStatus: payments.status,
      registrationStatus: registrations.status,
      startsOn: registrations.startsOn,
      endsOn: registrations.endsOn,
      reservationExpiresAt: registrations.reservationExpiresAt,
    })
    .from(payments)
    .innerJoin(registrations, eq(payments.registrationId, registrations.id))
    .where(
      and(
        eq(payments.id, paymentId),
        eq(registrations.id, registrationId),
        eq(payments.registrationId, registrationId),
        eq(payments.paymentMethod, "e_transfer"),
      ),
    )
    .limit(1)
    .for("update");

  return payment ?? null;
}

function getAlreadyConfirmedStatus(
  payment: LockedETransferPayment,
): ConfirmedRegistrationStatus | null {
  if (payment.paymentStatus !== "succeeded") {
    return null;
  }

  return payment.registrationStatus === "scheduled" ||
    payment.registrationStatus === "active" ||
    payment.registrationStatus === "expired"
    ? payment.registrationStatus
    : null;
}

function hasConfirmableState(payment: LockedETransferPayment): boolean {
  return (
    payment.paymentStatus === "pending" &&
    (payment.registrationStatus === "pending_payment" ||
      payment.registrationStatus === "expired")
  );
}

function getRegistrationStatus(
  startsOn: string,
  endsOn: string,
  today: string,
): Exclude<ConfirmedRegistrationStatus, "expired"> | null {
  if (endsOn < today) {
    return null;
  }

  return startsOn <= today ? "active" : "scheduled";
}

function hasActiveReservation(
  reservationExpiresAt: Date | null,
  now: Date,
): boolean {
  return (
    reservationExpiresAt !== null &&
    reservationExpiresAt.getTime() > now.getTime()
  );
}

async function getTrainingGroupCapacity(
  transaction: DatabaseTransaction,
  trainingGroupId: number,
): Promise<number | null> {
  const [trainingGroup] = await transaction
    .select({ capacity: trainingGroups.capacity })
    .from(trainingGroups)
    .where(eq(trainingGroups.id, trainingGroupId))
    .limit(1)
    .for("update");

  return trainingGroup?.capacity ?? null;
}

async function countOtherOccupiedSpots(
  transaction: DatabaseTransaction,
  payment: LockedETransferPayment & { startsOn: string; endsOn: string },
  now: Date,
): Promise<number> {
  const [result] = await transaction
    .select({ occupiedSpots: countDistinct(registrations.playerId) })
    .from(registrations)
    .where(
      and(
        eq(registrations.trainingGroupId, payment.trainingGroupId),
        ne(registrations.id, payment.registrationId),
        isNotNull(registrations.startsOn),
        isNotNull(registrations.endsOn),
        lte(registrations.startsOn, payment.endsOn),
        gte(registrations.endsOn, payment.startsOn),
        or(
          inArray(registrations.status, ["scheduled", "active"]),
          and(
            eq(registrations.status, "pending_payment"),
            gt(registrations.reservationExpiresAt, now),
          ),
        ),
      ),
    );

  return result?.occupiedSpots ?? 0;
}

async function expiredReservationStillHasCapacity(
  transaction: DatabaseTransaction,
  payment: LockedETransferPayment & { startsOn: string; endsOn: string },
  now: Date,
): Promise<"available" | "full" | "group-unavailable"> {
  const capacity = await getTrainingGroupCapacity(
    transaction,
    payment.trainingGroupId,
  );

  if (capacity === null) {
    return "group-unavailable";
  }

  const occupiedSpots = await countOtherOccupiedSpots(
    transaction,
    payment,
    now,
  );

  return occupiedSpots < capacity ? "available" : "full";
}

async function saveConfirmedETransfer(
  transaction: DatabaseTransaction,
  payment: LockedETransferPayment,
  registrationStatus: Exclude<ConfirmedRegistrationStatus, "expired">,
  now: Date,
): Promise<void> {
  const [paymentUpdate] = await transaction
    .update(payments)
    .set({
      status: "succeeded",
      paidAt: now,
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
    throw new Error("The e-transfer payment could not be confirmed.");
  }

  const [registrationUpdate] = await transaction
    .update(registrations)
    .set({
      status: registrationStatus,
      activatedAt: registrationStatus === "active" ? now : null,
    })
    .where(
      and(
        eq(registrations.id, payment.registrationId),
        inArray(registrations.status, ["pending_payment", "expired"]),
      ),
    );

  if (registrationUpdate.affectedRows !== 1) {
    throw new Error("The e-transfer registration could not be confirmed.");
  }
}

async function executeConfirmation(
  transaction: DatabaseTransaction,
  registrationId: number,
  paymentId: number,
  now: Date,
): Promise<ETransferConfirmationOutcome> {
  const payment = await lockETransferPayment(
    transaction,
    registrationId,
    paymentId,
  );

  if (!payment) {
    return rejectConfirmation("payment-not-found");
  }

  const confirmedStatus = getAlreadyConfirmedStatus(payment);

  if (confirmedStatus) {
    return {
      status: "already-confirmed",
      registrationStatus: confirmedStatus,
    };
  }

  if (payment.paymentStatus !== "pending") {
    return rejectConfirmation("payment-already-resolved");
  }

  if (!hasConfirmableState(payment)) {
    return rejectConfirmation("registration-not-confirmable");
  }

  if (!payment.startsOn || !payment.endsOn) {
    return rejectConfirmation("registration-period-invalid");
  }

  const today = getTorontoCalendarDate(now);
  const registrationStatus = getRegistrationStatus(
    payment.startsOn,
    payment.endsOn,
    today,
  );

  if (!registrationStatus) {
    return rejectConfirmation("registration-period-ended");
  }

  if (!hasActiveReservation(payment.reservationExpiresAt, now)) {
    const capacityResult = await expiredReservationStillHasCapacity(
      transaction,
      {
        ...payment,
        startsOn: payment.startsOn,
        endsOn: payment.endsOn,
      },
      now,
    );

    if (capacityResult === "group-unavailable") {
      return rejectConfirmation("training-group-unavailable");
    }

    if (capacityResult === "full") {
      return rejectConfirmation("training-group-full");
    }
  }

  await saveConfirmedETransfer(transaction, payment, registrationStatus, now);

  return { status: "confirmed", registrationStatus };
}

export async function confirmETransferPayment(
  registrationIdValue: unknown,
  paymentIdValue: unknown,
  now: Date = new Date(),
): Promise<ETransferConfirmationOutcome> {
  await requireAdminSession();

  const registrationId = getDatabaseId(registrationIdValue);
  const paymentId = getDatabaseId(paymentIdValue);

  if (!registrationId || !paymentId) {
    return rejectConfirmation("invalid-identifiers");
  }

  if (Number.isNaN(now.getTime())) {
    throw new TypeError("A valid e-transfer confirmation date is required.");
  }

  return db.transaction((transaction) =>
    executeConfirmation(transaction, registrationId, paymentId, now),
  );
}

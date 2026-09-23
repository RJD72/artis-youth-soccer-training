// This file creates a complete pending registration inside one database
// transaction. Every price, age limit, package duration, legal document, and
// capacity value is re-read from MySQL instead of trusting the browser.

import "server-only";

import {
  and,
  asc,
  countDistinct,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
} from "drizzle-orm";

import { db } from "@/db";
import {
  guardians,
  legalAcceptances,
  legalDocuments,
  payments,
  players,
  programPackages,
  registrations,
  trainingGroups,
} from "@/db/schema";
import {
  calculateAgeOnDate,
  calculateRegistrationPeriod,
  calculateRegistrationPricing,
} from "@/lib/registration-calculations";
import { encryptRegistrationText } from "@/lib/registration-encryption";
import type { ValidatedRegistrationSubmission } from "@/lib/registration-form-validation";
import { createManualPaymentReference } from "@/lib/registration-payment-reference";

const requiredLegalDocumentTypes = [
  "participation_waiver",
  "gym_facility_rules",
  "cancellation_refund_policy",
] as const;

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type RegistrationPaymentMethod = "stripe" | "e_transfer";

type PaymentRoutingFields = {
  registrationId: number;
  paymentId: number;
  paymentMethod: RegistrationPaymentMethod;
  manualPaymentReference: string | null;
  trainingGroupSlug: string;
  startsOn: string;
  endsOn: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
};

export type PendingRegistrationRejectionCode =
  | "invalid-selection"
  | "registration-closed"
  | "group-full"
  | "age-mismatch"
  | "legal-documents-unavailable"
  | "payment-pending"
  | "already-registered"
  | "renewal-required";

export type PendingRegistrationCreationOutcome =
  | ({ status: "created" | "resumed" } & PaymentRoutingFields)
  | {
      status: "rejected";
      code: PendingRegistrationRejectionCode;
      trainingGroupSlug?: string;
    };

type PlayerRecoveryDecision =
  | {
      status: "reuse-player";
      playerId: number;
    }
  | {
      status: "outcome";
      outcome: PendingRegistrationCreationOutcome;
    };

type LockedRegistrationPayment = {
  registrationId: number;
  registrationStatus:
    | "pending_payment"
    | "scheduled"
    | "active"
    | "waitlisted"
    | "expired"
    | "cancelled";
  trainingGroupId: number;
  startsOn: string | null;
  endsOn: string | null;
  reservationExpiresAt: Date | null;
  packagePriceCents: number;
  registrationCurrency: string;
  paymentId: number | null;
  paymentStatus:
    | "pending"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "partially_refunded"
    | "refunded"
    | null;
  paymentMethod: RegistrationPaymentMethod | null;
  manualPaymentReference: string | null;
  stripeCheckoutSessionId: string | null;
  subtotalCents: number | null;
  taxCents: number | null;
  totalCents: number | null;
  paymentCurrency: string | null;
};

function requireFutureReservationExpiry(value: Date): void {
  if (Number.isNaN(value.getTime()) || value.getTime() <= Date.now()) {
    throw new TypeError("The reservation expiry must be a valid future date.");
  }
}

function getFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

function hasEveryRequiredLegalDocument(
  rows: Array<{
    id: number;
    documentType: string;
  }>,
): boolean {
  if (rows.length !== requiredLegalDocumentTypes.length) {
    return false;
  }

  const documentTypes = new Set(rows.map((row) => row.documentType));

  return requiredLegalDocumentTypes.every((documentType) =>
    documentTypes.has(documentType),
  );
}

function rejectRegistration(
  code: PendingRegistrationRejectionCode,
  trainingGroupSlug: string,
): PendingRegistrationCreationOutcome {
  return { status: "rejected", code, trainingGroupSlug };
}

function isStoredPositiveInteger(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value > 0;
}

function buildResumedOutcome(
  row: LockedRegistrationPayment,
  trainingGroupSlug: string,
): PendingRegistrationCreationOutcome | null {
  if (
    !isStoredPositiveInteger(row.registrationId) ||
    !isStoredPositiveInteger(row.paymentId) ||
    !row.paymentMethod ||
    !row.startsOn ||
    !row.endsOn ||
    !isStoredPositiveInteger(row.packagePriceCents) ||
    !isStoredPositiveInteger(row.subtotalCents) ||
    row.taxCents === null ||
    !Number.isSafeInteger(row.taxCents) ||
    row.taxCents < 0 ||
    !isStoredPositiveInteger(row.totalCents) ||
    !row.paymentCurrency ||
    !/^[A-Z]{3}$/i.test(row.paymentCurrency) ||
    row.registrationCurrency.toUpperCase() !==
      row.paymentCurrency.toUpperCase() ||
    (row.paymentMethod === "e_transfer" && !row.manualPaymentReference)
  ) {
    return null;
  }

  return {
    status: "resumed",
    registrationId: row.registrationId,
    paymentId: row.paymentId,
    paymentMethod: row.paymentMethod,
    manualPaymentReference: row.manualPaymentReference,
    trainingGroupSlug,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    subtotalCents: row.subtotalCents,
    taxCents: row.taxCents,
    totalCents: row.totalCents,
    currency: row.paymentCurrency,
  };
}

async function cancelSafeAbandonedAttempt(
  transaction: DatabaseTransaction,
  playerId: number,
  row: LockedRegistrationPayment,
  now: Date,
): Promise<void> {
  if (!row.paymentId || !row.paymentMethod) {
    throw new Error("The abandoned payment could not be cancelled safely.");
  }

  const [paymentUpdate] = await transaction
    .update(payments)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(payments.id, row.paymentId),
        eq(payments.registrationId, row.registrationId),
        eq(payments.status, "pending"),
        or(
          eq(payments.paymentMethod, "e_transfer"),
          and(
            eq(payments.paymentMethod, "stripe"),
            isNull(payments.stripeCheckoutSessionId),
          ),
        ),
      ),
    );

  if (paymentUpdate.affectedRows !== 1) {
    throw new Error("The abandoned payment could not be cancelled safely.");
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
        eq(registrations.id, row.registrationId),
        eq(registrations.playerId, playerId),
        eq(registrations.status, "pending_payment"),
        lte(registrations.reservationExpiresAt, now),
      ),
    );

  if (registrationUpdate.affectedRows !== 1) {
    throw new Error(
      "The abandoned registration could not be cancelled safely.",
    );
  }
}

async function inspectExistingPlayerPaymentState(
  transaction: DatabaseTransaction,
  playerId: number,
  selectedTrainingGroupId: number,
  trainingGroupSlug: string,
  now: Date,
): Promise<PlayerRecoveryDecision> {
  const rows: LockedRegistrationPayment[] = await transaction
    .select({
      registrationId: registrations.id,
      registrationStatus: registrations.status,
      trainingGroupId: registrations.trainingGroupId,
      startsOn: registrations.startsOn,
      endsOn: registrations.endsOn,
      reservationExpiresAt: registrations.reservationExpiresAt,
      packagePriceCents: registrations.packagePriceCents,
      registrationCurrency: registrations.currency,
      paymentId: payments.id,
      paymentStatus: payments.status,
      paymentMethod: payments.paymentMethod,
      manualPaymentReference: payments.manualPaymentReference,
      stripeCheckoutSessionId: payments.stripeCheckoutSessionId,
      subtotalCents: payments.subtotalCents,
      taxCents: payments.taxCents,
      totalCents: payments.totalCents,
      paymentCurrency: payments.currency,
    })
    .from(registrations)
    .leftJoin(payments, eq(payments.registrationId, registrations.id))
    .where(eq(registrations.playerId, playerId))
    .orderBy(asc(registrations.id), asc(payments.id))
    .for("update");

  if (
    rows.some(
      (row) =>
        row.registrationStatus === "scheduled" ||
        row.registrationStatus === "active",
    )
  ) {
    return {
      status: "outcome",
      outcome: rejectRegistration("already-registered", trainingGroupSlug),
    };
  }

  if (rows.some((row) => row.paymentStatus === "succeeded")) {
    return {
      status: "outcome",
      outcome: rejectRegistration("renewal-required", trainingGroupSlug),
    };
  }

  const activePendingAttempt = rows.find(
    (row) =>
      row.registrationStatus === "pending_payment" &&
      row.paymentStatus === "pending" &&
      row.reservationExpiresAt !== null &&
      row.reservationExpiresAt.getTime() > now.getTime(),
  );

  if (activePendingAttempt) {
    if (activePendingAttempt.trainingGroupId !== selectedTrainingGroupId) {
      return {
        status: "outcome",
        outcome: rejectRegistration("payment-pending", trainingGroupSlug),
      };
    }

    const resumedOutcome = buildResumedOutcome(
      activePendingAttempt,
      trainingGroupSlug,
    );

    return {
      status: "outcome",
      outcome:
        resumedOutcome ??
        rejectRegistration("payment-pending", trainingGroupSlug),
    };
  }

  const unresolvedStripeAttempt = rows.some(
    (row) =>
      row.registrationStatus === "pending_payment" &&
      row.paymentStatus === "pending" &&
      row.paymentMethod === "stripe" &&
      row.stripeCheckoutSessionId !== null &&
      row.reservationExpiresAt !== null &&
      row.reservationExpiresAt.getTime() <= now.getTime(),
  );

  if (unresolvedStripeAttempt) {
    return {
      status: "outcome",
      outcome: rejectRegistration("payment-pending", trainingGroupSlug),
    };
  }

  const safeAbandonedAttempts = rows.filter(
    (row) =>
      row.registrationStatus === "pending_payment" &&
      row.paymentStatus === "pending" &&
      row.reservationExpiresAt !== null &&
      row.reservationExpiresAt.getTime() <= now.getTime() &&
      (row.paymentMethod === "e_transfer" ||
        (row.paymentMethod === "stripe" &&
          row.stripeCheckoutSessionId === null)),
  );

  const safeRegistrationIds = new Set(
    safeAbandonedAttempts.map((row) => row.registrationId),
  );
  const hasOtherUnresolvedPendingAttempt = rows.some(
    (row) =>
      row.registrationStatus === "pending_payment" &&
      row.paymentStatus === "pending" &&
      !safeRegistrationIds.has(row.registrationId),
  );

  if (hasOtherUnresolvedPendingAttempt) {
    return {
      status: "outcome",
      outcome: rejectRegistration("payment-pending", trainingGroupSlug),
    };
  }

  for (const row of safeAbandonedAttempts) {
    await cancelSafeAbandonedAttempt(transaction, playerId, row, now);
  }

  return { status: "reuse-player", playerId };
}

export async function createPendingRegistration(
  submission: ValidatedRegistrationSubmission,
  reservationExpiresAt: Date,
): Promise<PendingRegistrationCreationOutcome> {
  requireFutureReservationExpiry(reservationExpiresAt);

  const now = new Date();
  const playerFullName = getFullName(
    submission.childFirstName,
    submission.childLastName,
  );
  const guardianFullName = getFullName(
    submission.guardianFirstName,
    submission.guardianLastName,
  );
  const medicalInformationEncrypted = encryptRegistrationText(
    submission.medicalInformation,
  );
  const coachInformationEncrypted = encryptRegistrationText(
    submission.coachInformation,
  );

  const outcome: PendingRegistrationCreationOutcome = await db.transaction(
    async (transaction) => {
      // Locking the group serializes capacity decisions for that group. Two
      // simultaneous visitors cannot both claim the final available place.
      const [trainingGroup] = await transaction
        .select({
          id: trainingGroups.id,
          slug: trainingGroups.slug,
          minimumAge: trainingGroups.minimumAge,
          maximumAge: trainingGroups.maximumAge,
          capacity: trainingGroups.capacity,
          registrationOpen: trainingGroups.registrationOpen,
        })
        .from(trainingGroups)
        .where(eq(trainingGroups.id, submission.trainingGroupId))
        .limit(1)
        .for("update");

      if (!trainingGroup) {
        return {
          status: "rejected",
          code: "invalid-selection",
        };
      }

      if (!trainingGroup.registrationOpen) {
        return {
          status: "rejected",
          code: "registration-closed",
          trainingGroupSlug: trainingGroup.slug,
        };
      }

      const [programPackage] = await transaction
        .select({
          id: programPackages.id,
          durationMonths: programPackages.durationMonths,
          priceCents: programPackages.priceCents,
          currency: programPackages.currency,
          taxBehavior: programPackages.taxBehavior,
        })
        .from(programPackages)
        .where(
          and(
            eq(programPackages.id, submission.programPackageId),
            eq(programPackages.isActive, true),
          ),
        )
        .limit(1)
        .for("update");

      if (!programPackage) {
        return {
          status: "rejected",
          code: "invalid-selection",
          trainingGroupSlug: trainingGroup.slug,
        };
      }

      const registrationPeriod = calculateRegistrationPeriod(
        programPackage.durationMonths,
        now,
      );
      const playerAge = calculateAgeOnDate(
        submission.dateOfBirth,
        registrationPeriod.startsOn,
      );

      if (
        playerAge < trainingGroup.minimumAge ||
        playerAge > trainingGroup.maximumAge
      ) {
        return {
          status: "rejected",
          code: "age-mismatch",
          trainingGroupSlug: trainingGroup.slug,
        };
      }

      const activeLegalDocuments = await transaction
        .select({
          id: legalDocuments.id,
          documentType: legalDocuments.documentType,
        })
        .from(legalDocuments)
        .where(
          and(
            inArray(legalDocuments.documentType, requiredLegalDocumentTypes),
            eq(legalDocuments.isActive, true),
            isNotNull(legalDocuments.publishedAt),
          ),
        )
        .for("update");

      if (!hasEveryRequiredLegalDocument(activeLegalDocuments)) {
        return {
          status: "rejected",
          code: "legal-documents-unavailable",
          trainingGroupSlug: trainingGroup.slug,
        };
      }

      const [existingGuardian] = await transaction
        .select({
          id: guardians.id,
          fullName: guardians.fullName,
          phone: guardians.phone,
          secondaryPhone: guardians.secondaryPhone,
        })
        .from(guardians)
        .where(eq(guardians.email, submission.email))
        .limit(1)
        .for("update");

      let reusableGuardianId: number | null = null;
      let reusablePlayerId: number | null = null;

      if (existingGuardian) {
        const [existingPlayer] = await transaction
          .select({ id: players.id })
          .from(players)
          .where(
            and(
              eq(players.guardianId, existingGuardian.id),
              eq(players.fullName, playerFullName),
              eq(players.dateOfBirth, submission.dateOfBirth),
            ),
          )
          .limit(1)
          .for("update");

        if (existingPlayer) {
          const recoveryDecision = await inspectExistingPlayerPaymentState(
            transaction,
            existingPlayer.id,
            trainingGroup.id,
            trainingGroup.slug,
            now,
          );

          if (recoveryDecision.status === "outcome") {
            return recoveryDecision.outcome;
          }

          reusableGuardianId = existingGuardian.id;
          reusablePlayerId = recoveryDecision.playerId;
        }
      }

      const [occupancy] = await transaction
        .select({ occupiedSpots: countDistinct(registrations.playerId) })
        .from(registrations)
        .where(
          and(
            eq(registrations.trainingGroupId, trainingGroup.id),
            reusablePlayerId === null
              ? undefined
              : ne(registrations.playerId, reusablePlayerId),
            or(
              inArray(registrations.status, ["scheduled", "active"]),
              and(
                eq(registrations.status, "pending_payment"),
                gt(registrations.reservationExpiresAt, now),
              ),
            ),
          ),
        );

      if ((occupancy?.occupiedSpots ?? 0) >= trainingGroup.capacity) {
        return {
          status: "rejected",
          code: "group-full",
          trainingGroupSlug: trainingGroup.slug,
        };
      }

      let guardianId = reusableGuardianId;
      let playerId = reusablePlayerId;

      if (guardianId === null || playerId === null) {
        // The insert handles the rare case where another group transaction
        // created this email after our first lookup. On a duplicate email,
        // only the same email value is written; existing contact details are
        // never overwritten by this unauthenticated public flow.
        await transaction
          .insert(guardians)
          .values({
            fullName: guardianFullName,
            email: submission.email,
            phone: submission.primaryPhone,
            secondaryPhone: submission.secondaryPhone,
          })
          .onDuplicateKeyUpdate({
            set: { email: submission.email },
          });

        const [guardian] = await transaction
          .select({ id: guardians.id })
          .from(guardians)
          .where(eq(guardians.email, submission.email))
          .limit(1)
          .for("update");

        if (!guardian) {
          throw new Error("The registration guardian could not be saved.");
        }

        guardianId = guardian.id;

        // Check again after the guardian upsert. This catches a matching
        // player created concurrently through another group transaction and
        // applies the exact same recovery rules as the initial lookup.
        const [matchingPlayer] = await transaction
          .select({ id: players.id })
          .from(players)
          .where(
            and(
              eq(players.guardianId, guardianId),
              eq(players.fullName, playerFullName),
              eq(players.dateOfBirth, submission.dateOfBirth),
            ),
          )
          .limit(1)
          .for("update");

        if (matchingPlayer) {
          const recoveryDecision = await inspectExistingPlayerPaymentState(
            transaction,
            matchingPlayer.id,
            trainingGroup.id,
            trainingGroup.slug,
            now,
          );

          if (recoveryDecision.status === "outcome") {
            return recoveryDecision.outcome;
          }

          playerId = recoveryDecision.playerId;
        } else {
          const [playerInsertResult] = await transaction
            .insert(players)
            .values({
              guardianId,
              fullName: playerFullName,
              preferredName: submission.preferredName,
              dateOfBirth: submission.dateOfBirth,
              currentPlayingLevel: submission.currentPlayingLevel,
              currentTeamOrClub: submission.currentTeamOrClub,
              emergencyContactName: submission.emergencyContactName,
              emergencyContactRelationship:
                submission.emergencyContactRelationship,
              emergencyContactPhone: submission.emergencyContactPhone,
              medicalInformationEncrypted,
              coachInformationEncrypted,
            });

          playerId = playerInsertResult.insertId;

          if (!Number.isSafeInteger(playerId) || playerId <= 0) {
            throw new Error("The registration player could not be saved.");
          }
        }
      }

      if (guardianId === null || playerId === null) {
        throw new Error("The registration identity could not be saved.");
      }

      const pricing = calculateRegistrationPricing(
        programPackage.priceCents,
        programPackage.taxBehavior,
      );

      const [registrationInsertResult] = await transaction
        .insert(registrations)
        .values({
          playerId,
          trainingGroupId: trainingGroup.id,
          programPackageId: programPackage.id,
          guardianRelationship: submission.guardianRelationship,
          status: "pending_payment",
          packagePriceCents: pricing.packagePriceCents,
          currency: programPackage.currency,
          startsOn: registrationPeriod.startsOn,
          endsOn: registrationPeriod.endsOn,
          reservationExpiresAt,
          authorizedRegistrantConfirmedAt: now,
          informationAccuracyConfirmedAt: now,
          marketingConsent: submission.marketingConsent,
          photoVideoConsent: submission.photoVideoConsent,
        });
      const registrationId = registrationInsertResult.insertId;

      if (!Number.isSafeInteger(registrationId) || registrationId <= 0) {
        throw new Error("The pending registration could not be saved.");
      }

      await transaction.insert(legalAcceptances).values(
        activeLegalDocuments.map((legalDocument) => ({
          registrationId,
          guardianId,
          legalDocumentId: legalDocument.id,
          acceptedByName: guardianFullName,
          acceptedAt: now,
        })),
      );

      const [paymentInsertResult] = await transaction.insert(payments).values({
        registrationId,
        status: "pending",
        paymentMethod: submission.paymentMethod,
        subtotalCents: pricing.subtotalCents,
        taxCents: pricing.taxCents,
        totalCents: pricing.totalCents,
        currency: programPackage.currency,
      });
      const paymentId = paymentInsertResult.insertId;

      if (!Number.isSafeInteger(paymentId) || paymentId <= 0) {
        throw new Error("The pending payment could not be saved.");
      }

      const manualPaymentReference =
        submission.paymentMethod === "e_transfer"
          ? createManualPaymentReference(paymentId)
          : null;

      if (manualPaymentReference) {
        const [paymentUpdateResult] = await transaction
          .update(payments)
          .set({ manualPaymentReference })
          .where(
            and(
              eq(payments.id, paymentId),
              eq(payments.registrationId, registrationId),
            ),
          );

        if (paymentUpdateResult.affectedRows !== 1) {
          throw new Error("The e-transfer reference could not be saved.");
        }
      }

      return {
        status: "created",
        registrationId,
        paymentId,
        paymentMethod: submission.paymentMethod,
        manualPaymentReference,
        trainingGroupSlug: trainingGroup.slug,
        startsOn: registrationPeriod.startsOn,
        endsOn: registrationPeriod.endsOn,
        subtotalCents: pricing.subtotalCents,
        taxCents: pricing.taxCents,
        totalCents: pricing.totalCents,
        currency: programPackage.currency,
      };
    },
  );

  return outcome;
}

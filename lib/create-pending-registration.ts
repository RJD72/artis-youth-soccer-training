// This file creates a complete pending registration inside one database
// transaction. Every price, age limit, package duration, legal document, and
// capacity value is re-read from MySQL instead of trusting the browser.

import "server-only";

import {
  and,
  count,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  or,
} from "drizzle-orm";

import { db } from "@/db";
import {
  guardians,
  guardianVerificationTokens,
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
import { getGuardianVerificationTokenHash } from "@/lib/guardian-verification-token";

const requiredLegalDocumentTypes = [
  "terms_conditions",
  "participation_waiver",
  "gym_facility_rules",
] as const;

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PendingRegistrationRejectionCode =
  | "invalid-selection"
  | "registration-closed"
  | "group-full"
  | "age-mismatch"
  | "legal-documents-unavailable"
  | "already-registered"
  | "guardian-verification-required"
  | "renewal-required";

export type PendingRegistrationCreationOutcome =
  | {
      status: "created";
      registrationId: number;
      paymentId: number;
      paymentMethod: "stripe" | "e_transfer";
      manualPaymentReference: string | null;
      trainingGroupSlug: string;
      startsOn: string;
      endsOn: string;
      subtotalCents: number;
      taxCents: number;
      totalCents: number;
      currency: string;
    }
  | {
      status: "rejected";
      code: PendingRegistrationRejectionCode;
      trainingGroupSlug?: string;
    };

function requireFutureReservationExpiry(value: Date): void {
  if (Number.isNaN(value.getTime()) || value.getTime() <= Date.now()) {
    throw new TypeError("The reservation expiry must be a valid future date.");
  }
}

function getFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

function normalizePhoneForComparison(value: string | null): string | null {
  return value === null ? null : value.replace(/\D/g, "");
}

function guardianDetailsMatch(
  guardian: {
    fullName: string;
    phone: string;
    secondaryPhone: string | null;
    preferredContactMethod: "email" | "phone" | "text";
  },
  submission: ValidatedRegistrationSubmission,
): boolean {
  const submittedFullName = getFullName(
    submission.guardianFirstName,
    submission.guardianLastName,
  );

  return (
    guardian.fullName.toLocaleLowerCase("en-CA") ===
      submittedFullName.toLocaleLowerCase("en-CA") &&
    normalizePhoneForComparison(guardian.phone) ===
      normalizePhoneForComparison(submission.primaryPhone) &&
    normalizePhoneForComparison(guardian.secondaryPhone) ===
      normalizePhoneForComparison(submission.secondaryPhone) &&
    guardian.preferredContactMethod === submission.preferredContactMethod
  );
}

async function lockGuardianVerificationToken(
  transaction: DatabaseTransaction,
  guardianId: number,
  tokenHash: string | null,
  now: Date,
): Promise<number | null> {
  if (tokenHash === null) {
    return null;
  }

  const [verification] = await transaction
    .select({ id: guardianVerificationTokens.id })
    .from(guardianVerificationTokens)
    .where(
      and(
        eq(guardianVerificationTokens.tokenHash, tokenHash),
        eq(guardianVerificationTokens.guardianId, guardianId),
        isNull(guardianVerificationTokens.consumedAt),
        gt(guardianVerificationTokens.expiresAt, now),
      ),
    )
    .limit(1)
    .for("update");

  return verification?.id ?? null;
}

async function consumeGuardianVerificationToken(
  transaction: DatabaseTransaction,
  tokenId: number,
  now: Date,
): Promise<void> {
  const [updateResult] = await transaction
    .update(guardianVerificationTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(guardianVerificationTokens.id, tokenId),
        isNull(guardianVerificationTokens.consumedAt),
        gt(guardianVerificationTokens.expiresAt, now),
      ),
    );

  if (updateResult.affectedRows !== 1) {
    throw new Error("The guardian verification token could not be consumed.");
  }
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

export async function createPendingRegistration(
  submission: ValidatedRegistrationSubmission,
  reservationExpiresAt: Date,
  guardianVerificationToken: string | null = null,
): Promise<PendingRegistrationCreationOutcome> {
  requireFutureReservationExpiry(reservationExpiresAt);

  const now = new Date();
  const guardianVerificationTokenHash = getGuardianVerificationTokenHash(
    guardianVerificationToken,
  );
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

      let guardianVerificationTokenId: number | null = null;

      const [existingGuardian] = await transaction
        .select({
          id: guardians.id,
          fullName: guardians.fullName,
          phone: guardians.phone,
          secondaryPhone: guardians.secondaryPhone,
          preferredContactMethod: guardians.preferredContactMethod,
        })
        .from(guardians)
        .where(eq(guardians.email, submission.email))
        .limit(1)
        .for("update");

      if (existingGuardian) {
        guardianVerificationTokenId = await lockGuardianVerificationToken(
          transaction,
          existingGuardian.id,
          guardianVerificationTokenHash,
          now,
        );

        if (guardianVerificationTokenId === null) {
          return {
            status: "rejected",
            code: "guardian-verification-required",
            trainingGroupSlug: trainingGroup.slug,
          };
        }

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
          const [existingRegistration] = await transaction
            .select({ id: registrations.id })
            .from(registrations)
            .where(
              and(
                eq(registrations.playerId, existingPlayer.id),
                eq(registrations.trainingGroupId, trainingGroup.id),
                or(
                  inArray(registrations.status, ["scheduled", "active"]),
                  and(
                    eq(registrations.status, "pending_payment"),
                    gt(registrations.reservationExpiresAt, now),
                  ),
                ),
              ),
            )
            .limit(1)
            .for("update");

          return {
            status: "rejected",
            code: existingRegistration
              ? "already-registered"
              : "renewal-required",
            trainingGroupSlug: trainingGroup.slug,
          };
        }
      }

      const [occupancy] = await transaction
        .select({ occupiedSpots: count(registrations.id) })
        .from(registrations)
        .where(
          and(
            eq(registrations.trainingGroupId, trainingGroup.id),
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

      // The insert handles the rare case where another group transaction
      // created this email after our first lookup. On a duplicate email, only
      // the same email value is written; existing contact details are never
      // overwritten by this unauthenticated public flow.
      await transaction
        .insert(guardians)
        .values({
          fullName: guardianFullName,
          email: submission.email,
          phone: submission.primaryPhone,
          secondaryPhone: submission.secondaryPhone,
          preferredContactMethod: submission.preferredContactMethod,
        })
        .onDuplicateKeyUpdate({
          set: { email: submission.email },
        });

      const [guardian] = await transaction
        .select({
          id: guardians.id,
          fullName: guardians.fullName,
          phone: guardians.phone,
          secondaryPhone: guardians.secondaryPhone,
          preferredContactMethod: guardians.preferredContactMethod,
        })
        .from(guardians)
        .where(eq(guardians.email, submission.email))
        .limit(1)
        .for("update");

      if (!guardian) {
        throw new Error("The registration guardian could not be saved.");
      }

      if (
        guardianVerificationTokenId === null &&
        !guardianDetailsMatch(guardian, submission)
      ) {
        return {
          status: "rejected",
          code: "guardian-verification-required",
          trainingGroupSlug: trainingGroup.slug,
        };
      }

      // Check again after the guardian upsert. This catches a matching player
      // created concurrently through another training-group transaction.
      const [matchingPlayer] = await transaction
        .select({ id: players.id })
        .from(players)
        .where(
          and(
            eq(players.guardianId, guardian.id),
            eq(players.fullName, playerFullName),
            eq(players.dateOfBirth, submission.dateOfBirth),
          ),
        )
        .limit(1)
        .for("update");

      if (matchingPlayer) {
        const [existingRegistration] = await transaction
          .select({ id: registrations.id })
          .from(registrations)
          .where(
            and(
              eq(registrations.playerId, matchingPlayer.id),
              eq(registrations.trainingGroupId, trainingGroup.id),
              or(
                inArray(registrations.status, ["scheduled", "active"]),
                and(
                  eq(registrations.status, "pending_payment"),
                  gt(registrations.reservationExpiresAt, now),
                ),
              ),
            ),
          )
          .limit(1)
          .for("update");

        return {
          status: "rejected",
          code: existingRegistration
            ? "already-registered"
            : "renewal-required",
          trainingGroupSlug: trainingGroup.slug,
        };
      }

      const [playerInsertResult] = await transaction.insert(players).values({
        guardianId: guardian.id,
        fullName: playerFullName,
        preferredName: submission.preferredName,
        dateOfBirth: submission.dateOfBirth,
        currentPlayingLevel: submission.currentPlayingLevel,
        currentTeamOrClub: submission.currentTeamOrClub,
        emergencyContactName: submission.emergencyContactName,
        emergencyContactRelationship: submission.emergencyContactRelationship,
        emergencyContactPhone: submission.emergencyContactPhone,
        medicalInformationEncrypted,
        coachInformationEncrypted,
      });
      const playerId = playerInsertResult.insertId;

      if (!Number.isSafeInteger(playerId) || playerId <= 0) {
        throw new Error("The registration player could not be saved.");
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
          guardianId: guardian.id,
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

      if (guardianVerificationTokenId !== null) {
        await consumeGuardianVerificationToken(
          transaction,
          guardianVerificationTokenId,
          now,
        );
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

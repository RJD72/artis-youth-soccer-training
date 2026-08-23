// This file creates a complete pending registration inside one database
// transaction. Every price, age limit, package duration, legal document, and
// capacity value is re-read from MySQL instead of trusting the browser.

import "server-only";

import { and, count, eq, gt, inArray, isNotNull, or } from "drizzle-orm";

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
  type RegistrationPeriod,
  type RegistrationPricing,
} from "@/lib/registration-calculations";
import { encryptRegistrationText } from "@/lib/registration-encryption";
import type { ValidatedRegistrationSubmission } from "@/lib/registration-form-validation";
import { createManualPaymentReference } from "@/lib/registration-payment-reference";

const requiredLegalDocumentTypes = [
  "terms_conditions",
  "participation_waiver",
  "gym_facility_rules",
] as const;

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type LockedTrainingGroup = {
  id: number;
  slug: string;
  minimumAge: number;
  maximumAge: number;
  capacity: number;
  registrationOpen: boolean;
};

type LockedProgramPackage = {
  id: number;
  durationMonths: number;
  priceCents: number;
  currency: string;
  taxBehavior: "exclusive" | "inclusive";
};

type ActiveLegalDocument = {
  id: number;
  documentType:
    | "terms_conditions"
    | "participation_waiver"
    | "gym_facility_rules"
    | "privacy_policy"
    | "cancellation_refund_policy";
};

type GuardianRecord = {
  id: number;
  fullName: string;
  phone: string;
  secondaryPhone: string | null;
  preferredContactMethod: "email" | "phone" | "text";
};

type RegistrationTransactionContext = {
  submission: ValidatedRegistrationSubmission;
  reservationExpiresAt: Date;
  now: Date;
  playerFullName: string;
  guardianFullName: string;
  medicalInformationEncrypted: string | null;
  coachInformationEncrypted: string | null;
};

type SavedPayment = {
  paymentId: number;
  manualPaymentReference: string | null;
};

export type PendingRegistrationRejectionCode =
  | "invalid-selection"
  | "registration-closed"
  | "group-full"
  | "age-mismatch"
  | "legal-documents-unavailable"
  | "already-registered"
  | "guardian-verification-required"
  | "renewal-required";

type RejectedPendingRegistration = {
  status: "rejected";
  code: PendingRegistrationRejectionCode;
  trainingGroupSlug?: string;
};

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
  | RejectedPendingRegistration;

function rejectRegistration(
  code: PendingRegistrationRejectionCode,
  trainingGroupSlug?: string,
): RejectedPendingRegistration {
  return trainingGroupSlug
    ? { status: "rejected", code, trainingGroupSlug }
    : { status: "rejected", code };
}

function requireFutureReservationExpiry(value: Date): void {
  if (Number.isNaN(value.getTime()) || value.getTime() <= Date.now()) {
    throw new TypeError("The reservation expiry must be a valid future date.");
  }
}

function requireInsertId(value: number, recordName: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`The ${recordName} could not be saved.`);
  }

  return value;
}

function getFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

function normalizePhoneForComparison(value: string | null): string | null {
  return value === null ? null : value.replace(/\D/g, "");
}

function guardianDetailsMatch(
  guardian: GuardianRecord,
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

function hasEveryRequiredLegalDocument(rows: ActiveLegalDocument[]): boolean {
  if (rows.length !== requiredLegalDocumentTypes.length) {
    return false;
  }

  const documentTypes = new Set(rows.map((row) => row.documentType));

  return requiredLegalDocumentTypes.every((documentType) =>
    documentTypes.has(documentType),
  );
}

async function lockTrainingGroup(
  transaction: DatabaseTransaction,
  trainingGroupId: number,
): Promise<LockedTrainingGroup | undefined> {
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
    .where(eq(trainingGroups.id, trainingGroupId))
    .limit(1)
    .for("update");

  return trainingGroup;
}

async function lockProgramPackage(
  transaction: DatabaseTransaction,
  programPackageId: number,
): Promise<LockedProgramPackage | undefined> {
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
        eq(programPackages.id, programPackageId),
        eq(programPackages.isActive, true),
      ),
    )
    .limit(1)
    .for("update");

  return programPackage;
}

async function lockRequiredLegalDocuments(
  transaction: DatabaseTransaction,
): Promise<ActiveLegalDocument[]> {
  return transaction
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
}

async function lockGuardianByEmail(
  transaction: DatabaseTransaction,
  email: string,
): Promise<GuardianRecord | undefined> {
  const [guardian] = await transaction
    .select({
      id: guardians.id,
      fullName: guardians.fullName,
      phone: guardians.phone,
      secondaryPhone: guardians.secondaryPhone,
      preferredContactMethod: guardians.preferredContactMethod,
    })
    .from(guardians)
    .where(eq(guardians.email, email))
    .limit(1)
    .for("update");

  return guardian;
}

async function lockMatchingPlayer(
  transaction: DatabaseTransaction,
  guardianId: number,
  playerFullName: string,
  dateOfBirth: string,
): Promise<{ id: number } | undefined> {
  const [player] = await transaction
    .select({ id: players.id })
    .from(players)
    .where(
      and(
        eq(players.guardianId, guardianId),
        eq(players.fullName, playerFullName),
        eq(players.dateOfBirth, dateOfBirth),
      ),
    )
    .limit(1)
    .for("update");

  return player;
}

async function hasCurrentRegistration(
  transaction: DatabaseTransaction,
  playerId: number,
  trainingGroupId: number,
  now: Date,
): Promise<boolean> {
  const [registration] = await transaction
    .select({ id: registrations.id })
    .from(registrations)
    .where(
      and(
        eq(registrations.playerId, playerId),
        eq(registrations.trainingGroupId, trainingGroupId),
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

  return registration !== undefined;
}

async function checkExistingFamily(
  transaction: DatabaseTransaction,
  context: RegistrationTransactionContext,
  trainingGroup: LockedTrainingGroup,
): Promise<RejectedPendingRegistration | null> {
  const guardian = await lockGuardianByEmail(
    transaction,
    context.submission.email,
  );

  if (!guardian) {
    return null;
  }

  if (!guardianDetailsMatch(guardian, context.submission)) {
    return rejectRegistration(
      "guardian-verification-required",
      trainingGroup.slug,
    );
  }

  const player = await lockMatchingPlayer(
    transaction,
    guardian.id,
    context.playerFullName,
    context.submission.dateOfBirth,
  );

  if (!player) {
    return null;
  }

  const currentlyRegistered = await hasCurrentRegistration(
    transaction,
    player.id,
    trainingGroup.id,
    context.now,
  );

  return rejectRegistration(
    currentlyRegistered ? "already-registered" : "renewal-required",
    trainingGroup.slug,
  );
}

async function getGroupOccupancy(
  transaction: DatabaseTransaction,
  trainingGroupId: number,
  now: Date,
): Promise<number> {
  const [occupancy] = await transaction
    .select({ occupiedSpots: count(registrations.id) })
    .from(registrations)
    .where(
      and(
        eq(registrations.trainingGroupId, trainingGroupId),
        or(
          inArray(registrations.status, ["scheduled", "active"]),
          and(
            eq(registrations.status, "pending_payment"),
            gt(registrations.reservationExpiresAt, now),
          ),
        ),
      ),
    );

  return occupancy?.occupiedSpots ?? 0;
}

async function saveGuardian(
  transaction: DatabaseTransaction,
  submission: ValidatedRegistrationSubmission,
  guardianFullName: string,
): Promise<GuardianRecord | null> {
  // On a duplicate email, only that same email is written. This public flow
  // never overwrites an existing family's contact details.
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

  const guardian = await lockGuardianByEmail(transaction, submission.email);

  if (!guardian) {
    throw new Error("The registration guardian could not be saved.");
  }

  return guardianDetailsMatch(guardian, submission) ? guardian : null;
}

async function saveNewPlayer(
  transaction: DatabaseTransaction,
  guardianId: number,
  context: RegistrationTransactionContext,
): Promise<number> {
  const [insertResult] = await transaction.insert(players).values({
    guardianId,
    fullName: context.playerFullName,
    preferredName: context.submission.preferredName,
    dateOfBirth: context.submission.dateOfBirth,
    currentPlayingLevel: context.submission.currentPlayingLevel,
    currentTeamOrClub: context.submission.currentTeamOrClub,
    emergencyContactName: context.submission.emergencyContactName,
    emergencyContactRelationship:
      context.submission.emergencyContactRelationship,
    emergencyContactPhone: context.submission.emergencyContactPhone,
    medicalInformationEncrypted: context.medicalInformationEncrypted,
    coachInformationEncrypted: context.coachInformationEncrypted,
  });

  return requireInsertId(insertResult.insertId, "registration player");
}

async function saveRegistration(
  transaction: DatabaseTransaction,
  playerId: number,
  trainingGroup: LockedTrainingGroup,
  programPackage: LockedProgramPackage,
  registrationPeriod: RegistrationPeriod,
  pricing: RegistrationPricing,
  context: RegistrationTransactionContext,
): Promise<number> {
  const [insertResult] = await transaction.insert(registrations).values({
    playerId,
    trainingGroupId: trainingGroup.id,
    programPackageId: programPackage.id,
    guardianRelationship: context.submission.guardianRelationship,
    status: "pending_payment",
    packagePriceCents: pricing.packagePriceCents,
    currency: programPackage.currency,
    startsOn: registrationPeriod.startsOn,
    endsOn: registrationPeriod.endsOn,
    reservationExpiresAt: context.reservationExpiresAt,
    authorizedRegistrantConfirmedAt: context.now,
    informationAccuracyConfirmedAt: context.now,
    marketingConsent: context.submission.marketingConsent,
    photoVideoConsent: context.submission.photoVideoConsent,
  });

  return requireInsertId(insertResult.insertId, "pending registration");
}

async function saveLegalAcceptances(
  transaction: DatabaseTransaction,
  registrationId: number,
  guardianId: number,
  guardianFullName: string,
  legalDocumentRows: ActiveLegalDocument[],
  acceptedAt: Date,
): Promise<void> {
  await transaction.insert(legalAcceptances).values(
    legalDocumentRows.map((legalDocument) => ({
      registrationId,
      guardianId,
      legalDocumentId: legalDocument.id,
      acceptedByName: guardianFullName,
      acceptedAt,
    })),
  );
}

async function saveManualPaymentReference(
  transaction: DatabaseTransaction,
  registrationId: number,
  paymentId: number,
  manualPaymentReference: string,
): Promise<void> {
  const [updateResult] = await transaction
    .update(payments)
    .set({ manualPaymentReference })
    .where(
      and(
        eq(payments.id, paymentId),
        eq(payments.registrationId, registrationId),
      ),
    );

  if (updateResult.affectedRows !== 1) {
    throw new Error("The e-transfer reference could not be saved.");
  }
}

async function savePendingPayment(
  transaction: DatabaseTransaction,
  registrationId: number,
  pricing: RegistrationPricing,
  currency: string,
  paymentMethod: "stripe" | "e_transfer",
): Promise<SavedPayment> {
  const [insertResult] = await transaction.insert(payments).values({
    registrationId,
    status: "pending",
    paymentMethod,
    subtotalCents: pricing.subtotalCents,
    taxCents: pricing.taxCents,
    totalCents: pricing.totalCents,
    currency,
  });
  const paymentId = requireInsertId(insertResult.insertId, "pending payment");
  const manualPaymentReference =
    paymentMethod === "e_transfer"
      ? createManualPaymentReference(paymentId)
      : null;

  if (manualPaymentReference) {
    await saveManualPaymentReference(
      transaction,
      registrationId,
      paymentId,
      manualPaymentReference,
    );
  }

  return { paymentId, manualPaymentReference };
}

function isPlayerAgeEligible(
  dateOfBirth: string,
  startsOn: string,
  trainingGroup: LockedTrainingGroup,
): boolean {
  const playerAge = calculateAgeOnDate(dateOfBirth, startsOn);

  return (
    playerAge >= trainingGroup.minimumAge &&
    playerAge <= trainingGroup.maximumAge
  );
}

async function executeRegistrationTransaction(
  transaction: DatabaseTransaction,
  context: RegistrationTransactionContext,
): Promise<PendingRegistrationCreationOutcome> {
  // The group lock serializes capacity decisions, preventing two visitors
  // from both claiming the final available place.
  const trainingGroup = await lockTrainingGroup(
    transaction,
    context.submission.trainingGroupId,
  );

  if (!trainingGroup) {
    return rejectRegistration("invalid-selection");
  }

  if (!trainingGroup.registrationOpen) {
    return rejectRegistration("registration-closed", trainingGroup.slug);
  }

  const programPackage = await lockProgramPackage(
    transaction,
    context.submission.programPackageId,
  );

  if (!programPackage) {
    return rejectRegistration("invalid-selection", trainingGroup.slug);
  }

  const registrationPeriod = calculateRegistrationPeriod(
    programPackage.durationMonths,
    context.now,
  );

  if (
    !isPlayerAgeEligible(
      context.submission.dateOfBirth,
      registrationPeriod.startsOn,
      trainingGroup,
    )
  ) {
    return rejectRegistration("age-mismatch", trainingGroup.slug);
  }

  const legalDocumentRows = await lockRequiredLegalDocuments(transaction);

  if (!hasEveryRequiredLegalDocument(legalDocumentRows)) {
    return rejectRegistration(
      "legal-documents-unavailable",
      trainingGroup.slug,
    );
  }

  const existingFamilyRejection = await checkExistingFamily(
    transaction,
    context,
    trainingGroup,
  );

  if (existingFamilyRejection) {
    return existingFamilyRejection;
  }

  const occupiedSpots = await getGroupOccupancy(
    transaction,
    trainingGroup.id,
    context.now,
  );

  if (occupiedSpots >= trainingGroup.capacity) {
    return rejectRegistration("group-full", trainingGroup.slug);
  }

  const guardian = await saveGuardian(
    transaction,
    context.submission,
    context.guardianFullName,
  );

  if (!guardian) {
    return rejectRegistration(
      "guardian-verification-required",
      trainingGroup.slug,
    );
  }

  // Recheck after the guardian upsert to catch a matching player created
  // concurrently through a different training-group transaction.
  const concurrentFamilyRejection = await checkExistingFamily(
    transaction,
    context,
    trainingGroup,
  );

  if (concurrentFamilyRejection) {
    return concurrentFamilyRejection;
  }

  const playerId = await saveNewPlayer(transaction, guardian.id, context);
  const pricing = calculateRegistrationPricing(
    programPackage.priceCents,
    programPackage.taxBehavior,
  );
  const registrationId = await saveRegistration(
    transaction,
    playerId,
    trainingGroup,
    programPackage,
    registrationPeriod,
    pricing,
    context,
  );

  await saveLegalAcceptances(
    transaction,
    registrationId,
    guardian.id,
    context.guardianFullName,
    legalDocumentRows,
    context.now,
  );

  const savedPayment = await savePendingPayment(
    transaction,
    registrationId,
    pricing,
    programPackage.currency,
    context.submission.paymentMethod,
  );

  return {
    status: "created",
    registrationId,
    paymentId: savedPayment.paymentId,
    paymentMethod: context.submission.paymentMethod,
    manualPaymentReference: savedPayment.manualPaymentReference,
    trainingGroupSlug: trainingGroup.slug,
    startsOn: registrationPeriod.startsOn,
    endsOn: registrationPeriod.endsOn,
    subtotalCents: pricing.subtotalCents,
    taxCents: pricing.taxCents,
    totalCents: pricing.totalCents,
    currency: programPackage.currency,
  };
}

export async function createPendingRegistration(
  submission: ValidatedRegistrationSubmission,
  reservationExpiresAt: Date,
): Promise<PendingRegistrationCreationOutcome> {
  requireFutureReservationExpiry(reservationExpiresAt);

  const context: RegistrationTransactionContext = {
    submission,
    reservationExpiresAt,
    now: new Date(),
    playerFullName: getFullName(
      submission.childFirstName,
      submission.childLastName,
    ),
    guardianFullName: getFullName(
      submission.guardianFirstName,
      submission.guardianLastName,
    ),
    medicalInformationEncrypted: encryptRegistrationText(
      submission.medicalInformation,
    ),
    coachInformationEncrypted: encryptRegistrationText(
      submission.coachInformation,
    ),
  };

  return db.transaction((transaction) =>
    executeRegistrationTransaction(transaction, context),
  );
}

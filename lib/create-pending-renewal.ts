// This server-only service creates a pending renewal for an existing player.
// The token, package, dates, price, legal documents, duplicate checks and
// capacity are all verified again while the relevant MySQL rows are locked.

import "server-only";

import {
  and,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
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
  renewalVerificationTokens,
  trainingGroups,
} from "@/db/schema";
import {
  calculateAgeOnDate,
  calculateRegistrationPeriod,
  calculateRegistrationPricing,
  type RegistrationPricing,
} from "@/lib/registration-calculations";
import { createManualPaymentReference } from "@/lib/registration-payment-reference";
import { getRenewalVerificationTokenHash } from "@/lib/renewal-verification-token";
import { synchronizeRegistrationStatuses } from "@/lib/synchronize-registration-statuses";

const requiredLegalDocumentTypes = [
  "terms_conditions",
  "participation_waiver",
  "gym_facility_rules",
] as const;

const reservationLifetimeMilliseconds = {
  stripe: 60 * 60 * 1_000,
  e_transfer: 24 * 60 * 60 * 1_000,
} as const;

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type RenewalPaymentMethod = keyof typeof reservationLifetimeMilliseconds;

export type PendingRenewalSubmission = {
  programPackageId: number;
  paymentMethod: RenewalPaymentMethod;
  authorizedRegistrantConfirmed: true;
  informationAccuracyConfirmed: true;
  termsAccepted: true;
  participationWaiverAccepted: true;
  gymRulesAccepted: true;
  marketingConsent: boolean;
  photoVideoConsent: boolean;
};

export type PendingRenewalRejectionCode =
  | "invalid-token"
  | "invalid-submission"
  | "invalid-selection"
  | "payment-pending"
  | "upcoming-registration"
  | "registration-history-unavailable"
  | "age-mismatch"
  | "legal-documents-unavailable"
  | "group-full";

export type PendingRenewalCreationOutcome =
  | {
      status: "created";
      registrationId: number;
      paymentId: number;
      paymentMethod: RenewalPaymentMethod;
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
      code: PendingRenewalRejectionCode;
    };

type LockedRenewalIdentity = {
  tokenId: number;
  playerId: number;
  playerName: string;
  dateOfBirth: string;
  guardianId: number;
  guardianName: string;
};

type LockedTrainingGroup = {
  id: number;
  slug: string;
  minimumAge: number;
  maximumAge: number;
  capacity: number;
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

type LatestRegistration = {
  trainingGroupId: number;
  guardianRelationship: string | null;
};

type RenewalPeriod = {
  startsOn: string;
  endsOn: string;
};

type SavedPayment = {
  paymentId: number;
  manualPaymentReference: string | null;
};

type RenewalTransactionContext = {
  tokenHash: string;
  submission: PendingRenewalSubmission;
  now: Date;
  today: string;
  reservationExpiresAt: Date;
};

function rejectRenewal(
  code: PendingRenewalRejectionCode,
): PendingRenewalCreationOutcome {
  return { status: "rejected", code };
}

function isValidDatabaseId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 4_294_967_295;
}

function isValidSubmission(value: PendingRenewalSubmission): boolean {
  return (
    isValidDatabaseId(value.programPackageId) &&
    (value.paymentMethod === "stripe" ||
      value.paymentMethod === "e_transfer") &&
    value.authorizedRegistrantConfirmed === true &&
    value.informationAccuracyConfirmed === true &&
    value.termsAccepted === true &&
    value.participationWaiverAccepted === true &&
    value.gymRulesAccepted === true &&
    typeof value.marketingConsent === "boolean" &&
    typeof value.photoVideoConsent === "boolean"
  );
}

function requireInsertId(value: number, recordName: string): number {
  if (!isValidDatabaseId(value)) {
    throw new Error(`The ${recordName} could not be saved.`);
  }

  return value;
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

function parseIsoCalendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error("A stored registration date is invalid.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("A stored registration date is invalid.");
  }

  return date;
}

function formatUtcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getRenewalStartDate(paidThrough: string | null, now: Date): string {
  const normalStartDate = calculateRegistrationPeriod(1, now).startsOn;

  if (paidThrough === null) {
    return normalStartDate;
  }

  const dayAfterPaidPeriod = parseIsoCalendarDate(paidThrough);
  dayAfterPaidPeriod.setUTCDate(dayAfterPaidPeriod.getUTCDate() + 1);
  const nextAvailableDate = formatUtcDate(dayAfterPaidPeriod);

  return nextAvailableDate > normalStartDate
    ? nextAvailableDate
    : normalStartDate;
}

function calculateRenewalPeriod(
  startsOn: string,
  durationMonths: number,
): RenewalPeriod {
  if (
    !Number.isSafeInteger(durationMonths) ||
    durationMonths <= 0 ||
    durationMonths > 120
  ) {
    throw new Error("A stored program-package duration is invalid.");
  }

  const startDate = parseIsoCalendarDate(startsOn);
  const endsOnDate = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth() + durationMonths,
      0,
    ),
  );

  return {
    startsOn,
    endsOn: formatUtcDate(endsOnDate),
  };
}

async function lockRenewalIdentity(
  transaction: DatabaseTransaction,
  tokenHash: string,
  now: Date,
): Promise<LockedRenewalIdentity | null> {
  const [identity] = await transaction
    .select({
      tokenId: renewalVerificationTokens.id,
      playerId: players.id,
      playerName: players.fullName,
      dateOfBirth: players.dateOfBirth,
      guardianId: guardians.id,
      guardianName: guardians.fullName,
    })
    .from(renewalVerificationTokens)
    .innerJoin(players, eq(renewalVerificationTokens.playerId, players.id))
    .innerJoin(guardians, eq(players.guardianId, guardians.id))
    .where(
      and(
        eq(renewalVerificationTokens.tokenHash, tokenHash),
        isNull(renewalVerificationTokens.consumedAt),
        gt(renewalVerificationTokens.expiresAt, now),
      ),
    )
    .limit(1)
    .for("update");

  return identity ?? null;
}

async function findActivePendingPayment(
  transaction: DatabaseTransaction,
  playerId: number,
  now: Date,
): Promise<boolean> {
  const [pendingRegistration] = await transaction
    .select({ id: registrations.id })
    .from(registrations)
    .where(
      and(
        eq(registrations.playerId, playerId),
        eq(registrations.status, "pending_payment"),
        gt(registrations.reservationExpiresAt, now),
      ),
    )
    .limit(1)
    .for("update");

  return pendingRegistration !== undefined;
}

async function findFutureRegistration(
  transaction: DatabaseTransaction,
  playerId: number,
  today: string,
): Promise<boolean> {
  const [futureRegistration] = await transaction
    .select({ id: registrations.id })
    .from(registrations)
    .where(
      and(
        eq(registrations.playerId, playerId),
        eq(registrations.status, "scheduled"),
        isNotNull(registrations.startsOn),
        gt(registrations.startsOn, today),
      ),
    )
    .limit(1)
    .for("update");

  return futureRegistration !== undefined;
}

async function lockLatestRegistration(
  transaction: DatabaseTransaction,
  playerId: number,
): Promise<LatestRegistration | null> {
  const [latestRegistration] = await transaction
    .select({
      trainingGroupId: registrations.trainingGroupId,
      guardianRelationship: registrations.guardianRelationship,
    })
    .from(registrations)
    .innerJoin(payments, eq(payments.registrationId, registrations.id))
    .where(
      and(
        eq(registrations.playerId, playerId),
        inArray(registrations.status, ["scheduled", "active", "expired"]),
        eq(payments.status, "succeeded"),
      ),
    )
    .orderBy(desc(registrations.endsOn), desc(registrations.createdAt))
    .limit(1)
    .for("update");

  return latestRegistration ?? null;
}

async function lockLatestPaidThrough(
  transaction: DatabaseTransaction,
  playerId: number,
): Promise<string | null> {
  const [latestPaidRegistration] = await transaction
    .select({ endsOn: registrations.endsOn })
    .from(registrations)
    .innerJoin(payments, eq(payments.registrationId, registrations.id))
    .where(
      and(
        eq(registrations.playerId, playerId),
        inArray(registrations.status, ["scheduled", "active", "expired"]),
        eq(payments.status, "succeeded"),
        isNotNull(registrations.endsOn),
      ),
    )
    .orderBy(desc(registrations.endsOn))
    .limit(1)
    .for("update");

  return latestPaidRegistration?.endsOn ?? null;
}

async function lockTrainingGroup(
  transaction: DatabaseTransaction,
  trainingGroupId: number,
): Promise<LockedTrainingGroup | null> {
  const [trainingGroup] = await transaction
    .select({
      id: trainingGroups.id,
      slug: trainingGroups.slug,
      minimumAge: trainingGroups.minimumAge,
      maximumAge: trainingGroups.maximumAge,
      capacity: trainingGroups.capacity,
    })
    .from(trainingGroups)
    .where(eq(trainingGroups.id, trainingGroupId))
    .limit(1)
    .for("update");

  return trainingGroup ?? null;
}

async function lockProgramPackage(
  transaction: DatabaseTransaction,
  programPackageId: number,
): Promise<LockedProgramPackage | null> {
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

  return programPackage ?? null;
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

function hasEveryRequiredLegalDocument(rows: ActiveLegalDocument[]): boolean {
  if (rows.length !== requiredLegalDocumentTypes.length) {
    return false;
  }

  const documentTypes = new Set(rows.map((row) => row.documentType));

  return requiredLegalDocumentTypes.every((documentType) =>
    documentTypes.has(documentType),
  );
}

async function countOtherPlayersForPeriod(
  transaction: DatabaseTransaction,
  playerId: number,
  trainingGroupId: number,
  period: RenewalPeriod,
  now: Date,
): Promise<number> {
  const [occupancy] = await transaction
    .select({ occupiedSpots: countDistinct(registrations.playerId) })
    .from(registrations)
    .where(
      and(
        eq(registrations.trainingGroupId, trainingGroupId),
        ne(registrations.playerId, playerId),
        isNotNull(registrations.startsOn),
        isNotNull(registrations.endsOn),
        lte(registrations.startsOn, period.endsOn),
        gte(registrations.endsOn, period.startsOn),
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

async function saveRegistration(
  transaction: DatabaseTransaction,
  identity: LockedRenewalIdentity,
  latestRegistration: LatestRegistration,
  trainingGroup: LockedTrainingGroup,
  programPackage: LockedProgramPackage,
  period: RenewalPeriod,
  pricing: RegistrationPricing,
  context: RenewalTransactionContext,
): Promise<number> {
  const [insertResult] = await transaction.insert(registrations).values({
    playerId: identity.playerId,
    trainingGroupId: trainingGroup.id,
    programPackageId: programPackage.id,
    guardianRelationship: latestRegistration.guardianRelationship,
    status: "pending_payment",
    packagePriceCents: pricing.packagePriceCents,
    currency: programPackage.currency,
    startsOn: period.startsOn,
    endsOn: period.endsOn,
    reservationExpiresAt: context.reservationExpiresAt,
    authorizedRegistrantConfirmedAt: context.now,
    informationAccuracyConfirmedAt: context.now,
    marketingConsent: context.submission.marketingConsent,
    photoVideoConsent: context.submission.photoVideoConsent,
  });

  return requireInsertId(insertResult.insertId, "pending renewal");
}

async function saveLegalAcceptances(
  transaction: DatabaseTransaction,
  registrationId: number,
  identity: LockedRenewalIdentity,
  legalDocumentRows: ActiveLegalDocument[],
  acceptedAt: Date,
): Promise<void> {
  await transaction.insert(legalAcceptances).values(
    legalDocumentRows.map((legalDocument) => ({
      registrationId,
      guardianId: identity.guardianId,
      legalDocumentId: legalDocument.id,
      acceptedByName: identity.guardianName,
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
  paymentMethod: RenewalPaymentMethod,
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

async function consumeToken(
  transaction: DatabaseTransaction,
  tokenId: number,
  now: Date,
): Promise<void> {
  const [updateResult] = await transaction
    .update(renewalVerificationTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(renewalVerificationTokens.id, tokenId),
        isNull(renewalVerificationTokens.consumedAt),
        gt(renewalVerificationTokens.expiresAt, now),
      ),
    );

  if (updateResult.affectedRows !== 1) {
    throw new Error("The renewal token could not be consumed.");
  }
}

async function executeRenewalTransaction(
  transaction: DatabaseTransaction,
  context: RenewalTransactionContext,
): Promise<PendingRenewalCreationOutcome> {
  const identity = await lockRenewalIdentity(
    transaction,
    context.tokenHash,
    context.now,
  );

  if (!identity) {
    return rejectRenewal("invalid-token");
  }

  if (
    await findActivePendingPayment(transaction, identity.playerId, context.now)
  ) {
    return rejectRenewal("payment-pending");
  }

  if (
    await findFutureRegistration(transaction, identity.playerId, context.today)
  ) {
    return rejectRenewal("upcoming-registration");
  }

  const latestRegistration = await lockLatestRegistration(
    transaction,
    identity.playerId,
  );

  if (!latestRegistration) {
    return rejectRenewal("registration-history-unavailable");
  }

  // The group is derived from trusted registration history. The public
  // registration-open switch controls new families; it does not remove an
  // existing player's ability to continue in their established group.
  const trainingGroup = await lockTrainingGroup(
    transaction,
    latestRegistration.trainingGroupId,
  );
  const programPackage = await lockProgramPackage(
    transaction,
    context.submission.programPackageId,
  );

  if (!trainingGroup || !programPackage) {
    return rejectRenewal("invalid-selection");
  }

  const paidThrough = await lockLatestPaidThrough(
    transaction,
    identity.playerId,
  );
  const period = calculateRenewalPeriod(
    getRenewalStartDate(paidThrough, context.now),
    programPackage.durationMonths,
  );
  const playerAge = calculateAgeOnDate(identity.dateOfBirth, period.startsOn);

  if (
    playerAge < trainingGroup.minimumAge ||
    playerAge > trainingGroup.maximumAge
  ) {
    return rejectRenewal("age-mismatch");
  }

  const legalDocumentRows = await lockRequiredLegalDocuments(transaction);

  if (!hasEveryRequiredLegalDocument(legalDocumentRows)) {
    return rejectRenewal("legal-documents-unavailable");
  }

  const otherPlayers = await countOtherPlayersForPeriod(
    transaction,
    identity.playerId,
    trainingGroup.id,
    period,
    context.now,
  );

  if (otherPlayers >= trainingGroup.capacity) {
    return rejectRenewal("group-full");
  }

  const pricing = calculateRegistrationPricing(
    programPackage.priceCents,
    programPackage.taxBehavior,
  );
  const registrationId = await saveRegistration(
    transaction,
    identity,
    latestRegistration,
    trainingGroup,
    programPackage,
    period,
    pricing,
    context,
  );

  await saveLegalAcceptances(
    transaction,
    registrationId,
    identity,
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

  await consumeToken(transaction, identity.tokenId, context.now);

  return {
    status: "created",
    registrationId,
    paymentId: savedPayment.paymentId,
    paymentMethod: context.submission.paymentMethod,
    manualPaymentReference: savedPayment.manualPaymentReference,
    trainingGroupSlug: trainingGroup.slug,
    startsOn: period.startsOn,
    endsOn: period.endsOn,
    subtotalCents: pricing.subtotalCents,
    taxCents: pricing.taxCents,
    totalCents: pricing.totalCents,
    currency: programPackage.currency,
  };
}

export async function createPendingRenewal(
  token: unknown,
  submission: PendingRenewalSubmission,
): Promise<PendingRenewalCreationOutcome> {
  const tokenHash = getRenewalVerificationTokenHash(token);

  if (tokenHash === null) {
    return rejectRenewal("invalid-token");
  }

  if (!isValidSubmission(submission)) {
    return rejectRenewal("invalid-submission");
  }

  const now = new Date();

  await synchronizeRegistrationStatuses(now);

  const context: RenewalTransactionContext = {
    tokenHash,
    submission,
    now,
    today: getTorontoCalendarDate(now),
    reservationExpiresAt: new Date(
      now.getTime() + reservationLifetimeMilliseconds[submission.paymentMethod],
    ),
  };

  return db.transaction((transaction) =>
    executeRenewalTransaction(transaction, context),
  );
}

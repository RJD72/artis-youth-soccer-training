// This server-only reader prepares the safe information shown after a guardian
// matches a player. It does not reserve a place; the final renewal transaction
// must re-read and lock every important record.

import "server-only";

import { and, countDistinct, desc, eq, gt, gte, inArray, isNotNull, lte, ne, or } from "drizzle-orm";

import { db } from "@/db";
import {
  payments,
  players,
  programPackages,
  registrations,
  trainingGroups,
} from "@/db/schema";
import { calculateAgeOnDate, calculateRegistrationPeriod } from "@/lib/registration-calculations";
import { synchronizeRegistrationStatuses } from "@/lib/synchronize-registration-statuses";

type RenewalProgramPackage = {
  id: number;
  slug: string;
  displayName: string;
  durationMonths: number;
  priceCents: number;
  currency: string;
  taxBehavior: "exclusive" | "inclusive";
};

export type RenewalOptionsResult =
  | {
      status: "invalid-token";
    }
  | {
      status: "blocked";
      reason:
        | "payment-pending"
        | "upcoming-registration"
        | "registration-history-unavailable"
        | "packages-unavailable";
      playerName: string;
      paidThrough?: string;
      reservationExpiresAt?: Date;
    }
  | {
      status: "ready";
      playerId: number;
      playerName: string;
      paidThrough: string | null;
      renewsOn: string;
      trainingGroup: {
        id: number;
        slug: string;
        displayName: string;
      };
      programPackages: RenewalProgramPackage[];
    };

const maximumUnsignedInteger = 4_294_967_295;

function isValidPlayerId(value: number): boolean {
  return (
    Number.isSafeInteger(value) && value > 0 && value <= maximumUnsignedInteger
  );
}

async function findPlayerById(playerId: number) {
  const [player] = await db
    .select({ id: players.id, fullName: players.fullName })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);

  return player ?? null;
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

function getNextCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error("A stored registration date is invalid.");
  }

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );

  if (date.toISOString().slice(0, 10) !== value) {
    throw new Error("A stored registration date is invalid.");
  }
  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().slice(0, 10);
}

function getRenewalStartDate(paidThrough: string | null, now: Date): string {
  const normalStartDate = calculateRegistrationPeriod(1, now).startsOn;

  if (paidThrough === null) {
    return normalStartDate;
  }

  const dayAfterPaidPeriod = getNextCalendarDate(paidThrough);

  return dayAfterPaidPeriod > normalStartDate
    ? dayAfterPaidPeriod
    : normalStartDate;
}

async function findPendingPayment(playerId: number, now: Date) {
  const [pendingPayment] = await db
    .select({
      reservationExpiresAt: registrations.reservationExpiresAt,
    })
    .from(registrations)
    .where(
      and(
        eq(registrations.playerId, playerId),
        eq(registrations.status, "pending_payment"),
        gt(registrations.reservationExpiresAt, now),
      ),
    )
    .orderBy(desc(registrations.createdAt))
    .limit(1);

  return pendingPayment?.reservationExpiresAt ?? null;
}

async function findUpcomingRegistration(
  playerId: number,
  today: string,
): Promise<{ endsOn: string } | null> {
  const [upcomingRegistration] = await db
    .select({ endsOn: registrations.endsOn })
    .from(registrations)
    .where(
      and(
        eq(registrations.playerId, playerId),
        eq(registrations.status, "scheduled"),
        isNotNull(registrations.startsOn),
        isNotNull(registrations.endsOn),
        gt(registrations.startsOn, today),
        gte(registrations.endsOn, today),
      ),
    )
    .orderBy(desc(registrations.endsOn))
    .limit(1);

  return upcomingRegistration?.endsOn
    ? { endsOn: upcomingRegistration.endsOn }
    : null;
}

async function findLatestRegistration(playerId: number) {
  const [latestRegistration] = await db
    .select({
      trainingGroupId: trainingGroups.id,
      trainingGroupSlug: trainingGroups.slug,
      trainingGroupName: trainingGroups.displayName,
      minimumAge: trainingGroups.minimumAge,
      maximumAge: trainingGroups.maximumAge,
      capacity: trainingGroups.capacity,
      dateOfBirth: players.dateOfBirth,
    })
    .from(registrations)
    .innerJoin(
      trainingGroups,
      eq(registrations.trainingGroupId, trainingGroups.id),
    )
    .innerJoin(players, eq(registrations.playerId, players.id))
    .innerJoin(payments, eq(payments.registrationId, registrations.id))
    .where(
      and(
        eq(registrations.playerId, playerId),
        inArray(registrations.status, [
          "scheduled",
          "active",
          "expired",
        ]),
        eq(payments.status, "succeeded"),
      ),
    )
    .orderBy(desc(registrations.endsOn), desc(registrations.createdAt))
    .limit(1);

  return latestRegistration ?? null;
}

async function findLatestPaidThrough(playerId: number): Promise<string | null> {
  const [latestPaidRegistration] = await db
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
    .limit(1);

  return latestPaidRegistration?.endsOn ?? null;
}

async function getActiveProgramPackages(): Promise<RenewalProgramPackage[]> {
  return db
    .select({
      id: programPackages.id,
      slug: programPackages.slug,
      displayName: programPackages.displayName,
      durationMonths: programPackages.durationMonths,
      priceCents: programPackages.priceCents,
      currency: programPackages.currency,
      taxBehavior: programPackages.taxBehavior,
    })
    .from(programPackages)
    .where(eq(programPackages.isActive, true))
    .orderBy(programPackages.displayOrder);
}

export async function getRenewalOptionsForPlayer(
  playerId: number,
  now: Date = new Date(),
): Promise<RenewalOptionsResult> {
  if (!isValidPlayerId(playerId)) {
    return { status: "invalid-token" };
  }

  const player = await findPlayerById(playerId);

  if (!player) {
    return { status: "invalid-token" };
  }

  return getSharedRenewalOptions({
    playerId: player.id,
    playerName: player.fullName,
  }, now);
}

async function getSharedRenewalOptions(
  player: {
    playerId: number;
    playerName: string;
  },
  now: Date,
): Promise<RenewalOptionsResult> {
  await synchronizeRegistrationStatuses(now);

  const today = getTorontoCalendarDate(now);
  const [
    reservationExpiresAt,
    upcomingRegistration,
    latestRegistration,
    paidThrough,
    packages,
  ] = await Promise.all([
    findPendingPayment(player.playerId, now),
    findUpcomingRegistration(player.playerId, today),
    findLatestRegistration(player.playerId),
    findLatestPaidThrough(player.playerId),
    getActiveProgramPackages(),
  ]);

  if (reservationExpiresAt) {
    return {
      status: "blocked",
      reason: "payment-pending",
      playerName: player.playerName,
      reservationExpiresAt,
    };
  }

  if (upcomingRegistration) {
    return {
      status: "blocked",
      reason: "upcoming-registration",
      playerName: player.playerName,
      paidThrough: upcomingRegistration.endsOn,
    };
  }

  if (!latestRegistration) {
    return {
      status: "blocked",
      reason: "registration-history-unavailable",
      playerName: player.playerName,
    };
  }

  const renewsOn = getRenewalStartDate(paidThrough, now);
  const playerAge = calculateAgeOnDate(latestRegistration.dateOfBirth, renewsOn);
  const ageEligible = playerAge >= latestRegistration.minimumAge &&
    playerAge <= latestRegistration.maximumAge;
  // These are previews, not reservations. The final transaction repeats every
  // check under row locks; unavailable periods should not be offered here.
  const eligiblePackages = ageEligible
    ? (await Promise.all(packages.map(async (programPackage) => {
        const [year, month] = renewsOn.split("-").map(Number);
        const endsOn = new Date(Date.UTC(year, month - 1 + programPackage.durationMonths, 0))
          .toISOString().slice(0, 10);
        const [occupancy] = await db
          .select({ occupiedSpots: countDistinct(registrations.playerId) })
          .from(registrations)
          .where(and(
            eq(registrations.trainingGroupId, latestRegistration.trainingGroupId),
            ne(registrations.playerId, player.playerId),
            isNotNull(registrations.startsOn),
            isNotNull(registrations.endsOn),
            lte(registrations.startsOn, endsOn),
            gte(registrations.endsOn, renewsOn),
            or(
              inArray(registrations.status, ["scheduled", "active"]),
              and(eq(registrations.status, "pending_payment"), gt(registrations.reservationExpiresAt, now)),
            ),
          ));
        return (occupancy?.occupiedSpots ?? 0) < latestRegistration.capacity ? programPackage : null;
      }))).filter((programPackage): programPackage is RenewalProgramPackage => programPackage !== null)
    : [];

  if (eligiblePackages.length === 0) {
    return {
      status: "blocked",
      reason: "packages-unavailable",
      playerName: player.playerName,
      ...(paidThrough ? { paidThrough } : {}),
    };
  }

  return {
    status: "ready",
    playerId: player.playerId,
    playerName: player.playerName,
    paidThrough,
    renewsOn,
    trainingGroup: {
      id: latestRegistration.trainingGroupId,
      slug: latestRegistration.trainingGroupSlug,
      displayName: latestRegistration.trainingGroupName,
    },
    programPackages: eligiblePackages,
  };
}

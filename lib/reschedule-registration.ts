// Lets an administrator move a scheduled registration to another start month
// while preserving the purchased package length and protecting group capacity.

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
import {
  players,
  programPackages,
  registrations,
  trainingGroups,
} from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";
import { calculateAgeOnDate } from "@/lib/registration-calculations";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MAXIMUM_MONTHS_AHEAD = 24;

export type RegistrationReschedulingRejectionCode =
  | "invalid-registration-id"
  | "invalid-start-month"
  | "start-month-too-early"
  | "start-month-too-late"
  | "registration-not-found"
  | "registration-not-reschedulable"
  | "training-group-unavailable"
  | "program-package-unavailable"
  | "age-mismatch"
  | "player-period-conflict"
  | "training-group-full";

export type RegistrationReschedulingOutcome =
  | {
      status: "rescheduled" | "unchanged";
      registrationStatus: "scheduled" | "active";
      startsOn: string;
      endsOn: string;
    }
  | {
      status: "rejected";
      code: RegistrationReschedulingRejectionCode;
    };

type LockedScheduledRegistration = {
  id: number;
  playerId: number;
  trainingGroupId: number;
  programPackageId: number;
  status:
    | "pending_payment"
    | "scheduled"
    | "active"
    | "waitlisted"
    | "expired"
    | "cancelled";
  startsOn: string | null;
  endsOn: string | null;
};

type RegistrationPeriod = {
  startsOn: string;
  endsOn: string;
};

function rejectRescheduling(
  code: RegistrationReschedulingRejectionCode,
): RegistrationReschedulingOutcome {
  return { status: "rejected", code };
}

function getDatabaseId(value: unknown): number | null {
  const id = typeof value === "number" ? value : Number(value);

  return Number.isSafeInteger(id) && id > 0 && id <= 4_294_967_295 ? id : null;
}

function formatUtcDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTorontoCalendarDate(value: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw new TypeError("The current Toronto calendar date could not be read.");
  }

  return { year, month, day };
}

function parseStartMonth(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-01$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const startMonth = new Date(Date.UTC(year, month - 1, 1));

  if (
    startMonth.getUTCFullYear() !== year ||
    startMonth.getUTCMonth() !== month - 1
  ) {
    return null;
  }

  return startMonth;
}

function getMonthDifference(earlierMonth: Date, laterMonth: Date): number {
  return (
    (laterMonth.getUTCFullYear() - earlierMonth.getUTCFullYear()) * 12 +
    laterMonth.getUTCMonth() -
    earlierMonth.getUTCMonth()
  );
}

function calculateRegistrationPeriod(
  startMonth: Date,
  durationMonths: number,
): RegistrationPeriod {
  if (!Number.isSafeInteger(durationMonths) || durationMonths <= 0) {
    throw new TypeError("The program package duration is invalid.");
  }

  const endsOn = new Date(
    Date.UTC(
      startMonth.getUTCFullYear(),
      startMonth.getUTCMonth() + durationMonths,
      0,
    ),
  );

  return {
    startsOn: formatUtcDate(startMonth),
    endsOn: formatUtcDate(endsOn),
  };
}

async function lockRegistration(
  transaction: DatabaseTransaction,
  registrationId: number,
): Promise<LockedScheduledRegistration | null> {
  const [registration] = await transaction
    .select({
      id: registrations.id,
      playerId: registrations.playerId,
      trainingGroupId: registrations.trainingGroupId,
      programPackageId: registrations.programPackageId,
      status: registrations.status,
      startsOn: registrations.startsOn,
      endsOn: registrations.endsOn,
    })
    .from(registrations)
    .where(eq(registrations.id, registrationId))
    .limit(1)
    .for("update");

  return registration ?? null;
}

async function hasPlayerPeriodConflict(
  transaction: DatabaseTransaction,
  registration: LockedScheduledRegistration,
  period: RegistrationPeriod,
  now: Date,
): Promise<boolean> {
  const [conflict] = await transaction
    .select({ id: registrations.id })
    .from(registrations)
    .where(
      and(
        eq(registrations.playerId, registration.playerId),
        ne(registrations.id, registration.id),
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
    )
    .limit(1)
    .for("update");

  return conflict !== undefined;
}

async function countOtherOccupiedSpots(
  transaction: DatabaseTransaction,
  registration: LockedScheduledRegistration,
  period: RegistrationPeriod,
  now: Date,
): Promise<number> {
  const [occupancy] = await transaction
    .select({ occupiedSpots: countDistinct(registrations.playerId) })
    .from(registrations)
    .where(
      and(
        eq(registrations.trainingGroupId, registration.trainingGroupId),
        ne(registrations.id, registration.id),
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

async function executeRescheduling(
  transaction: DatabaseTransaction,
  registrationId: number,
  startMonth: Date,
  now: Date,
  today: string,
): Promise<RegistrationReschedulingOutcome> {
  const registration = await lockRegistration(transaction, registrationId);

  if (!registration) {
    return rejectRescheduling("registration-not-found");
  }

  if (registration.status !== "scheduled") {
    return rejectRescheduling("registration-not-reschedulable");
  }

  const [trainingGroup] = await transaction
    .select({
      capacity: trainingGroups.capacity,
      minimumAge: trainingGroups.minimumAge,
      maximumAge: trainingGroups.maximumAge,
    })
    .from(trainingGroups)
    .where(eq(trainingGroups.id, registration.trainingGroupId))
    .limit(1)
    .for("update");

  if (!trainingGroup) {
    return rejectRescheduling("training-group-unavailable");
  }

  const [programPackage] = await transaction
    .select({ durationMonths: programPackages.durationMonths })
    .from(programPackages)
    .where(eq(programPackages.id, registration.programPackageId))
    .limit(1)
    .for("update");

  if (!programPackage) {
    return rejectRescheduling("program-package-unavailable");
  }

  const [player] = await transaction
    .select({ dateOfBirth: players.dateOfBirth })
    .from(players)
    .where(eq(players.id, registration.playerId))
    .limit(1)
    .for("update");

  if (!player) {
    return rejectRescheduling("registration-not-found");
  }

  const period = calculateRegistrationPeriod(
    startMonth,
    programPackage.durationMonths,
  );
  const playerAge = calculateAgeOnDate(player.dateOfBirth, period.startsOn);

  if (
    playerAge < trainingGroup.minimumAge ||
    playerAge > trainingGroup.maximumAge
  ) {
    return rejectRescheduling("age-mismatch");
  }

  if (
    registration.startsOn === period.startsOn &&
    registration.endsOn === period.endsOn
  ) {
    return {
      status: "unchanged",
      registrationStatus: "scheduled",
      ...period,
    };
  }

  if (await hasPlayerPeriodConflict(transaction, registration, period, now)) {
    return rejectRescheduling("player-period-conflict");
  }

  const occupiedSpots = await countOtherOccupiedSpots(
    transaction,
    registration,
    period,
    now,
  );

  if (occupiedSpots >= trainingGroup.capacity) {
    return rejectRescheduling("training-group-full");
  }

  const registrationStatus = period.startsOn <= today ? "active" : "scheduled";
  const [updateResult] = await transaction
    .update(registrations)
    .set({
      status: registrationStatus,
      startsOn: period.startsOn,
      endsOn: period.endsOn,
      activatedAt: registrationStatus === "active" ? now : null,
    })
    .where(
      and(
        eq(registrations.id, registration.id),
        eq(registrations.status, "scheduled"),
      ),
    );

  if (updateResult.affectedRows !== 1) {
    throw new Error("The registration dates could not be changed.");
  }

  return {
    status: "rescheduled",
    registrationStatus,
    ...period,
  };
}

export async function rescheduleRegistration(
  registrationIdValue: unknown,
  startMonthValue: unknown,
  now: Date = new Date(),
): Promise<RegistrationReschedulingOutcome> {
  await requireAdminSession();

  const registrationId = getDatabaseId(registrationIdValue);

  if (!registrationId) {
    return rejectRescheduling("invalid-registration-id");
  }

  if (Number.isNaN(now.getTime())) {
    throw new TypeError("A valid registration rescheduling date is required.");
  }

  const startMonth = parseStartMonth(startMonthValue);

  if (!startMonth) {
    return rejectRescheduling("invalid-start-month");
  }

  const torontoDate = getTorontoCalendarDate(now);
  const currentMonth = new Date(
    Date.UTC(torontoDate.year, torontoDate.month - 1, 1),
  );
  const monthDifference = getMonthDifference(currentMonth, startMonth);

  if (monthDifference < 0) {
    return rejectRescheduling("start-month-too-early");
  }

  if (monthDifference > MAXIMUM_MONTHS_AHEAD) {
    return rejectRescheduling("start-month-too-late");
  }

  const today = formatUtcDate(
    new Date(
      Date.UTC(torontoDate.year, torontoDate.month - 1, torontoDate.day),
    ),
  );

  return db.transaction((transaction) =>
    executeRescheduling(transaction, registrationId, startMonth, now, today),
  );
}

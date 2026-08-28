// Keeps paid registration lifecycle states aligned with their calendar dates.
// The operation is safe to run before any request that depends on capacity or
// current-registration status; repeated runs simply affect zero rows.

import "server-only";

import { and, eq, gte, inArray, lt, lte } from "drizzle-orm";

import { db } from "@/db";
import { registrations } from "@/db/schema";

export type RegistrationStatusSynchronizationOutcome = {
  activated: number;
  expired: number;
};

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
    throw new Error(
      "The current Toronto calendar date could not be determined.",
    );
  }
  return `${year}-${month}-${day}`;
}

export async function synchronizeRegistrationStatuses(
  now: Date = new Date(),
): Promise<RegistrationStatusSynchronizationOutcome> {
  if (Number.isNaN(now.getTime())) {
    throw new TypeError(
      "A valid registration synchronization date must be provided.",
    );
  }

  const today = getTorontoCalendarDate(now);

  return db.transaction(async (transaction) => {
    // Expire ended terms first. This prevents an old scheduled term from being
    // activated if the synchronization process has not run for some time.
    const [expiredResult] = await transaction
      .update(registrations)
      .set({ status: "expired" })
      .where(
        and(
          inArray(registrations.status, ["scheduled", "active"]),
          lt(registrations.endsOn, today),
        ),
      );

    const [activatedResult] = await transaction
      .update(registrations)
      .set({
        status: "active",
        activatedAt: now,
      })
      .where(
        and(
          eq(registrations.status, "scheduled"),
          lte(registrations.startsOn, today),
          gte(registrations.endsOn, today),
        ),
      );

    return {
      activated: activatedResult.affectedRows,
      expired: expiredResult.affectedRows,
    };
  });
}

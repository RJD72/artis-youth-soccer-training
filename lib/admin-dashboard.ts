// This file contains server-side database queries used by the admin dashboard.
// It keeps capacity and waitlist calculations separate from the page's JSX.

import "server-only";

import { and, count, eq, gt, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import { registrations, trainingGroups, waitlistEntries } from "@/db/schema";
import { synchronizeRegistrationStatuses } from "@/lib/synchronize-registration-statuses";

export async function getTrainingGroupCapacitySummaries() {
  const now = new Date();

  await synchronizeRegistrationStatuses(now);

  const groups = await db
    .select({
      id: trainingGroups.id,
      displayName: trainingGroups.displayName,
      minimumAge: trainingGroups.minimumAge,
      maximumAge: trainingGroups.maximumAge,
      capacity: trainingGroups.capacity,
      registrationOpen: trainingGroups.registrationOpen,
      occupiedSpots: count(registrations.id),
    })
    .from(trainingGroups)
    .leftJoin(
      registrations,
      and(
        eq(registrations.trainingGroupId, trainingGroups.id),
        or(
          inArray(registrations.status, ["scheduled", "active"]),
          and(
            eq(registrations.status, "pending_payment"),
            gt(registrations.reservationExpiresAt, now),
          ),
        ),
      ),
    )
    .groupBy(
      trainingGroups.id,
      trainingGroups.displayName,
      trainingGroups.minimumAge,
      trainingGroups.maximumAge,
      trainingGroups.capacity,
      trainingGroups.registrationOpen,
    )
    .orderBy(trainingGroups.minimumAge);

  const waitingCounts = await db
    .select({
      trainingGroupId: waitlistEntries.trainingGroupId,
      waitingFamilies: count(waitlistEntries.id),
    })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.status, "waiting"))
    .groupBy(waitlistEntries.trainingGroupId);

  const waitingFamiliesByGroup = new Map(
    waitingCounts.map((group) => [
      group.trainingGroupId,
      group.waitingFamilies,
    ]),
  );

  return groups.map((group) => ({
    ...group,
    availableSpots: Math.max(group.capacity - group.occupiedSpots, 0),
    waitingFamilies: waitingFamiliesByGroup.get(group.id) ?? 0,
  }));
}

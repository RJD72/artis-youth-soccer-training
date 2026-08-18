// This file contains server-side database queries used by the admin dashboard.
// Keeping the queries here separates database rules from the page's JSX.

import "server-only";
import { and, count, eq, gt, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import { registrations, trainingGroups } from "@/db/schema";

export async function getTrainingGroupCapacitySummaries() {
  const now = new Date();

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

  return groups.map((group) => ({
    ...group,
    availableSpots: Math.max(group.capacity - group.occupiedSpots, 0),
  }));
}

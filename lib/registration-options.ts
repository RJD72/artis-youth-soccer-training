// This file provides the public-safe options needed to start a registration.
// It returns only groups currently accepting registrations that still have
// capacity, their active weekly sessions, and active program packages. It never
// returns personal information.

import "server-only";

import { and, count, eq, gt, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import {
  programPackages,
  registrations,
  trainingGroups,
  weeklySchedules,
} from "@/db/schema";
import { synchronizeRegistrationStatuses } from "@/lib/synchronize-registration-statuses";

export async function getRegistrationOptions() {
  const now = new Date();

  await synchronizeRegistrationStatuses(now);

  const [groupRows, scheduleRows, packageRows] = await Promise.all([
    db
      .select({
        id: trainingGroups.id,
        slug: trainingGroups.slug,
        displayName: trainingGroups.displayName,
        minimumAge: trainingGroups.minimumAge,
        maximumAge: trainingGroups.maximumAge,
        capacity: trainingGroups.capacity,
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
      .where(eq(trainingGroups.registrationOpen, true))
      .groupBy(
        trainingGroups.id,
        trainingGroups.slug,
        trainingGroups.displayName,
        trainingGroups.minimumAge,
        trainingGroups.maximumAge,
        trainingGroups.capacity,
      )
      .orderBy(trainingGroups.minimumAge),

    db
      .select({
        id: weeklySchedules.id,
        trainingGroupId: weeklySchedules.trainingGroupId,
        dayOfWeek: weeklySchedules.dayOfWeek,
        sessionType: weeklySchedules.sessionType,
        startTime: weeklySchedules.startTime,
        endTime: weeklySchedules.endTime,
      })
      .from(weeklySchedules)
      .innerJoin(
        trainingGroups,
        eq(weeklySchedules.trainingGroupId, trainingGroups.id),
      )
      .where(
        and(
          eq(trainingGroups.registrationOpen, true),
          eq(weeklySchedules.isActive, true),
        ),
      )
      .orderBy(weeklySchedules.dayOfWeek, weeklySchedules.startTime),

    db
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
      .orderBy(programPackages.displayOrder),
  ]);

  const trainingGroupOptions = groupRows
    .map(({ occupiedSpots, ...group }) => ({
      ...group,
      availableSpots: Math.max(group.capacity - occupiedSpots, 0),
      weeklySchedule: scheduleRows.filter(
        (session) => session.trainingGroupId === group.id,
      ),
    }))
    .filter((group) => group.availableSpots > 0);

  return {
    trainingGroups: trainingGroupOptions,
    programPackages: packageRows,
  };
}

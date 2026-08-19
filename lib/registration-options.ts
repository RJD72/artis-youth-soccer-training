// This file provides the public-safe options needed to start a registration.
// It returns only groups currently accepting registrations, their active weekly
// sessions, and active program packages. It never returns personal information.

import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { programPackages, trainingGroups, weeklySchedules } from "@/db/schema";

export async function getRegistrationOptions() {
  const [groupRows, scheduleRows, packageRows] = await Promise.all([
    db
      .select({
        id: trainingGroups.id,
        slug: trainingGroups.slug,
        displayName: trainingGroups.displayName,
        minimumAge: trainingGroups.minimumAge,
        maximumAge: trainingGroups.maximumAge,
        capacity: trainingGroups.capacity,
      })
      .from(trainingGroups)
      .where(eq(trainingGroups.registrationOpen, true))
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

  const trainingGroupOptions = groupRows.map((group) => ({
    ...group,
    weeklySchedule: scheduleRows.filter(
      (session) => session.trainingGroupId === group.id,
    ),
  }));

  return {
    trainingGroups: trainingGroupOptions,
    programPackages: packageRows,
  };
}

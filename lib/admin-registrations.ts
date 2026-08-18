// This file contains protected, read-only registration queries for administrators.
// The overview deliberately excludes medical, emergency-contact, payment-provider,
// and legal-acceptance details so sensitive data is not fetched unnecessarily.

import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  guardians,
  players,
  programPackages,
  registrations,
  trainingGroups,
} from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";

const MAX_RECENT_REGISTRATIONS = 50;

export async function getRecentAdminRegistrations() {
  await requireAdminSession();

  return db
    .select({
      id: registrations.id,
      status: registrations.status,
      createdAt: registrations.createdAt,
      startsOn: registrations.startsOn,
      endsOn: registrations.endsOn,
      reservationExpiresAt: registrations.reservationExpiresAt,
      waitlistedAt: registrations.waitlistedAt,
      packagePriceCents: registrations.packagePriceCents,
      currency: registrations.currency,
      playerName: players.fullName,
      guardianName: guardians.fullName,
      guardianEmail: guardians.email,
      guardianPhone: guardians.phone,
      trainingGroupName: trainingGroups.displayName,
      programPackageName: programPackages.displayName,
    })
    .from(registrations)
    .innerJoin(players, eq(registrations.playerId, players.id))
    .innerJoin(guardians, eq(players.guardianId, guardians.id))
    .innerJoin(
      trainingGroups,
      eq(registrations.trainingGroupId, trainingGroups.id),
    )
    .innerJoin(
      programPackages,
      eq(registrations.programPackageId, programPackages.id),
    )
    .orderBy(desc(registrations.createdAt))
    .limit(MAX_RECENT_REGISTRATIONS);
}

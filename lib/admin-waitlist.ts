// This file contains the protected, read-only waitlist query used by the
// administrator area. Keeping it separate from the page prevents database and
// authentication rules from becoming tangled with the visual layout.

import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { trainingGroups, waitlistEntries } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";

const MAX_ACTIVE_WAITLIST_ENTRIES = 100;

export async function getActiveAdminWaitlistEntries() {
  // Protect the query itself, not only the page that calls it. This prevents a
  // future developer from accidentally exposing family contact information by
  // reusing this function on an unprotected page.
  await requireAdminSession();

  const entries = await db
    .select({
      id: waitlistEntries.id,
      status: waitlistEntries.status,
      childFirstName: waitlistEntries.childFirstName,
      childLastName: waitlistEntries.childLastName,
      guardianFullName: waitlistEntries.guardianFullName,
      email: waitlistEntries.email,
      phone: waitlistEntries.phone,
      notes: waitlistEntries.notes,
      createdAt: waitlistEntries.createdAt,
      updatedAt: waitlistEntries.updatedAt,
      trainingGroupName: trainingGroups.displayName,
    })
    .from(waitlistEntries)
    .innerJoin(
      trainingGroups,
      eq(waitlistEntries.trainingGroupId, trainingGroups.id),
    )
    .where(inArray(waitlistEntries.status, ["waiting", "contacted"]))
    .orderBy(asc(waitlistEntries.createdAt))
    .limit(MAX_ACTIVE_WAITLIST_ENTRIES);

  return entries.map((entry) => ({
    ...entry,
    childName: `${entry.childFirstName} ${entry.childLastName}`,
  }));
}

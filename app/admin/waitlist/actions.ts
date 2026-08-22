// This file contains protected Server Actions for managing active waitlist
// entries. Every value is validated here because Server Actions can be called
// directly without using the visible administrator page.

"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { waitlistEntries } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";

const editableWaitlistStatuses = ["waiting", "contacted", "cancelled"] as const;

type EditableWaitlistStatus = (typeof editableWaitlistStatuses)[number];

function getWaitlistEntryId(formData: FormData): number {
  const value = formData.get("waitlistEntryId");

  if (typeof value !== "string") {
    throw new TypeError("A waitlist entry ID is required.");
  }

  const entryId = Number(value);

  if (!Number.isSafeInteger(entryId) || entryId <= 0) {
    throw new TypeError("The waitlist entry ID is invalid.");
  }

  return entryId;
}

function getWaitlistStatus(formData: FormData): EditableWaitlistStatus {
  const value = formData.get("status");

  if (
    typeof value !== "string" ||
    !editableWaitlistStatuses.some((status) => status === value)
  ) {
    throw new TypeError("The waitlist status is invalid.");
  }

  return value as EditableWaitlistStatus;
}

export async function updateWaitlistEntryStatus(formData: FormData) {
  await requireAdminSession();

  const entryId = getWaitlistEntryId(formData);
  const status = getWaitlistStatus(formData);

  const [result] = await db
    .update(waitlistEntries)
    .set({ status })
    .where(
      and(
        eq(waitlistEntries.id, entryId),
        inArray(waitlistEntries.status, ["waiting", "contacted"]),
      ),
    );

  // Only active entries may be changed from this screen. A zero result means
  // the entry does not exist or another administrator already completed it.
  if (result.affectedRows !== 1) {
    throw new Error("The waitlist entry could not be updated.");
  }

  revalidatePath("/admin/waitlist");
}

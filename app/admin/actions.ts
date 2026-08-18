// This file contains protected server actions used by the admin dashboard.
// Every action must authenticate the administrator and validate its inputs
// because server actions can be called directly, not only through our UI.

"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { trainingGroups } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";

function getTrainingGroupId(formData: FormData): number {
  const value = formData.get("trainingGroupId");

  if (typeof value !== "string") {
    throw new TypeError("A training group ID is required");
  }

  const traingGroupId = Number(value);

  if (!Number.isSafeInteger(traingGroupId) || traingGroupId <= 0) {
    throw new TypeError("The training group ID is invalid");
  }

  return traingGroupId;
}

function getRegistrationOpen(formData: FormData): boolean {
  const value = formData.get("registrationOpen");

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new TypeError("The registration open value is invalid");
}

export async function updateTrainingGroupRegistrationStatus(
  formData: FormData,
) {
  await requireAdminSession();

  const trainingGroupId = getTrainingGroupId(formData);
  const registrationOpen = getRegistrationOpen(formData);

  const [result] = await db
    .update(trainingGroups)
    .set({ registrationOpen })
    .where(eq(trainingGroups.id, trainingGroupId));

  if (result.affectedRows !== 1) {
    throw new Error("The selected training group could not be updated.");
  }

  revalidatePath("/admin");
}

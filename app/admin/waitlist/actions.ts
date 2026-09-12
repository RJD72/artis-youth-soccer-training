// This file contains protected Server Actions for managing active waitlist
// entries. Every value is validated here because Server Actions can be called
// directly without using the visible administrator page.

"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { trainingGroups, waitlistEntries } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";
import { sendAdminMessageEmail } from "@/lib/send-admin-message-email";

const editableWaitlistStatuses = [
  "waiting",
  "contacted",
  "converted",
  "cancelled",
] as const;

type EditableWaitlistStatus = (typeof editableWaitlistStatuses)[number];

export type WaitlistEmailActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

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

function getEmailField(
  formData: FormData,
  fieldName: string,
  minimumLength: number,
  maximumLength: number,
): string | null {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (normalized.length < minimumLength || normalized.length > maximumLength) {
    return null;
  }

  return normalized;
}

export async function updateWaitlistEntryStatus(formData: FormData) {
  await requireAdminSession();

  const entryId = getWaitlistEntryId(formData);
  const status = getWaitlistStatus(formData);

  const eligibleCurrentStatuses =
    status === "converted"
      ? (["contacted"] as const)
      : (["waiting", "contacted"] as const);

  const [result] = await db
    .update(waitlistEntries)
    .set({ status })
    .where(
      and(
        eq(waitlistEntries.id, entryId),
        inArray(waitlistEntries.status, eligibleCurrentStatuses),
      ),
    );

  // Only active entries may be changed from this screen. A zero result means
  // the entry does not exist or another administrator already completed it.
  if (result.affectedRows !== 1) {
    throw new Error("The waitlist entry could not be updated.");
  }

  revalidatePath("/admin/waitlist");
}

export async function sendWaitlistEntryEmail(
  _previousState: WaitlistEmailActionState,
  formData: FormData,
): Promise<WaitlistEmailActionState> {
  await requireAdminSession();

  let entryId: number;

  try {
    entryId = getWaitlistEntryId(formData);
  } catch {
    return {
      status: "error",
      message: "The waitlist entry is invalid.",
    };
  }

  const subject = getEmailField(formData, "subject", 2, 150);
  const message = getEmailField(formData, "message", 2, 5_000);

  if (!subject || !message) {
    return {
      status: "error",
      message: "Enter a subject and message before sending the email.",
    };
  }

  const [entry] = await db
    .select({
      guardianName: waitlistEntries.guardianFullName,
      guardianEmail: waitlistEntries.email,
    })
    .from(waitlistEntries)
    .where(
      and(
        eq(waitlistEntries.id, entryId),
        inArray(waitlistEntries.status, ["waiting", "contacted"]),
      ),
    )
    .limit(1);

  if (!entry) {
    return {
      status: "error",
      message: "This waitlist entry is no longer active or could not be found.",
    };
  }

  try {
    await sendAdminMessageEmail({
      guardianName: entry.guardianName,
      guardianEmail: entry.guardianEmail,
      subject,
      message,
    });
  } catch {
    return {
      status: "error",
      message: "The email could not be sent. Please try again.",
    };
  }

  return {
    status: "success",
    message: "Email sent successfully.",
  };
}

export async function offerWaitlistSpot(
  _previousState: WaitlistEmailActionState,
  formData: FormData,
): Promise<WaitlistEmailActionState> {
  await requireAdminSession();

  const rawEntryId = formData.get("waitlistEntryId");
  const entryId =
    typeof rawEntryId === "string" ? Number(rawEntryId) : Number.NaN;

  if (!Number.isSafeInteger(entryId) || entryId <= 0) {
    return {
      status: "error",
      message: "The waitlist entry is invalid.",
    };
  }

  const [entry] = await db
    .select({
      guardianName: waitlistEntries.guardianFullName,
      guardianEmail: waitlistEntries.email,
      childFirstName: waitlistEntries.childFirstName,
      groupName: trainingGroups.displayName,
    })
    .from(waitlistEntries)
    .innerJoin(
      trainingGroups,
      eq(waitlistEntries.trainingGroupId, trainingGroups.id),
    )
    .where(
      and(
        eq(waitlistEntries.id, entryId),
        eq(waitlistEntries.status, "waiting"),
      ),
    )
    .limit(1);

  if (!entry) {
    return {
      status: "error",
      message: "This waitlist entry is no longer waiting.",
    };
  }

  const subject = "A spot is available at ARTIS Soccer Academy";

  const message = [
    `A spot is now available for ${entry.childFirstName} in our ${entry.groupName} program.`,
    "",
    "If you would like to accept the available spot, please complete the registration and payment process through the ARTIS Soccer Academy website.",
    "",
    "Availability is limited, so we recommend completing registration as soon as possible.",
  ].join("\n");

  try {
    await sendAdminMessageEmail({
      guardianName: entry.guardianName,
      guardianEmail: entry.guardianEmail,
      subject,
      message,
    });
  } catch {
    return {
      status: "error",
      message: "The spot offer email could not be sent.",
    };
  }

  const [result] = await db
    .update(waitlistEntries)
    .set({ status: "contacted" })
    .where(
      and(
        eq(waitlistEntries.id, entryId),
        eq(waitlistEntries.status, "waiting"),
      ),
    );

  if (result.affectedRows !== 1) {
    return {
      status: "error",
      message:
        "The email was sent, but the waitlist status could not be updated.",
    };
  }

  revalidatePath("/admin/waitlist");

  return {
    status: "success",
    message: "Spot offer sent. The family is now marked as contacted.",
  };
}

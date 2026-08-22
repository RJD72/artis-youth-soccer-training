// This file handles public waitlist submissions on the server. Every value is
// treated as untrusted because a Server Action can be called without using the
// visible form.

"use server";

import { redirect } from "next/navigation";
import { and, count, eq, gt, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import { registrations, trainingGroups, waitlistEntries } from "@/db/schema";

type WaitlistErrorCode =
  | "invalid-form"
  | "invalid-group"
  | "space-available"
  | "waitlist-unavailable"
  | "already-waitlisted";

type ValidatedWaitlistSubmission = {
  groupSlug: string;
  childFirstName: string;
  childLastName: string;
  guardianFullName: string;
  email: string;
  phone: string;
  notes: string | null;
};

type WaitlistSubmissionOutcome =
  | {
      status: "created";
      groupSlug: string;
    }
  | {
      status: "rejected";
      groupSlug?: string;
      code: WaitlistErrorCode;
    };

function getTextField(formData: FormData, fieldName: string): string | null {
  const value = formData.get(fieldName);

  if (typeof value !== "string") {
    return null;
  }

  return value.trim().replace(/\s+/g, " ");
}

function hasValidLength(
  value: string | null,
  minimum: number,
  maximum: number,
): value is string {
  return value !== null && value.length >= minimum && value.length <= maximum;
}

function isValidEmail(value: string | null): value is string {
  return (
    hasValidLength(value, 3, 254) && /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value)
  );
}

function isValidPhone(value: string | null): value is string {
  if (!hasValidLength(value, 7, 30) || !/^[0-9()+\-.\s]+$/.test(value)) {
    return false;
  }

  const digitCount = value.replace(/\D/g, "").length;

  return digitCount >= 7 && digitCount <= 15;
}

function validateSubmission(
  formData: FormData,
): ValidatedWaitlistSubmission | null {
  const groupSlug = getTextField(formData, "trainingGroup");
  const childFirstName = getTextField(formData, "childFirstName");
  const childLastName = getTextField(formData, "childLastName");
  const guardianFullName = getTextField(formData, "guardianName");
  const email = getTextField(formData, "email")?.toLowerCase() ?? null;
  const phone = getTextField(formData, "phoneNumber");
  const notesValue = getTextField(formData, "notes");
  const notes = notesValue === "" ? null : notesValue;

  if (
    !hasValidLength(groupSlug, 1, 50) ||
    !/^[a-z0-9-]+$/.test(groupSlug) ||
    !hasValidLength(childFirstName, 1, 50) ||
    !hasValidLength(childLastName, 1, 50) ||
    !hasValidLength(guardianFullName, 1, 100) ||
    !isValidEmail(email) ||
    !isValidPhone(phone) ||
    (notes !== null && notes.length > 1000)
  ) {
    return null;
  }

  return {
    groupSlug,
    childFirstName,
    childLastName,
    guardianFullName,
    email,
    phone,
    notes,
  };
}

function redirectToForm(
  errorCode: WaitlistErrorCode,
  groupSlug?: string,
): never {
  const parameters = new URLSearchParams({ error: errorCode });

  if (groupSlug) {
    parameters.set("group", groupSlug);
  }

  redirect(`/register/waitlist?${parameters.toString()}`);
}

function redirectToConfirmation(groupSlug?: string): never {
  const parameters = new URLSearchParams();

  if (groupSlug) {
    parameters.set("group", groupSlug);
  }

  const queryString = parameters.toString();

  redirect(
    queryString
      ? `/register/waitlist/confirmation?${queryString}`
      : "/register/waitlist/confirmation",
  );
}

export async function joinWaitlist(formData: FormData) {
  const groupValue = getTextField(formData, "trainingGroup");
  const safeGroupSlug =
    groupValue && /^[a-z0-9-]{1,50}$/.test(groupValue) ? groupValue : undefined;
  const website = formData.get("website");

  // A real visitor never fills this hidden honeypot. Returning the normal
  // confirmation page gives automated spam no clue that its submission was
  // discarded.
  if (
    (typeof website === "string" && website.trim() !== "") ||
    (website !== null && typeof website !== "string")
  ) {
    redirectToConfirmation(safeGroupSlug);
  }

  const submission = validateSubmission(formData);

  if (!submission) {
    redirectToForm("invalid-form", safeGroupSlug);
  }

  const outcome: WaitlistSubmissionOutcome = await db.transaction(
    async (transaction) => {
      const [trainingGroup] = await transaction
        .select({
          id: trainingGroups.id,
          slug: trainingGroups.slug,
          capacity: trainingGroups.capacity,
          registrationOpen: trainingGroups.registrationOpen,
        })
        .from(trainingGroups)
        .where(eq(trainingGroups.slug, submission.groupSlug))
        .limit(1)
        .for("update");

      if (!trainingGroup) {
        return {
          status: "rejected",
          code: "invalid-group",
        };
      }

      const now = new Date();
      const [occupancy] = await transaction
        .select({
          occupiedSpots: count(registrations.id),
        })
        .from(registrations)
        .where(
          and(
            eq(registrations.trainingGroupId, trainingGroup.id),
            or(
              inArray(registrations.status, ["scheduled", "active"]),
              and(
                eq(registrations.status, "pending_payment"),
                gt(registrations.reservationExpiresAt, now),
              ),
            ),
          ),
        );

      const occupiedSpots = occupancy?.occupiedSpots ?? 0;

      if (occupiedSpots < trainingGroup.capacity) {
        return {
          status: "rejected",
          groupSlug: trainingGroup.slug,
          code: trainingGroup.registrationOpen
            ? "space-available"
            : "waitlist-unavailable",
        };
      }

      const [existingEntry] = await transaction
        .select({ id: waitlistEntries.id })
        .from(waitlistEntries)
        .where(
          and(
            eq(waitlistEntries.trainingGroupId, trainingGroup.id),
            eq(waitlistEntries.childFirstName, submission.childFirstName),
            eq(waitlistEntries.childLastName, submission.childLastName),
            eq(waitlistEntries.email, submission.email),
            inArray(waitlistEntries.status, ["waiting", "contacted"]),
          ),
        )
        .limit(1);

      if (existingEntry) {
        return {
          status: "rejected",
          groupSlug: trainingGroup.slug,
          code: "already-waitlisted",
        };
      }

      await transaction.insert(waitlistEntries).values({
        trainingGroupId: trainingGroup.id,
        childFirstName: submission.childFirstName,
        childLastName: submission.childLastName,
        guardianFullName: submission.guardianFullName,
        email: submission.email,
        phone: submission.phone,
        notes: submission.notes,
        status: "waiting",
      });

      return {
        status: "created",
        groupSlug: trainingGroup.slug,
      };
    },
  );

  if (outcome.status === "rejected") {
    redirectToForm(outcome.code, outcome.groupSlug);
  }

  redirectToConfirmation(outcome.groupSlug);
}

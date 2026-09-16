// Sends the ARTIS registration confirmation for a Stripe payment that has
// already been verified and recorded as succeeded.
//
// The payment row is locked while the email is sent so two concurrent
// requests cannot both send the same confirmation. The sent timestamp is
// written only after Resend accepts the email.

import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  guardians,
  payments,
  players,
  programPackages,
  registrations,
  trainingGroups,
} from "@/db/schema";
import { sendStripeRegistrationConfirmationEmail } from "@/lib/send-stripe-registration-confirmation-email";

const MAX_STRIPE_SESSION_ID_LENGTH = 255;

export type StripeRegistrationConfirmationOutcome =
  "sent" | "already-sent" | "unavailable";

function normalizeStripeSessionId(value: string): string {
  const sessionId = value.trim();

  if (
    sessionId.length === 0 ||
    sessionId.length > MAX_STRIPE_SESSION_ID_LENGTH ||
    !/^cs_[A-Za-z0-9_]+$/.test(sessionId)
  ) {
    throw new TypeError("The Stripe Checkout Session ID is invalid.");
  }

  return sessionId;
}

export async function sendConfirmedStripeRegistrationEmail(
  stripeCheckoutSessionId: string,
  now: Date = new Date(),
): Promise<StripeRegistrationConfirmationOutcome> {
  const sessionId = normalizeStripeSessionId(stripeCheckoutSessionId);

  if (Number.isNaN(now.getTime())) {
    throw new TypeError("A valid confirmation date is required.");
  }

  return db.transaction(async (transaction) => {
    const [registration] = await transaction
      .select({
        paymentId: payments.id,
        confirmationSentAt: payments.stripeRegistrationConfirmationSentAt,
        registrationId: registrations.id,
        registrationStatus: registrations.status,
        startsOn: registrations.startsOn,
        endsOn: registrations.endsOn,
        guardianName: guardians.fullName,
        guardianEmail: guardians.email,
        playerName: players.fullName,
        trainingGroupName: trainingGroups.displayName,
        programPackageName: programPackages.displayName,
      })
      .from(payments)
      .innerJoin(registrations, eq(payments.registrationId, registrations.id))
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
      .where(
        and(
          eq(payments.stripeCheckoutSessionId, sessionId),
          eq(payments.paymentMethod, "stripe"),
          eq(payments.status, "succeeded"),
          inArray(registrations.status, ["scheduled", "active"]),
        ),
      )
      .limit(1)
      .for("update");

    if (!registration) {
      return "unavailable";
    }

    if (registration.confirmationSentAt) {
      return "already-sent";
    }

    if (
      !registration.startsOn ||
      !registration.endsOn ||
      (registration.registrationStatus !== "scheduled" &&
        registration.registrationStatus !== "active")
    ) {
      return "unavailable";
    }

    await sendStripeRegistrationConfirmationEmail({
      registrationId: registration.registrationId,
      guardianName: registration.guardianName,
      guardianEmail: registration.guardianEmail,
      playerName: registration.playerName,
      trainingGroupName: registration.trainingGroupName,
      programPackageName: registration.programPackageName,
      startsOn: registration.startsOn,
      endsOn: registration.endsOn,
      registrationStatus: registration.registrationStatus,
    });

    const [updateResult] = await transaction
      .update(payments)
      .set({
        stripeRegistrationConfirmationSentAt: now,
      })
      .where(
        and(
          eq(payments.id, registration.paymentId),
          eq(payments.paymentMethod, "stripe"),
          eq(payments.status, "succeeded"),
          isNull(payments.stripeRegistrationConfirmationSentAt),
        ),
      );

    if (updateResult.affectedRows !== 1) {
      throw new Error(
        "The Stripe registration confirmation could not be recorded.",
      );
    }

    return "sent";
  });
}

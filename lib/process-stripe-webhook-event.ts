// This server-only service applies verified Stripe webhook events to MySQL.
// The API route must verify Stripe's signature before calling this function.
// Event IDs are stored so retries and duplicate deliveries remain idempotent.

import "server-only";

import type Stripe from "stripe";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { payments, registrations, stripeWebhookEvents } from "@/db/schema";

const checkoutSuccessEventTypes = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

const checkoutFailureEventTypes = new Set([
  "checkout.session.expired",
  "checkout.session.async_payment_failed",
]);

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type LockedStripeRegistration = {
  paymentId: number;
  registrationId: number;
  paymentStatus:
    | "pending"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "partially_refunded"
    | "refunded";
  registrationStatus:
    | "pending_payment"
    | "scheduled"
    | "active"
    | "waitlisted"
    | "expired"
    | "cancelled";
  totalCents: number;
  currency: string;
  startsOn: string | null;
  endsOn: string | null;
};

type CheckoutIdentifiers = {
  registrationId: number;
  paymentId: number;
};

type StripePaymentStatus = "failed" | "cancelled";

export type StripeWebhookProcessingOutcome =
  | {
      status: "duplicate";
    }
  | {
      status: "processed";
      action:
        | "payment-confirmed"
        | "payment-cancelled"
        | "payment-failed"
        | "ignored";
    };

type StripeWebhookAction = Extract<
  StripeWebhookProcessingOutcome,
  { status: "processed" }
>["action"];

function isValidDatabaseId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= 4_294_967_295;
}

function getDatabaseId(value: string | undefined): number | null {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value)) {
    return null;
  }

  const id = Number(value);

  return isValidDatabaseId(id) ? id : null;
}

function getCheckoutIdentifiers(
  session: Stripe.Checkout.Session,
): CheckoutIdentifiers | null {
  const registrationId = getDatabaseId(session.metadata?.registrationId);
  const paymentId = getDatabaseId(session.metadata?.paymentId);

  return registrationId && paymentId ? { registrationId, paymentId } : null;
}

function getStripeObjectId(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: unknown };

  return typeof object.id === "string" && object.id.length <= 255
    ? object.id
    : null;
}

function requireValidEventEnvelope(event: Stripe.Event): void {
  if (
    typeof event.id !== "string" ||
    event.id.length === 0 ||
    event.id.length > 255 ||
    typeof event.type !== "string" ||
    event.type.length === 0 ||
    event.type.length > 100
  ) {
    throw new TypeError("The Stripe event envelope is invalid.");
  }
}

function getCheckoutSession(
  event: Stripe.Event,
): Stripe.Checkout.Session | null {
  const object = event.data.object;

  return object.object === "checkout.session"
    ? (object as Stripe.Checkout.Session)
    : null;
}

function getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  const paymentIntent = session.payment_intent;
  const paymentIntentId =
    typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;

  return paymentIntentId &&
    paymentIntentId.length <= 255 &&
    /^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)
    ? paymentIntentId
    : null;
}

function getTorontoCalendarDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("The current Toronto calendar date could not be read.");
  }

  return `${year}-${month}-${day}`;
}

function getSafeFailureCode(error: unknown): string {
  const errorType = error instanceof Error ? error.name : "UnknownError";

  return `Webhook processing failed: ${errorType}`.slice(0, 200);
}

async function lockStripeRegistration(
  transaction: DatabaseTransaction,
  sessionId: string,
  identifiers: CheckoutIdentifiers,
): Promise<LockedStripeRegistration | null> {
  const [registration] = await transaction
    .select({
      paymentId: payments.id,
      registrationId: registrations.id,
      paymentStatus: payments.status,
      registrationStatus: registrations.status,
      totalCents: payments.totalCents,
      currency: payments.currency,
      startsOn: registrations.startsOn,
      endsOn: registrations.endsOn,
    })
    .from(payments)
    .innerJoin(registrations, eq(payments.registrationId, registrations.id))
    .where(
      and(
        eq(payments.id, identifiers.paymentId),
        eq(registrations.id, identifiers.registrationId),
        eq(payments.registrationId, identifiers.registrationId),
        eq(payments.paymentMethod, "stripe"),
        eq(payments.stripeCheckoutSessionId, sessionId),
      ),
    )
    .limit(1)
    .for("update");

  return registration ?? null;
}

function sessionMatchesPayment(
  session: Stripe.Checkout.Session,
  identifiers: CheckoutIdentifiers,
  registration: LockedStripeRegistration,
): boolean {
  return (
    session.mode === "payment" &&
    session.client_reference_id === String(identifiers.registrationId) &&
    session.amount_total === registration.totalCents &&
    session.currency?.toUpperCase() === registration.currency.toUpperCase()
  );
}

function canConfirmPayment(
  session: Stripe.Checkout.Session,
  registration: LockedStripeRegistration,
): registration is LockedStripeRegistration & {
  startsOn: string;
  endsOn: string;
} {
  return (
    session.status === "complete" &&
    session.payment_status === "paid" &&
    registration.paymentStatus === "pending" &&
    (registration.registrationStatus === "pending_payment" ||
      registration.registrationStatus === "expired") &&
    registration.startsOn !== null &&
    registration.endsOn !== null
  );
}

function getPaidRegistrationStatus(
  startsOn: string,
  endsOn: string,
  today: string,
): "scheduled" | "active" | "expired" {
  if (endsOn < today) {
    return "expired";
  }

  return startsOn <= today ? "active" : "scheduled";
}

async function updateSuccessfulPayment(
  transaction: DatabaseTransaction,
  registration: LockedStripeRegistration & {
    startsOn: string;
    endsOn: string;
  },
  paymentIntentId: string,
  now: Date,
  today: string,
): Promise<void> {
  const [paymentUpdate] = await transaction
    .update(payments)
    .set({
      status: "succeeded",
      stripePaymentIntentId: paymentIntentId,
      paidAt: now,
    })
    .where(
      and(
        eq(payments.id, registration.paymentId),
        eq(payments.registrationId, registration.registrationId),
        eq(payments.paymentMethod, "stripe"),
        eq(payments.status, "pending"),
      ),
    );

  if (paymentUpdate.affectedRows !== 1) {
    throw new Error("The Stripe payment could not be confirmed.");
  }

  const registrationStatus = getPaidRegistrationStatus(
    registration.startsOn,
    registration.endsOn,
    today,
  );

  const [registrationUpdate] = await transaction
    .update(registrations)
    .set({
      status: registrationStatus,
      activatedAt: registrationStatus === "active" ? now : null,
    })
    .where(
      and(
        eq(registrations.id, registration.registrationId),
        inArray(registrations.status, ["pending_payment", "expired"]),
      ),
    );

  if (registrationUpdate.affectedRows !== 1) {
    throw new Error("The paid registration could not be activated.");
  }
}

async function processSuccessfulCheckout(
  transaction: DatabaseTransaction,
  session: Stripe.Checkout.Session,
  now: Date,
): Promise<StripeWebhookAction> {
  const identifiers = getCheckoutIdentifiers(session);
  const paymentIntentId = getPaymentIntentId(session);

  if (!identifiers || !paymentIntentId) {
    return "ignored";
  }

  const registration = await lockStripeRegistration(
    transaction,
    session.id,
    identifiers,
  );

  if (
    !registration ||
    !sessionMatchesPayment(session, identifiers, registration)
  ) {
    return "ignored";
  }

  if (
    registration.paymentStatus === "succeeded" &&
    (registration.registrationStatus === "scheduled" ||
      registration.registrationStatus === "active" ||
      registration.registrationStatus === "expired")
  ) {
    return "payment-confirmed";
  }

  const today = getTorontoCalendarDate(now);

  if (!canConfirmPayment(session, registration)) {
    return "ignored";
  }

  await updateSuccessfulPayment(
    transaction,
    registration,
    paymentIntentId,
    now,
    today,
  );

  return "payment-confirmed";
}

/**
 * Reconciles a Checkout Session retrieved directly from Stripe when its
 * webhook was delayed or missed. The normal session ID, metadata, amount,
 * currency and database-state checks still apply.
 */
export async function reconcilePaidStripeCheckoutSession(
  session: Stripe.Checkout.Session,
  now: Date = new Date(),
): Promise<StripeWebhookAction> {
  if (Number.isNaN(now.getTime())) {
    throw new TypeError("A valid reconciliation date is required.");
  }

  return db.transaction((transaction) =>
    processSuccessfulCheckout(transaction, session, now),
  );
}

async function updateUnsuccessfulPayment(
  transaction: DatabaseTransaction,
  registration: LockedStripeRegistration,
  paymentStatus: StripePaymentStatus,
  now: Date,
): Promise<boolean> {
  if (
    registration.paymentStatus !== "pending" ||
    registration.registrationStatus !== "pending_payment"
  ) {
    return false;
  }

  const [paymentUpdate] = await transaction
    .update(payments)
    .set({ status: paymentStatus })
    .where(
      and(
        eq(payments.id, registration.paymentId),
        eq(payments.registrationId, registration.registrationId),
        eq(payments.paymentMethod, "stripe"),
        eq(payments.status, "pending"),
      ),
    );
  const [registrationUpdate] = await transaction
    .update(registrations)
    .set({
      status: "cancelled",
      cancelledAt: now,
    })
    .where(
      and(
        eq(registrations.id, registration.registrationId),
        eq(registrations.status, "pending_payment"),
      ),
    );

  if (
    paymentUpdate.affectedRows !== 1 ||
    registrationUpdate.affectedRows !== 1
  ) {
    throw new Error("The unsuccessful Stripe checkout could not be saved.");
  }

  return true;
}

async function processUnsuccessfulCheckout(
  transaction: DatabaseTransaction,
  session: Stripe.Checkout.Session,
  eventType: string,
  now: Date,
): Promise<StripeWebhookAction> {
  const identifiers = getCheckoutIdentifiers(session);

  if (!identifiers) {
    return "ignored";
  }

  const registration = await lockStripeRegistration(
    transaction,
    session.id,
    identifiers,
  );

  if (!registration) {
    return "ignored";
  }

  const paymentStatus: StripePaymentStatus =
    eventType === "checkout.session.expired" ? "cancelled" : "failed";
  const updated = await updateUnsuccessfulPayment(
    transaction,
    registration,
    paymentStatus,
    now,
  );

  if (!updated) {
    return "ignored";
  }

  return paymentStatus === "cancelled" ? "payment-cancelled" : "payment-failed";
}

async function applyStripeEvent(
  transaction: DatabaseTransaction,
  event: Stripe.Event,
  now: Date,
): Promise<StripeWebhookAction> {
  const session = getCheckoutSession(event);

  if (!session) {
    return "ignored";
  }

  if (checkoutSuccessEventTypes.has(event.type)) {
    return processSuccessfulCheckout(transaction, session, now);
  }

  if (checkoutFailureEventTypes.has(event.type)) {
    return processUnsuccessfulCheckout(transaction, session, event.type, now);
  }

  return "ignored";
}

async function insertEventIfMissing(
  transaction: DatabaseTransaction,
  event: Stripe.Event,
  stripeObjectId: string | null,
): Promise<void> {
  await transaction
    .insert(stripeWebhookEvents)
    .values({
      stripeEventId: event.id,
      eventType: event.type,
      stripeObjectId,
      processingStatus: "received",
      livemode: event.livemode,
    })
    .onDuplicateKeyUpdate({
      set: { stripeEventId: event.id },
    });
}

async function processEventTransaction(
  transaction: DatabaseTransaction,
  event: Stripe.Event,
  stripeObjectId: string | null,
  now: Date,
): Promise<StripeWebhookProcessingOutcome> {
  await insertEventIfMissing(transaction, event, stripeObjectId);

  const [storedEvent] = await transaction
    .select({
      id: stripeWebhookEvents.id,
      processingStatus: stripeWebhookEvents.processingStatus,
    })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.stripeEventId, event.id))
    .limit(1)
    .for("update");

  if (!storedEvent) {
    throw new Error("The Stripe event could not be recorded.");
  }

  if (storedEvent.processingStatus === "processed") {
    return { status: "duplicate" };
  }

  await transaction
    .update(stripeWebhookEvents)
    .set({
      processingStatus: "processing",
      attemptCount: sql`${stripeWebhookEvents.attemptCount} + 1`,
      lastError: null,
    })
    .where(eq(stripeWebhookEvents.id, storedEvent.id));

  const action = await applyStripeEvent(transaction, event, now);
  const [processedUpdate] = await transaction
    .update(stripeWebhookEvents)
    .set({
      processingStatus: "processed",
      processedAt: now,
      lastError: null,
    })
    .where(eq(stripeWebhookEvents.id, storedEvent.id));

  if (processedUpdate.affectedRows !== 1) {
    throw new Error("The Stripe event could not be marked as processed.");
  }

  return { status: "processed", action };
}

async function recordProcessingFailure(
  event: Stripe.Event,
  stripeObjectId: string | null,
  error: unknown,
): Promise<void> {
  const lastError = getSafeFailureCode(error);

  await db.transaction(async (transaction) => {
    await transaction
      .insert(stripeWebhookEvents)
      .values({
        stripeEventId: event.id,
        eventType: event.type,
        stripeObjectId,
        processingStatus: "failed",
        attemptCount: 0,
        lastError,
        livemode: event.livemode,
      })
      .onDuplicateKeyUpdate({
        set: { stripeEventId: event.id },
      });

    const [storedEvent] = await transaction
      .select({
        id: stripeWebhookEvents.id,
        processingStatus: stripeWebhookEvents.processingStatus,
      })
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.stripeEventId, event.id))
      .limit(1)
      .for("update");

    if (!storedEvent || storedEvent.processingStatus === "processed") {
      return;
    }

    await transaction
      .update(stripeWebhookEvents)
      .set({
        processingStatus: "failed",
        attemptCount: sql`${stripeWebhookEvents.attemptCount} + 1`,
        lastError,
      })
      .where(eq(stripeWebhookEvents.id, storedEvent.id));
  });
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
  now: Date = new Date(),
): Promise<StripeWebhookProcessingOutcome> {
  requireValidEventEnvelope(event);

  if (Number.isNaN(now.getTime())) {
    throw new TypeError("A valid webhook processing date is required.");
  }

  const stripeObjectId = getStripeObjectId(event);

  try {
    return await db.transaction((transaction) =>
      processEventTransaction(transaction, event, stripeObjectId, now),
    );
  } catch (error) {
    try {
      await recordProcessingFailure(event, stripeObjectId, error);
    } catch {
      // Preserve the original processing failure. The webhook route returns a
      // server error so Stripe retries even if failure tracking also failed.
    }

    throw error;
  }
}

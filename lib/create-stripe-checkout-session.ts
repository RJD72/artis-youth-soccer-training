// This server-only module prepares a Stripe Checkout Session for an existing
// pending registration. It verifies the signed link, re-reads every important
// value from MySQL, and never accepts a price supplied by the browser.

import "server-only";

import Stripe from "stripe";
import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import {
  guardians,
  payments,
  players,
  programPackages,
  registrations,
  trainingGroups,
} from "@/db/schema";
import {
  verifyRegistrationPaymentReference,
  type RegistrationPaymentReference,
} from "@/lib/registration-payment-reference";
import { getStripeClient } from "@/lib/stripe";

const minimumStripeSessionLifetimeSeconds = 30 * 60;
const stripeClockSafetyMarginSeconds = 30;

type PendingStripePayment = {
  paymentId: number;
  registrationId: number;
  stripeCheckoutSessionId: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  reservationExpiresAt: Date;
  guardianName: string;
  guardianEmail: string;
  playerName: string;
  trainingGroupName: string;
  packageName: string;
};

export type StripeCheckoutDisplayDetails = {
  guardianName: string;
  guardianEmail: string;
  playerName: string;
  trainingGroupName: string;
  packageName: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
};

export type StripeCheckoutPreparation =
  | {
      status: "ready";
      clientSecret: string;
      details: StripeCheckoutDisplayDetails;
    }
  | {
      status: "unavailable";
    };

function getApplicationOrigin(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ??
    process.env.BETTER_AUTH_URL?.trim();

  if (!configuredUrl) {
    throw new TypeError(
      "NEXT_PUBLIC_SITE_URL or BETTER_AUTH_URL is required for Stripe return URLs.",
    );
  }

  let url: URL;

  try {
    url = new URL(configuredUrl);
  } catch {
    throw new TypeError(
      "NEXT_PUBLIC_SITE_URL or BETTER_AUTH_URL must be a valid absolute URL.",
    );
  }

  const isLocalDevelopmentUrl =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");

  if (url.protocol !== "https:" && !isLocalDevelopmentUrl) {
    throw new TypeError(
      "The Stripe return URL must use HTTPS outside local development.",
    );
  }

  return url.origin;
}

function getStripeSessionExpiry(reservationExpiresAt: Date): number | null {
  const expiresAt = Math.floor(reservationExpiresAt.getTime() / 1_000);
  const secondsRemaining = expiresAt - Math.floor(Date.now() / 1_000);
  const requiredLifetime =
    minimumStripeSessionLifetimeSeconds + stripeClockSafetyMarginSeconds;

  return secondsRemaining >= requiredLifetime ? expiresAt : null;
}

function getStripeCurrency(currency: string): string | null {
  const normalizedCurrency = currency.trim().toLowerCase();

  return /^[a-z]{3}$/.test(normalizedCurrency) ? normalizedCurrency : null;
}

function getStripeReturnUrl(): string {
  const returnPageUrl = new URL(
    "/register/payment/stripe/return",
    getApplicationOrigin(),
  );

  // Stripe must receive this template variable with its braces intact. Using
  // URLSearchParams would encode the braces as %7B and %7D, preventing Stripe
  // from replacing the template with the completed Checkout Session ID.
  return `${returnPageUrl.toString()}?session_id={CHECKOUT_SESSION_ID}`;
}

async function findPendingStripePayment(
  registrationId: number,
  paymentId: number,
): Promise<PendingStripePayment | null> {
  const [payment] = await db
    .select({
      paymentId: payments.id,
      registrationId: registrations.id,
      stripeCheckoutSessionId: payments.stripeCheckoutSessionId,
      subtotalCents: payments.subtotalCents,
      taxCents: payments.taxCents,
      totalCents: payments.totalCents,
      currency: payments.currency,
      reservationExpiresAt: registrations.reservationExpiresAt,
      guardianName: guardians.fullName,
      guardianEmail: guardians.email,
      playerName: players.fullName,
      trainingGroupName: trainingGroups.displayName,
      packageName: programPackages.displayName,
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
        eq(payments.id, paymentId),
        eq(registrations.id, registrationId),
        eq(payments.registrationId, registrationId),
        eq(payments.paymentMethod, "stripe"),
        eq(payments.status, "pending"),
        eq(registrations.status, "pending_payment"),
        gt(registrations.reservationExpiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!payment?.reservationExpiresAt) {
    return null;
  }

  return {
    ...payment,
    reservationExpiresAt: payment.reservationExpiresAt,
  };
}

function isReusableStripeSession(
  session: Stripe.Checkout.Session,
): session is Stripe.Checkout.Session & { client_secret: string } {
  return (
    session.ui_mode === "elements" &&
    session.status === "open" &&
    session.payment_status === "unpaid" &&
    session.expires_at > Math.floor(Date.now() / 1_000) &&
    typeof session.client_secret === "string" &&
    session.client_secret.length > 0
  );
}

function isMissingStripeResource(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === "resource_missing"
  );
}

async function retrieveReusableStripeSession(
  sessionId: string | null,
): Promise<(Stripe.Checkout.Session & { client_secret: string }) | null> {
  if (!sessionId) {
    return null;
  }

  try {
    const session =
      await getStripeClient().checkout.sessions.retrieve(sessionId);

    return isReusableStripeSession(session) ? session : null;
  } catch (error) {
    // A session ID from a different sandbox can remain in a local database
    // after credentials are changed. Only that specific case is recoverable;
    // network and authentication failures must still surface to the caller.
    if (isMissingStripeResource(error)) {
      return null;
    }

    throw error;
  }
}

function buildStripeSessionParameters(
  payment: PendingStripePayment,
  expiresAt: number,
  currency: string,
): Stripe.Checkout.SessionCreateParams {
  const registrationId = String(payment.registrationId);
  const paymentId = String(payment.paymentId);

  return {
    ui_mode: "elements",
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: payment.guardianEmail,
    client_reference_id: registrationId,
    expires_at: expiresAt,
    return_url: getStripeReturnUrl(),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: payment.totalCents,
          product_data: {
            name: `${payment.trainingGroupName} — ${payment.packageName}`,
            description: "ARTIS Soccer Academy training registration",
          },
        },
      },
    ],
    metadata: {
      registrationId,
      paymentId,
    },
    payment_intent_data: {
      metadata: {
        registrationId,
        paymentId,
      },
    },
  };
}

async function saveStripeSessionId(
  payment: PendingStripePayment,
  sessionId: string,
): Promise<void> {
  const [updateResult] = await db
    .update(payments)
    .set({ stripeCheckoutSessionId: sessionId })
    .where(
      and(
        eq(payments.id, payment.paymentId),
        eq(payments.registrationId, payment.registrationId),
        eq(payments.paymentMethod, "stripe"),
        eq(payments.status, "pending"),
      ),
    );

  if (updateResult.affectedRows !== 1) {
    throw new Error("The Stripe Checkout Session could not be saved.");
  }
}

async function createStripeSession(
  payment: PendingStripePayment,
): Promise<(Stripe.Checkout.Session & { client_secret: string }) | null> {
  const expiresAt = getStripeSessionExpiry(payment.reservationExpiresAt);
  const currency = getStripeCurrency(payment.currency);

  if (!expiresAt || !currency || payment.totalCents <= 0) {
    return null;
  }

  const session = await getStripeClient().checkout.sessions.create(
    buildStripeSessionParameters(payment, expiresAt, currency),
    {
      idempotencyKey: `artis-checkout-payment-${payment.paymentId}-v1`,
    },
  );

  if (!isReusableStripeSession(session)) {
    throw new Error("Stripe did not return a usable Checkout Session.");
  }

  await saveStripeSessionId(payment, session.id);

  return session;
}

function getDisplayDetails(
  payment: PendingStripePayment,
): StripeCheckoutDisplayDetails {
  return {
    guardianName: payment.guardianName,
    guardianEmail: payment.guardianEmail,
    playerName: payment.playerName,
    trainingGroupName: payment.trainingGroupName,
    packageName: payment.packageName,
    subtotalCents: payment.subtotalCents,
    taxCents: payment.taxCents,
    totalCents: payment.totalCents,
    currency: payment.currency,
  };
}

export async function prepareStripeCheckout(
  referenceValues: RegistrationPaymentReference,
): Promise<StripeCheckoutPreparation> {
  const reference = verifyRegistrationPaymentReference(
    referenceValues.registration,
    referenceValues.payment,
    referenceValues.method,
    referenceValues.expires,
    referenceValues.signature,
  );

  if (!reference || reference.method !== "stripe") {
    return { status: "unavailable" };
  }

  const payment = await findPendingStripePayment(
    reference.registrationId,
    reference.paymentId,
  );

  if (!payment) {
    return { status: "unavailable" };
  }

  const existingSession = await retrieveReusableStripeSession(
    payment.stripeCheckoutSessionId,
  );
  const session = existingSession ?? (await createStripeSession(payment));

  if (!session) {
    return { status: "unavailable" };
  }

  return {
    status: "ready",
    clientSecret: session.client_secret,
    details: getDisplayDetails(payment),
  };
}

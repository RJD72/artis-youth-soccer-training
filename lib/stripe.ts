// This server-only module is the single place where the application creates
// its Stripe client. The secret key is read lazily so builds and non-payment
// pages do not fail simply because Stripe has not been configured yet.

import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function getStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new TypeError(
      "Stripe secret key is not configured. Please set the STRIPE_SECRET_KEY environment variable.",
    );
  }

  return secretKey;
}

export function getStripeClient(): Stripe {
  stripeClient ??= new Stripe(getStripeSecretKey(), {
    appInfo: {
      name: "ARTIS Soccer Academy",
    },
    maxNetworkRetries: 3,
    timeout: 10000,
  });
  return stripeClient;
}

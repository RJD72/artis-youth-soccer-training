import { NextResponse } from "next/server";

import { processStripeWebhookEvent } from "@/lib/process-stripe-webhook-event";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;
const MAX_SIGNATURE_HEADER_LENGTH = 4096;

class WebhookPayloadTooLargeError extends Error {
  constructor() {
    super("The Stripe webhook payload is too large.");
    this.name = "WebhookPayloadTooLargeError";
  }
}

function webhookResponse(
  body: { received: boolean; error?: string },
  status: number,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secret || !secret.startsWith("whsec_") || /\s/.test(secret)) {
    throw new TypeError("STRIPE_WEBHOOK_SECRET is not configured correctly.");
  }

  return secret;
}

function getStripeSignature(request: Request): string | null {
  const signature = request.headers.get("stripe-signature")?.trim();

  if (
    !signature ||
    signature.length > MAX_SIGNATURE_HEADER_LENGTH ||
    !signature.includes("t=") ||
    !signature.includes("v1=")
  ) {
    return null;
  }

  return signature;
}

function rejectOversizedDeclaredPayload(request: Request): void {
  const contentLength = request.headers.get("content-length");

  if (!contentLength || !/^\d+$/.test(contentLength)) {
    return;
  }

  if (Number(contentLength) > MAX_WEBHOOK_BODY_BYTES) {
    throw new WebhookPayloadTooLargeError();
  }
}

async function readRawWebhookBody(request: Request): Promise<Buffer> {
  rejectOversizedDeclaredPayload(request);

  if (!request.body) {
    return Buffer.alloc(0);
  }

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      byteLength += value.byteLength;

      if (byteLength > MAX_WEBHOOK_BODY_BYTES) {
        await reader.cancel();
        throw new WebhookPayloadTooLargeError();
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, byteLength);
}

function getErrorType(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

function logWebhookFailure(stage: string, error: unknown): void {
  // Do not log the request body, signature, secrets, or Stripe object data.
  console.error("Stripe webhook request failed.", {
    stage,
    errorType: getErrorType(error),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let webhookSecret: string;
  let stripe: ReturnType<typeof getStripeClient>;

  try {
    webhookSecret = getWebhookSecret();
    stripe = getStripeClient();
  } catch (error) {
    logWebhookFailure("configuration", error);
    return webhookResponse(
      { received: false, error: "Webhook configuration error." },
      500,
    );
  }

  const signature = getStripeSignature(request);

  if (!signature) {
    return webhookResponse(
      { received: false, error: "Invalid webhook request." },
      400,
    );
  }

  let rawBody: Buffer;

  try {
    rawBody = await readRawWebhookBody(request);
  } catch (error) {
    if (error instanceof WebhookPayloadTooLargeError) {
      return webhookResponse(
        { received: false, error: "Webhook payload is too large." },
        413,
      );
    }

    logWebhookFailure("body", error);
    return webhookResponse(
      { received: false, error: "Invalid webhook request." },
      400,
    );
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    logWebhookFailure("signature", error);
    return webhookResponse(
      { received: false, error: "Invalid webhook signature." },
      400,
    );
  }

  try {
    await processStripeWebhookEvent(event);
  } catch (error) {
    logWebhookFailure("processing", error);
    return webhookResponse(
      { received: false, error: "Webhook processing failed." },
      500,
    );
  }

  return webhookResponse({ received: true }, 200);
}

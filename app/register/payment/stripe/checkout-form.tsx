"use client";

import {
  CheckoutElementsProvider,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import { loadStripe, type Appearance, type Stripe } from "@stripe/stripe-js";
import Link from "next/link";
import { useState, type SubmitEvent } from "react";

type StripeCheckoutFormProps = {
  clientSecret: string;
  publishableKey: string;
};

type CheckoutError = {
  code?: string | null;
  message: string;
};

const stripePromises = new Map<string, PromiseLike<Stripe | null>>();

const stripeAppearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#0b1f33",
    colorBackground: "#ffffff",
    colorText: "#0b1f33",
    colorDanger: "#c74646",
    colorTextSecondary: "#5e6874",
    fontFamily: "Manrope, Arial, Helvetica, sans-serif",
    fontSizeBase: "15px",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid #dce1e5",
      boxShadow: "none",
      padding: "16px",
    },
    ".Input:focus": {
      border: "1px solid #0b1f33",
      boxShadow: "0 0 0 2px rgba(211, 166, 44, 0.35)",
    },
    ".Label": {
      color: "#0b1f33",
      fontSize: "13px",
      fontWeight: "600",
      marginBottom: "8px",
    },
    ".Error": {
      color: "#c74646",
      fontSize: "13px",
    },
  },
};

function getStripePromise(publishableKey: string): PromiseLike<Stripe | null> {
  const existingPromise = stripePromises.get(publishableKey);

  if (existingPromise) {
    return existingPromise;
  }

  const stripePromise = loadStripe(publishableKey);
  stripePromises.set(publishableKey, stripePromise);
  return stripePromise;
}

function getCheckoutErrorMessage(error: CheckoutError): string {
  if (error.code === "paymentFailed") {
    return "Your payment was not completed. Check the card details or try another card.";
  }

  if (error.message.trim()) {
    return error.message;
  }

  return "We could not complete the payment. Please wait a moment and try again.";
}

function SecurePaymentForm() {
  const checkoutState = useCheckoutElements();
  const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (checkoutState.type !== "success" || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Stripe validates the Payment Element, creates the payment, and then
      // sends the browser to the return URL stored on the Checkout Session.
      const result = await checkoutState.checkout.confirm({
        redirect: "always",
      });

      if (result.type === "error") {
        setMessage(getCheckoutErrorMessage(result.error));
      }
    } catch {
      setMessage(
        "We could not connect to the payment service. Please wait a moment and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isCheckoutLoading = checkoutState.type === "loading";
  const checkoutFailedToLoad = checkoutState.type === "error";
  const buttonDisabled =
    isCheckoutLoading ||
    checkoutFailedToLoad ||
    !isPaymentElementReady ||
    isSubmitting;

  const visibleMessage = checkoutFailedToLoad
    ? "The secure payment form could not be loaded. Refresh the page and try again."
    : message;

  return (
    <form onSubmit={handleSubmit} className="mt-8" aria-busy={isSubmitting}>
      <section aria-labelledby="payment-information-heading">
        <h2
          id="payment-information-heading"
          className="text-xl font-bold leading-7 text-artis-navy sm:text-[22px] sm:leading-8"
        >
          Payment information
        </h2>

        <div className="mt-[22px]">
          <PaymentElement
            options={{
              layout: "tabs",
              paymentMethodOrder: ["card"],
              wallets: {
                applePay: "never",
                googlePay: "never",
              },
            }}
            onReady={() => setIsPaymentElementReady(true)}
          />
        </div>
      </section>

      <label className="mt-7 flex items-start gap-3 text-sm leading-[22px] text-artis-slate">
        <input
          type="checkbox"
          name="paymentPoliciesAccepted"
          required
          className="mt-0.5 size-[18px] shrink-0 accent-artis-navy"
        />
        <span>
          I agree to the{" "}
          <Link
            href="/terms"
            className="font-semibold text-artis-navy underline"
          >
            terms
          </Link>
          ,{" "}
          <Link
            href="/privacy"
            className="font-semibold text-artis-navy underline"
          >
            privacy
          </Link>{" "}
          and{" "}
          <Link
            href="/cancellation-refund-policy"
            className="font-semibold text-artis-navy underline"
          >
            cancellation / refund policies
          </Link>
          .
        </span>
      </label>

      <output
        aria-live="polite"
        className={`mt-5 block rounded-[10px] border border-artis-error/30 bg-artis-error/10 px-4 py-3 text-sm leading-5 text-artis-error ${
          visibleMessage ? "" : "hidden"
        }`}
      >
        {visibleMessage}
      </output>

      <button
        type="submit"
        disabled={buttonDisabled}
        className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-white transition-colors hover:bg-artis-deep-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-artis-gold disabled:opacity-60"
      >
        {isSubmitting ? "Processing payment…" : "Pay and Register"}
      </button>

      <p className="mt-4 text-center text-[13px] leading-5 text-artis-slate">
        <span aria-hidden="true">🔒 </span>
        Secure payment processed by Stripe
      </p>

      <div className="mt-5 flex flex-col items-center gap-3 text-center text-sm leading-5">
        <Link
          href="/cancellation-refund-policy"
          className="font-semibold text-artis-navy underline"
        >
          Cancellation / refund policy
        </Link>
        <Link
          href="/register"
          className="font-semibold text-artis-slate underline"
        >
          Back to Registration
        </Link>
      </div>
    </form>
  );
}

export default function StripeCheckoutForm({
  clientSecret,
  publishableKey,
}: StripeCheckoutFormProps) {
  const normalizedPublishableKey = publishableKey.trim();
  const normalizedClientSecret = clientSecret.trim();

  if (!normalizedPublishableKey.startsWith("pk_") || !normalizedClientSecret) {
    return (
      <output
        aria-live="polite"
        className="mt-8 block rounded-[10px] border border-artis-error/30 bg-artis-error/10 px-4 py-3 text-sm leading-5 text-artis-error"
      >
        Secure payment is temporarily unavailable. Please return to registration
        and try again.
      </output>
    );
  }

  return (
    <CheckoutElementsProvider
      stripe={getStripePromise(normalizedPublishableKey)}
      options={{
        clientSecret: normalizedClientSecret,
        elementsOptions: {
          appearance: stripeAppearance,
          loader: "auto",
        },
      }}
    >
      <SecurePaymentForm />
    </CheckoutElementsProvider>
  );
}

// This server-rendered page prepares a secure Stripe Checkout Session and
// displays only registration information that was re-read from MySQL.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import StripeCheckoutForm from "./checkout-form";
import {
  prepareStripeCheckout,
  type StripeCheckoutDisplayDetails,
} from "@/lib/create-stripe-checkout-session";
import type { RegistrationPaymentReference } from "@/lib/registration-payment-reference";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Secure Checkout",
  description: "Secure card payment for an ARTIS Soccer Academy registration.",
  robots: {
    index: false,
    follow: false,
  },
};

type StripeCheckoutPageProps = {
  searchParams: Promise<{
    registration?: string | string[];
    payment?: string | string[];
    method?: string | string[];
    expires?: string | string[];
    signature?: string | string[];
  }>;
};

type ReadyCheckoutPageData = {
  clientSecret: string;
  publishableKey: string;
  details: StripeCheckoutDisplayDetails;
};

type ReadOnlyFieldProps = {
  id: string;
  label: string;
  value: string;
};

function getSingleSearchParameter(
  value: string | string[] | undefined,
): string | null {
  return typeof value === "string" ? value : null;
}

function getPaymentReference(
  parameters: Awaited<StripeCheckoutPageProps["searchParams"]>,
): RegistrationPaymentReference | null {
  const registration = getSingleSearchParameter(parameters.registration);
  const payment = getSingleSearchParameter(parameters.payment);
  const method = getSingleSearchParameter(parameters.method);
  const expires = getSingleSearchParameter(parameters.expires);
  const signature = getSingleSearchParameter(parameters.signature);

  if (
    !registration ||
    !payment ||
    method !== "stripe" ||
    !expires ||
    !signature
  ) {
    return null;
  }

  return {
    registration,
    payment,
    method,
    expires,
    signature,
  };
}

function getStripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();

  return key?.startsWith("pk_") ? key : null;
}

function logCheckoutPreparationFailure(error: unknown): void {
  // Stripe and database errors can contain request details. Record only the
  // broad error type so private registration information is not written to
  // production logs.
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error("Stripe checkout preparation failed.", { errorType });
}

async function getCheckoutPageData(
  searchParams: StripeCheckoutPageProps["searchParams"],
): Promise<ReadyCheckoutPageData | null> {
  const publishableKey = getStripePublishableKey();
  const reference = getPaymentReference(await searchParams);

  if (!publishableKey || !reference) {
    return null;
  }

  try {
    const checkout = await prepareStripeCheckout(reference);

    if (checkout.status !== "ready") {
      return null;
    }

    return {
      clientSecret: checkout.clientSecret,
      publishableKey,
      details: checkout.details,
    };
  } catch (error) {
    logCheckoutPreparationFailure(error);
    return null;
  }
}

function formatMoney(amountInCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountInCents / 100);
  } catch {
    return `${(amountInCents / 100).toFixed(2)} ${currency}`;
  }
}

function getProgramDisplayName(trainingGroupName: string): string {
  return trainingGroupName.toLowerCase().includes("program")
    ? trainingGroupName
    : `${trainingGroupName} Soccer Development Program`;
}

function ReadOnlyField({ id, label, value }: ReadOnlyFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-[13px] font-semibold leading-normal text-artis-navy"
      >
        {label}
      </label>
      <input
        id={id}
        value={value}
        readOnly
        className="h-[52px] w-full rounded-[10px] border border-artis-border bg-artis-white px-4 text-[15px] text-artis-slate outline-none"
      />
    </div>
  );
}

function OrderSummary({ details }: { details: StripeCheckoutDisplayDetails }) {
  return (
    <aside
      aria-labelledby="order-summary-heading"
      className="w-full rounded-xl border border-artis-border bg-artis-white p-7"
    >
      <h2
        id="order-summary-heading"
        className="text-2xl font-bold leading-[35px] text-artis-navy"
      >
        Order summary
      </h2>

      <p className="mt-[18px] text-base font-semibold leading-[23px] text-artis-navy">
        {getProgramDisplayName(details.trainingGroupName)}
      </p>

      <div className="mt-[18px] space-y-2 text-sm leading-5 text-artis-slate">
        <p>Player: {details.playerName}</p>
        <p>Package: {details.packageName}</p>
        <div>
          <p>Tuesday + Thursday training · Saturday game</p>
          <p>Central Huron Secondary School</p>
        </div>
      </div>

      <dl className="mt-[18px] space-y-2 text-base font-medium leading-[23px] text-artis-navy">
        <div className="flex items-center justify-between gap-4">
          <dt>Subtotal</dt>
          <dd>{formatMoney(details.subtotalCents, details.currency)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>HST</dt>
          <dd>{formatMoney(details.taxCents, details.currency)}</dd>
        </div>
        <div className="border-t border-artis-border pt-2">
          <div className="flex items-center justify-between gap-4 font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(details.totalCents, details.currency)}</dd>
          </div>
        </div>
      </dl>
    </aside>
  );
}

function CheckoutHeader() {
  return (
    <header className="w-full bg-artis-white">
      <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-5 py-4 xl:px-20 xl:py-5">
        <Link href="/" aria-label="ARTIS Soccer Academy home">
          <Image
            src="/logo.png"
            alt=""
            width={56}
            height={56}
            className="size-12 object-contain xl:size-14"
            priority
          />
        </Link>

        <p className="text-lg font-bold leading-[26px] text-artis-navy xl:text-[17px] xl:leading-[25px]">
          <span className="xl:hidden">Secure Checkout</span>
          <span className="hidden xl:inline">ARTIS SOCCER ACADEMY</span>
        </p>

        <p className="ml-auto hidden text-sm font-semibold leading-5 text-artis-navy xl:block">
          <span aria-hidden="true">🔒 </span>
          Secure Checkout
        </p>
      </div>
    </header>
  );
}

function UnavailableCheckout() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] justify-center px-6 py-12 xl:px-20 xl:py-20">
      <section className="w-full max-w-[640px] rounded-xl border border-artis-border bg-artis-white p-6 xl:p-10">
        <p className="inline-flex rounded-full bg-artis-soft-gold px-4 py-2 text-sm font-semibold text-artis-navy">
          Checkout unavailable
        </p>
        <h1 className="mt-6 text-[32px] font-bold leading-[42px] text-artis-navy xl:text-[38px] xl:leading-[55px]">
          We can’t open this payment
        </h1>
        <p className="mt-4 text-base leading-[25px] text-artis-slate">
          This checkout link is invalid, has expired, or the registration is no
          longer awaiting payment. Return to registration to begin again.
        </p>
        <Link
          href="/register"
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-[15px] font-semibold text-artis-white sm:w-auto"
        >
          Back to Registration
        </Link>
      </section>
    </div>
  );
}

function ReadyCheckout({ data }: { data: ReadyCheckoutPageData }) {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-[18px] px-6 py-6 xl:grid-cols-[minmax(0,720px)_minmax(0,480px)] xl:justify-center xl:gap-16 xl:px-20 xl:py-20">
      <section className="w-full xl:rounded-xl xl:border xl:border-artis-border xl:bg-artis-white xl:p-10">
        <h1 className="text-[32px] font-bold leading-[46px] text-artis-navy xl:text-[38px] xl:leading-[55px]">
          Secure Checkout
        </h1>
        <p className="mt-[18px] text-base leading-[23px] text-artis-slate xl:mt-[22px] xl:text-[17px] xl:leading-[25px]">
          <span className="xl:hidden">Complete the information below.</span>
          <span className="hidden xl:inline">
            Complete the parent, player and payment information below.
          </span>
        </p>

        <div className="mt-[18px] xl:hidden">
          <OrderSummary details={data.details} />
        </div>

        <section
          aria-labelledby="parent-player-information-heading"
          className="mt-6 xl:mt-[22px]"
        >
          <h2
            id="parent-player-information-heading"
            className="text-xl font-semibold leading-[29px] text-artis-navy xl:text-[21px] xl:leading-[30px]"
          >
            Parent and player information
          </h2>
          <div className="mt-[18px] space-y-[18px] xl:mt-[22px] xl:space-y-[22px]">
            <ReadOnlyField
              id="checkoutGuardianName"
              label="Parent / guardian name"
              value={data.details.guardianName}
            />
            <ReadOnlyField
              id="checkoutGuardianEmail"
              label="Email address"
              value={data.details.guardianEmail}
            />
            <ReadOnlyField
              id="checkoutPlayerName"
              label="Player name"
              value={data.details.playerName}
            />
          </div>
        </section>

        <StripeCheckoutForm
          clientSecret={data.clientSecret}
          publishableKey={data.publishableKey}
        />
      </section>

      <div className="hidden xl:block">
        <OrderSummary details={data.details} />
      </div>
    </div>
  );
}

export default async function StripeCheckoutPage({
  searchParams,
}: StripeCheckoutPageProps) {
  const pageData = await getCheckoutPageData(searchParams);

  return (
    <main className="min-h-screen w-full bg-artis-off-white text-artis-navy">
      <CheckoutHeader />
      {pageData ? <ReadyCheckout data={pageData} /> : <UnavailableCheckout />}
    </main>
  );
}

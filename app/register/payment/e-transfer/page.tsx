// This server-rendered page displays trusted e-transfer instructions for one
// pending registration. Prices and payment status are re-read from MySQL;
// values supplied in the URL are used only after their signature is verified.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { payments, registrations } from "@/db/schema";
import { verifyRegistrationPaymentReference } from "@/lib/registration-payment-reference";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-transfer Instructions",
  description:
    "Secure e-transfer payment instructions for an ARTIS Soccer Academy registration.",
  robots: {
    index: false,
    follow: false,
  },
};

type ETransferPageProps = {
  searchParams: Promise<{
    registration?: string | string[];
    payment?: string | string[];
    method?: string | string[];
    expires?: string | string[];
    signature?: string | string[];
  }>;
};

type ETransferDetails = {
  email: string;
  subtotal: string;
  tax: string;
  total: string;
  reference: string;
};

type PaymentDetailProps = {
  label: string;
  value: string;
  breakValue?: boolean;
};

function getSingleSearchParameter(
  value: string | string[] | undefined,
): string | null {
  return typeof value === "string" ? value : null;
}

function getConfiguredETransferEmail(): string | null {
  const email = process.env.ARTIS_E_TRANSFER_EMAIL?.trim();

  if (
    email &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return email;
  }

  // Keep the Figma placeholder visible during local development, but never
  // show customers a fake payment address in production.
  return process.env.NODE_ENV === "production"
    ? null
    : "[ARTIS E-TRANSFER EMAIL]";
}

function formatMoney(amountInCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
    }).format(amountInCents / 100);
  } catch {
    return `${(amountInCents / 100).toFixed(2)} ${currency}`;
  }
}

async function getETransferDetails(
  searchParams: ETransferPageProps["searchParams"],
): Promise<ETransferDetails | null> {
  const parameters = await searchParams;
  const registrationValue = getSingleSearchParameter(parameters.registration);
  const paymentValue = getSingleSearchParameter(parameters.payment);
  const methodValue = getSingleSearchParameter(parameters.method);
  const expiresValue = getSingleSearchParameter(parameters.expires);
  const signatureValue = getSingleSearchParameter(parameters.signature);
  const email = getConfiguredETransferEmail();

  if (
    !registrationValue ||
    !paymentValue ||
    !methodValue ||
    !expiresValue ||
    !signatureValue ||
    !email
  ) {
    return null;
  }

  const reference = verifyRegistrationPaymentReference(
    registrationValue,
    paymentValue,
    methodValue,
    expiresValue,
    signatureValue,
  );

  if (!reference || reference.method !== "e_transfer") {
    return null;
  }

  const [payment] = await db
    .select({
      subtotalCents: payments.subtotalCents,
      taxCents: payments.taxCents,
      totalCents: payments.totalCents,
      currency: payments.currency,
      manualPaymentReference: payments.manualPaymentReference,
    })
    .from(payments)
    .innerJoin(registrations, eq(payments.registrationId, registrations.id))
    .where(
      and(
        eq(payments.id, reference.paymentId),
        eq(payments.registrationId, reference.registrationId),
        eq(payments.paymentMethod, "e_transfer"),
        eq(payments.status, "pending"),
        eq(registrations.status, "pending_payment"),
        gt(registrations.reservationExpiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!payment?.manualPaymentReference) {
    return null;
  }

  return {
    email,
    subtotal: formatMoney(payment.subtotalCents, payment.currency),
    tax: formatMoney(payment.taxCents, payment.currency),
    total: formatMoney(payment.totalCents, payment.currency),
    reference: payment.manualPaymentReference,
  };
}

function PaymentDetail({
  label,
  value,
  breakValue = false,
}: PaymentDetailProps) {
  return (
    <div className="flex w-full flex-col gap-1.5 rounded-xl bg-artis-soft-gold px-4 py-3.5 xl:px-4.5 xl:py-4">
      <dt className="text-[13px] font-semibold leading-normal text-artis-slate xl:text-sm">
        {label}
      </dt>
      <dd
        className={`text-base font-semibold leading-6 text-artis-navy xl:text-lg ${
          breakValue ? "break-all" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ReturnHomeLink() {
  return (
    <div className="flex h-12 w-full items-start justify-center">
      <Link
        href="/"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-artis-navy px-5 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white xl:w-auto xl:px-6"
      >
        Return to Home
      </Link>
    </div>
  );
}

function UnavailableInstructions() {
  return (
    <section className="flex w-85.5 flex-col items-start gap-6 rounded-2xl bg-artis-white p-6 xl:w-160 xl:p-10">
      <p className="rounded-[18px] bg-artis-gold px-3.5 py-2 text-sm font-semibold leading-normal text-artis-navy xl:px-4">
        Instructions unavailable
      </p>

      <h1 className="w-full text-[30px] font-bold leading-9.5 text-artis-navy xl:text-4xl xl:leading-11 xl:tracking-[-1px]">
        We can’t show these payment details
      </h1>

      <p className="w-full text-[15px] leading-6 text-artis-slate xl:text-base xl:leading-6.5">
        This payment link is invalid, has expired, or the registration is no
        longer awaiting an e-transfer. Please contact ARTIS Soccer Academy if
        you believe this is a mistake.
      </p>

      <ReturnHomeLink />
    </section>
  );
}

export default async function ETransferInstructionsPage({
  searchParams,
}: ETransferPageProps) {
  const details = await getETransferDetails(searchParams);

  return (
    <main className="flex min-h-screen w-full flex-col items-center gap-5 bg-artis-off-white pt-6 pb-12 text-artis-navy">
      <Link href="/" aria-label="ARTIS Soccer Academy home">
        <Image
          src="/logo.png"
          alt=""
          width={72}
          height={72}
          className="size-15 object-contain xl:size-18"
          priority
        />
      </Link>

      {details ? (
        <section className="flex w-85.5 flex-col items-start gap-6 rounded-2xl bg-artis-white p-6 xl:w-160 xl:p-10">
          <p className="rounded-[18px] bg-artis-gold px-3.5 py-2 text-sm font-semibold leading-normal text-artis-navy xl:px-4">
            Pending E-transfer
          </p>

          <h1 className="w-full text-[30px] font-bold leading-9.5 text-artis-navy xl:text-4xl xl:leading-11 xl:tracking-[-1px]">
            Complete Your E-transfer
          </h1>

          <p className="w-full text-[15px] leading-6.25 text-artis-slate xl:text-base xl:leading-6.5">
            Your registration has been submitted. Complete the payment details
            below; registration remains pending until ARTIS receives and
            verifies the e-transfer.
          </p>

          <dl className="flex w-full flex-col gap-3.5 xl:gap-4">
            <PaymentDetail
              label="Send e-transfer to:"
              value={details.email}
              breakValue
            />
            <PaymentDetail
              label="Selected package amount:"
              value={details.subtotal}
            />
            <PaymentDetail label="HST:" value={details.tax} />
            <PaymentDetail label="Total amount due:" value={details.total} />
            <PaymentDetail label="Reference:" value={details.reference} />
          </dl>

          <p className="w-full text-[15px] leading-6 text-artis-slate xl:text-base xl:leading-6.5">
            Please include your registration reference number in the message
            section of your e-transfer.
          </p>

          <aside className="w-full rounded-xl bg-artis-soft-gold p-4 xl:p-4.5">
            <p className="text-[15px] font-semibold leading-6 text-artis-navy xl:text-base xl:leading-6.5">
              Your registration will be confirmed after ARTIS Soccer Academy
              receives and verifies your payment.
            </p>
          </aside>

          <ReturnHomeLink />
        </section>
      ) : (
        <UnavailableInstructions />
      )}
    </main>
  );
}

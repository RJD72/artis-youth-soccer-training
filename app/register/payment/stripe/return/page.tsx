// Stripe redirects the browser to this page after a payment attempt. The page
// retrieves the Checkout Session from Stripe and cross-checks it against MySQL
// before displaying any registration result.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  payments,
  players,
  programPackages,
  registrations,
  trainingGroups,
  weeklySchedules,
} from "@/db/schema";
import { createRegistrationPaymentReference } from "@/lib/registration-payment-reference";
import { getStripeClient } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Payment Result",
  description: "Payment and registration result for ARTIS Soccer Academy.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

type StripeReturnPageProps = {
  searchParams: Promise<{
    session_id?: string | string[];
  }>;
};

type WeeklySession = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
};

type RegistrationSummary = {
  registrationId: number;
  paymentId: number;
  trainingGroupId: number;
  playerName: string;
  trainingGroupName: string;
  packageDurationMonths: number;
  totalCents: number;
  currency: string;
  schedule: WeeklySession[];
};

type VerifiedReturnDetails = RegistrationSummary & {
  confirmationNumber: string;
  retryUrl: string;
};

type ReturnPageData =
  | {
      status: "success";
      details: VerifiedReturnDetails;
    }
  | {
      status: "declined";
      details: VerifiedReturnDetails;
    }
  | {
      status: "unavailable";
    };

const dayOrder: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const abbreviatedDays: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function getSessionId(value: string | string[] | undefined): string | null {
  if (
    typeof value !== "string" ||
    value.length > 255 ||
    !/^cs_[A-Za-z0-9_]+$/.test(value)
  ) {
    return null;
  }

  return value;
}

function getDatabaseId(value: string | undefined): number | null {
  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0 && id <= 4_294_967_295 ? id : null;
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

function formatPackageDuration(durationMonths: number): string {
  if (durationMonths === 12) {
    return "1 Year";
  }

  return `${durationMonths} Month${durationMonths === 1 ? "" : "s"}`;
}

function formatTime(time: string): string {
  const [hourValue, minuteValue] = time.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return time;
  }

  const displayHour = hour % 12 || 12;
  const displayMinute =
    minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;
  const period = hour >= 12 ? "PM" : "AM";

  return `${displayHour}${displayMinute} ${period}`;
}

function formatSchedule(sessions: WeeklySession[]): string {
  if (sessions.length === 0) {
    return "Schedule to be confirmed";
  }

  return [...sessions]
    .sort(
      (first, second) =>
        (dayOrder[first.dayOfWeek] ?? 8) - (dayOrder[second.dayOfWeek] ?? 8),
    )
    .map(
      (session) =>
        `${abbreviatedDays[session.dayOfWeek] ?? session.dayOfWeek} ${formatTime(
          session.startTime,
        )}–${formatTime(session.endTime)}`,
    )
    .join(" · ");
}

function buildRetryUrl(registrationId: number, paymentId: number): string {
  const reference = createRegistrationPaymentReference(
    registrationId,
    paymentId,
    "stripe",
  );
  const parameters = new URLSearchParams(reference);

  return `/register/payment/stripe?${parameters.toString()}`;
}

async function findRegistrationSummary(
  sessionId: string,
  registrationId: number,
  paymentId: number,
): Promise<RegistrationSummary | null> {
  const [registration] = await db
    .select({
      registrationId: registrations.id,
      paymentId: payments.id,
      trainingGroupId: trainingGroups.id,
      playerName: players.fullName,
      trainingGroupName: trainingGroups.displayName,
      packageDurationMonths: programPackages.durationMonths,
      totalCents: payments.totalCents,
      currency: payments.currency,
    })
    .from(payments)
    .innerJoin(registrations, eq(payments.registrationId, registrations.id))
    .innerJoin(players, eq(registrations.playerId, players.id))
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
        eq(payments.stripeCheckoutSessionId, sessionId),
      ),
    )
    .limit(1);

  if (!registration) {
    return null;
  }

  const schedule = await db
    .select({
      dayOfWeek: weeklySchedules.dayOfWeek,
      startTime: weeklySchedules.startTime,
      endTime: weeklySchedules.endTime,
    })
    .from(weeklySchedules)
    .where(
      and(
        eq(weeklySchedules.trainingGroupId, registration.trainingGroupId),
        eq(weeklySchedules.isActive, true),
      ),
    );

  return { ...registration, schedule };
}

function sessionMatchesRegistration(
  session: Awaited<
    ReturnType<
      ReturnType<typeof getStripeClient>["checkout"]["sessions"]["retrieve"]
    >
  >,
  summary: RegistrationSummary,
): boolean {
  return (
    session.mode === "payment" &&
    session.client_reference_id === String(summary.registrationId) &&
    session.amount_total === summary.totalCents &&
    session.currency?.toUpperCase() === summary.currency.toUpperCase()
  );
}

function logReturnPageFailure(error: unknown): void {
  const errorType = error instanceof Error ? error.name : "UnknownError";

  // Do not log the Checkout Session, registration details, or Stripe response.
  console.error("Stripe return-page verification failed.", { errorType });
}

async function getReturnPageData(
  searchParams: StripeReturnPageProps["searchParams"],
): Promise<ReturnPageData> {
  const sessionId = getSessionId((await searchParams).session_id);

  if (!sessionId) {
    return { status: "unavailable" };
  }

  try {
    const session =
      await getStripeClient().checkout.sessions.retrieve(sessionId);
    const registrationId = getDatabaseId(session.metadata?.registrationId);
    const paymentId = getDatabaseId(session.metadata?.paymentId);

    if (!registrationId || !paymentId) {
      return { status: "unavailable" };
    }

    const summary = await findRegistrationSummary(
      sessionId,
      registrationId,
      paymentId,
    );

    if (!summary || !sessionMatchesRegistration(session, summary)) {
      return { status: "unavailable" };
    }

    const details: VerifiedReturnDetails = {
      ...summary,
      confirmationNumber: `ARTIS-${String(registrationId).padStart(6, "0")}`,
      retryUrl: buildRetryUrl(registrationId, paymentId),
    };

    return session.status === "complete" && session.payment_status === "paid"
      ? { status: "success", details }
      : { status: "declined", details };
  } catch (error) {
    logReturnPageFailure(error);
    return { status: "unavailable" };
  }
}

function PageLogo() {
  return (
    <Link href="/" aria-label="ARTIS Soccer Academy home">
      <Image
        src="/logo.png"
        alt=""
        width={72}
        height={72}
        className="size-[60px] object-contain xl:size-[72px]"
        priority
      />
    </Link>
  );
}

function SupportLink() {
  return (
    <Link
      href="/contact?topic=registration"
      className="text-sm font-medium leading-5 text-artis-navy underline"
    >
      Need help? Contact ARTIS Soccer Academy
    </Link>
  );
}

function SuccessPage({ details }: { details: VerifiedReturnDetails }) {
  return (
    <section className="flex w-full max-w-[620px] flex-col items-center gap-[18px] rounded-[14px] border border-artis-border bg-artis-white p-10">
      <div
        aria-hidden="true"
        className="flex size-[72px] items-center justify-center rounded-full bg-[#eaf6f0] text-[34px] font-bold leading-[49px] text-artis-success"
      >
        ✓
      </div>

      <h1 className="w-full text-[30px] font-bold leading-[44px] text-artis-navy xl:text-[38px] xl:leading-[55px]">
        Registration Confirmed
      </h1>
      <p className="w-full text-lg font-semibold leading-[26px] text-artis-success">
        Payment successful. Registration confirmed. A receipt has been emailed.
      </p>
      <p className="w-full text-sm font-medium leading-5 text-artis-slate">
        Confirmation number: {details.confirmationNumber}
      </p>

      <div
        id="registration-summary"
        className="w-full scroll-mt-6 rounded-[10px] bg-artis-off-white p-5 text-[15px] leading-[22px] text-artis-navy"
      >
        <h2 className="text-[17px] font-semibold leading-[25px]">
          Registration summary
        </h2>
        <dl className="mt-3 space-y-1">
          <div>
            <dt className="inline font-semibold">Status: </dt>
            <dd className="inline">Paid</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Player: </dt>
            <dd className="inline">{details.playerName}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Age group: </dt>
            <dd className="inline">{details.trainingGroupName}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Term: </dt>
            <dd className="inline">
              {formatPackageDuration(details.packageDurationMonths)}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">Amount paid: </dt>
            <dd className="inline">
              {formatMoney(details.totalCents, details.currency)}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold">Schedule: </dt>
            <dd className="inline">{formatSchedule(details.schedule)}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Location: </dt>
            <dd className="inline">Central Huron Secondary School gym</dd>
          </div>
        </dl>
        <p className="mt-4">
          Payment successful. Registration confirmed. A receipt has been
          emailed.
        </p>
      </div>

      <p className="w-full text-[15px] leading-[22px] text-artis-slate">
        A confirmation email will be sent to the parent / guardian address
        provided. Registration has been received; placement remains subject to
        academy confirmation.
      </p>

      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-white"
      >
        Return to Home
      </Link>
      <a
        href="#registration-summary"
        className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-gold px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-navy"
      >
        View Registration Details
      </a>
      <SupportLink />
    </section>
  );
}

function DeclinedPage({ details }: { details: VerifiedReturnDetails }) {
  return (
    <section className="flex w-full max-w-[640px] flex-col items-center gap-[18px] rounded-[14px] border border-artis-border bg-artis-white p-10">
      <div
        aria-hidden="true"
        className="flex size-[72px] items-center justify-center rounded-full bg-[#fbeded] text-[34px] font-bold leading-[49px] text-artis-error"
      >
        !
      </div>

      <h1 className="w-full text-[29px] font-bold leading-[42px] text-artis-navy xl:text-4xl xl:leading-[52px]">
        Payment Could Not Be Completed
      </h1>
      <p className="w-full text-lg font-semibold leading-[26px] text-artis-error">
        Your card was not charged.
      </p>
      <p className="w-full text-base leading-[23px] text-artis-slate">
        Please verify the payment information and try again. You can also choose
        a different payment method.
      </p>

      <Link
        href={details.retryUrl}
        className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-white"
      >
        Try Again
      </Link>
      <Link
        href="/register"
        className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-gold px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-navy"
      >
        Use a Different Payment Method
      </Link>
      <Link
        href="/register"
        className="text-sm font-medium leading-5 text-artis-navy underline"
      >
        Return to registration
      </Link>
      <SupportLink />
    </section>
  );
}

function UnavailablePage() {
  return (
    <section className="flex w-full max-w-[640px] flex-col items-center gap-[18px] rounded-[14px] border border-artis-border bg-artis-white p-10">
      <div
        aria-hidden="true"
        className="flex size-[72px] items-center justify-center rounded-full bg-[#fbeded] text-[34px] font-bold leading-[49px] text-artis-error"
      >
        !
      </div>
      <h1 className="w-full text-[29px] font-bold leading-[42px] text-artis-navy xl:text-4xl xl:leading-[52px]">
        Payment Result Unavailable
      </h1>
      <p className="w-full text-base leading-[23px] text-artis-slate">
        This payment link is invalid, or the payment result could not be
        verified. Check your Stripe receipt or contact ARTIS Soccer Academy for
        assistance.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-white"
      >
        Return to Home
      </Link>
      <SupportLink />
    </section>
  );
}

export default async function StripeReturnPage({
  searchParams,
}: StripeReturnPageProps) {
  const pageData = await getReturnPageData(searchParams);

  return (
    <main className="flex min-h-screen w-full flex-col items-center gap-5 bg-artis-off-white p-6 text-artis-navy">
      <PageLogo />
      {pageData.status === "success" ? (
        <SuccessPage details={pageData.details} />
      ) : null}
      {pageData.status === "declined" ? (
        <DeclinedPage details={pageData.details} />
      ) : null}
      {pageData.status === "unavailable" ? <UnavailablePage /> : null}
    </main>
  );
}

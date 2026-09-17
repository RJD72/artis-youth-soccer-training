import type { Metadata } from "next";
import Link from "next/link";

import SiteFooter from "../../../components/site-footer";
import SiteHeader from "../../../components/site-header";
import {
  getRenewalOptionsForPlayer,
  type RenewalOptionsResult,
} from "@/lib/renewal-options";
import { readRenewalPlayerReference } from "@/lib/renewal-player-reference";

import RenewalCheckoutForm from "./renewal-checkout-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Complete Training Renewal",
  description:
    "Review and complete an ARTIS Soccer Academy training renewal.",
  robots: {
    index: false,
    follow: false,
  },
};

type RenewalVerificationPageProps = {
  searchParams: Promise<{
    player?: string | string[];
    expires?: string | string[];
    signature?: string | string[];
  }>;
};

type BlockedRenewal = Extract<RenewalOptionsResult, { status: "blocked" }>;

type StatusPanelContent = {
  eyebrow: string;
  title: string;
  description: string;
  detail?: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

function getSingleSearchParameter(
  value: string | string[] | undefined,
): string | null {
  return typeof value === "string" ? value : null;
}

function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(
    new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    ),
  );
}

function formatTorontoDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(value);
}

function getBlockedPanelContent(result: BlockedRenewal): StatusPanelContent {
  switch (result.reason) {
    case "payment-pending":
      return {
        eyebrow: "Payment already pending",
        title: `A renewal payment is already open for ${result.playerName}.`,
        description:
          "Only one payment reservation may be active at a time. Return to the original payment page to finish it, or wait for that reservation to expire before starting another renewal.",
        ...(result.reservationExpiresAt
          ? {
              detail: `The current payment reservation expires ${formatTorontoDateTime(result.reservationExpiresAt)}.`,
            }
          : {}),
        primaryHref: "/register/renew",
        primaryLabel: "Return to Renewal Later",
        secondaryHref: "/contact",
        secondaryLabel: "Contact ARTIS",
      };

    case "upcoming-registration":
      return {
        eyebrow: "Renewal already scheduled",
        title: `${result.playerName} already has an upcoming training period.`,
        description:
          "The next registration has already been arranged, so another future period cannot be stacked yet. This prevents duplicate charges and overlapping registrations.",
        ...(result.paidThrough
          ? {
              detail: `Training is currently scheduled through ${formatCalendarDate(result.paidThrough)}.`,
            }
          : {}),
        primaryHref: "/",
        primaryLabel: "Return to Home",
        secondaryHref: "/contact",
        secondaryLabel: "Contact ARTIS",
      };

    case "registration-history-unavailable":
      return {
        eyebrow: "Renewal unavailable",
        title: "We could not find a completed registration to renew.",
        description:
          "We found the player, but the system could not confirm the paid registration history needed to calculate the next training period.",
        primaryHref: "/contact",
        primaryLabel: "Contact ARTIS",
        secondaryHref: "/register",
        secondaryLabel: "Back to Registration",
      };

    case "packages-unavailable":
      return {
        eyebrow: "Packages unavailable",
        title: "Renewal packages are not currently available.",
        description:
          "No renewal package is currently available for this player’s age, group, and training dates. Please contact ARTIS if you need help.",
        primaryHref: "/register/renew",
        primaryLabel: "Return to Renewal Later",
        secondaryHref: "/contact",
        secondaryLabel: "Contact ARTIS",
      };
  }
}

function StatusPanel({ content }: { content: StatusPanelContent }) {
  return (
    <section className="mx-auto w-full max-w-[720px] rounded-[12px] border border-artis-border bg-artis-white p-6 sm:p-8 xl:p-10">
      <p className="text-xs font-semibold uppercase leading-[18px] tracking-[0.16em] text-artis-gold">
        {content.eyebrow}
      </p>
      <h1 className="mt-3 text-[34px] font-bold leading-[43px] tracking-[-1px] xl:text-[38px] xl:leading-[55px]">
        {content.title}
      </h1>
      <p className="mt-3 text-base leading-[26px] text-artis-slate xl:text-[17px] xl:leading-[25px]">
        {content.description}
      </p>

      {content.detail ? (
        <p className="mt-[18px] rounded-[10px] bg-artis-soft-gold p-4 text-sm font-semibold leading-6">
          {content.detail}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={content.primaryHref}
          className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white"
        >
          {content.primaryLabel}
        </Link>

        {content.secondaryHref && content.secondaryLabel ? (
          <Link
            href={content.secondaryHref}
            className="inline-flex min-h-12 items-center justify-center rounded-[10px] border border-artis-border bg-artis-white px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-navy hover:border-artis-navy"
          >
            {content.secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function InvalidRenewalReference() {
  return (
    <StatusPanel
      content={{
        eyebrow: "Renewal unavailable",
        title: "This renewal session is no longer valid.",
        description:
          "Please return to the renewal page and enter the player information again to continue.",
        primaryHref: "/register/renew",
        primaryLabel: "Return to Renewal",
        secondaryHref: "/",
        secondaryLabel: "Return to Home",
      }}
    />
  );
}

export default async function RenewalVerificationPage({
  searchParams,
}: RenewalVerificationPageProps) {
  const parameters = await searchParams;
  const player = getSingleSearchParameter(parameters.player);
  const expires = getSingleSearchParameter(parameters.expires);
  const signature = getSingleSearchParameter(parameters.signature);
  const reference =
    player !== null && expires !== null && signature !== null
      ? readRenewalPlayerReference(player, expires, signature)
      : null;
  const result: RenewalOptionsResult = reference
    ? await getRenewalOptionsForPlayer(reference.playerId)
    : { status: "invalid-token" };

  return (
    <div className="flex min-h-screen flex-col bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="flex-1">
        <section
          aria-label="Complete training renewal"
          className="mx-auto w-full max-w-[1280px] px-5 py-12 sm:px-8 xl:px-0 xl:py-20"
        >
          {result.status === "invalid-token" ? <InvalidRenewalReference /> : null}

          {result.status === "blocked" ? (
            <StatusPanel content={getBlockedPanelContent(result)} />
          ) : null}

          {result.status === "ready" && player !== null && expires !== null && signature !== null ? (
            <RenewalCheckoutForm
              player={player}
              expires={expires}
              signature={signature}
              playerName={result.playerName}
              paidThrough={result.paidThrough}
              renewsOn={result.renewsOn}
              trainingGroup={result.trainingGroup}
              programPackages={result.programPackages}
            />
          ) : null}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

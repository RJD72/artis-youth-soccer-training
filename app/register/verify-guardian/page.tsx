import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import SiteFooter from "../../components/site-footer";
import SiteHeader from "../../components/site-header";
import { getGuardianVerificationSessionToken } from "@/lib/guardian-verification-session";
import { verifyGuardianVerificationToken } from "@/lib/verify-guardian-verification-token";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify Family Email",
  description:
    "Verify an existing family email before continuing an ARTIS Soccer Academy registration.",
  robots: {
    index: false,
    follow: false,
  },
};

type GuardianVerificationPageProps = {
  searchParams: Promise<{
    token?: string | string[];
    verified?: string | string[];
  }>;
};

type StatusPanelProps = {
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

function StatusPanel({
  eyebrow,
  title,
  description,
  detail,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: StatusPanelProps) {
  return (
    <section className="mx-auto w-full max-w-[720px] rounded-[12px] border border-artis-border bg-artis-white p-6 sm:p-8 xl:p-10">
      <p className="text-xs font-semibold uppercase leading-[18px] tracking-[0.16em] text-artis-gold">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-[34px] font-bold leading-[43px] tracking-[-1px] xl:text-[38px] xl:leading-[55px]">
        {title}
      </h1>
      <p className="mt-3 text-base leading-[26px] text-artis-slate xl:text-[17px] xl:leading-[25px]">
        {description}
      </p>

      {detail ? (
        <p className="mt-[18px] rounded-[10px] bg-artis-soft-gold p-4 text-sm font-semibold leading-6">
          {detail}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href={primaryHref}
          className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white"
        >
          {primaryLabel}
        </Link>

        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="inline-flex min-h-12 items-center justify-center rounded-[10px] border border-artis-border bg-artis-white px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-navy hover:border-artis-navy"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function InvalidVerificationLink() {
  return (
    <StatusPanel
      eyebrow="Verification link unavailable"
      title="This secure verification link is no longer valid."
      description="The link may have expired, already been used, or been copied incorrectly. Return to the registration form and submit it again to request a new email."
      primaryHref="/register"
      primaryLabel="Return to Registration"
      secondaryHref="/contact"
      secondaryLabel="Contact ARTIS"
    />
  );
}

function VerifiedSession() {
  return (
    <section className="mx-auto w-full max-w-[720px] rounded-[12px] border border-artis-border bg-artis-white p-6 sm:p-8 xl:p-10">
      <p className="text-xs font-semibold uppercase leading-[18px] tracking-[0.16em] text-artis-gold">
        Email verified
      </p>
      <h1 className="mt-3 text-[34px] font-bold leading-[43px] tracking-[-1px] xl:text-[38px] xl:leading-[55px]">
        Your email has been verified.
      </h1>
      <p className="mt-3 text-base leading-[26px] text-artis-slate xl:text-[17px] xl:leading-[25px]">
        You may close this tab and continue registering in the original
        registration tab.
      </p>
    </section>
  );
}

export default async function GuardianVerificationPage({
  searchParams,
}: GuardianVerificationPageProps) {
  const parameters = await searchParams;
  const tokenFromUrl = getSingleSearchParameter(parameters.token);

  // Old emails pointed directly to this page. Send those links through the
  // automatic route too, so they do not require a second confirmation click.
  if (tokenFromUrl) {
    const completeParameters = new URLSearchParams({ token: tokenFromUrl });

    redirect(
      `/register/verify-guardian/complete?${completeParameters.toString()}`,
    );
  }

  const showingVerifiedSession =
    getSingleSearchParameter(parameters.verified) === "true";
  const sessionToken = showingVerifiedSession
    ? await getGuardianVerificationSessionToken()
    : null;
  const verification = await verifyGuardianVerificationToken(sessionToken);

  return (
    <div className="flex min-h-screen flex-col bg-artis-off-white text-artis-navy">
      {/* <SiteHeader /> */}

      <main className="flex-1">
        <section
          aria-label="Verify family email"
          className="mx-auto w-full max-w-[1280px] px-5 py-12 sm:px-8 xl:px-0 xl:py-20"
        >
          {showingVerifiedSession && verification.status === "valid" ? (
            <VerifiedSession />
          ) : (
            <InvalidVerificationLink />
          )}
        </section>
      </main>

      {/* <SiteFooter /> */}
    </div>
  );
}

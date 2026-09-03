import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import SiteFooter from "../../components/site-footer";
import SiteHeader from "../../components/site-header";
import {
  getGuardianVerificationSessionToken,
  setGuardianVerificationSession,
} from "@/lib/guardian-verification-session";
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

function VerifiedSession({ expiresAt }: { expiresAt: Date }) {
  return (
    <StatusPanel
      eyebrow="Email verified"
      title="You can continue the registration."
      description="Return to your original registration tab and choose the payment option again. The information you entered should still be there. If that tab is closed, open the registration form below."
      detail={`Your email verification remains valid until ${formatTorontoDateTime(expiresAt)}.`}
      primaryHref="/register"
      primaryLabel="Open Registration Form"
      secondaryHref="/"
      secondaryLabel="Return to Home"
    />
  );
}

export default async function GuardianVerificationPage({
  searchParams,
}: GuardianVerificationPageProps) {
  const parameters = await searchParams;
  const tokenFromUrl = getSingleSearchParameter(parameters.token);
  const showingVerifiedSession =
    getSingleSearchParameter(parameters.verified) === "true";
  const sessionToken = showingVerifiedSession
    ? await getGuardianVerificationSessionToken()
    : null;
  const token = tokenFromUrl ?? sessionToken;
  const verification = await verifyGuardianVerificationToken(token);

  async function saveVerifiedSession(): Promise<void> {
    "use server";

    const currentVerification = await verifyGuardianVerificationToken(token);

    if (typeof token !== "string" || currentVerification.status !== "valid") {
      redirect("/register/verify-guardian");
    }

    await setGuardianVerificationSession(token, currentVerification.expiresAt);
    redirect("/register/verify-guardian?verified=true");
  }

  return (
    <div className="flex min-h-screen flex-col bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="flex-1">
        <section
          aria-label="Verify family email"
          className="mx-auto w-full max-w-[1280px] px-5 py-12 sm:px-8 xl:px-0 xl:py-20"
        >
          {verification.status === "invalid" ? (
            <InvalidVerificationLink />
          ) : showingVerifiedSession ? (
            <VerifiedSession expiresAt={verification.expiresAt} />
          ) : (
            <section className="mx-auto w-full max-w-[720px] rounded-[12px] border border-artis-border bg-artis-white p-6 sm:p-8 xl:p-10">
              <p className="text-xs font-semibold uppercase leading-[18px] tracking-[0.16em] text-artis-gold">
                Confirm family email
              </p>
              <h1 className="mt-3 text-[34px] font-bold leading-[43px] tracking-[-1px] xl:text-[38px] xl:leading-[55px]">
                Verify this email to continue.
              </h1>
              <p className="mt-3 text-base leading-[26px] text-artis-slate xl:text-[17px] xl:leading-[25px]">
                This confirms that you control the email address already used by
                this family. It will not reveal or change any existing player or
                registration information.
              </p>
              <p className="mt-[18px] rounded-[10px] bg-artis-soft-gold p-4 text-sm font-semibold leading-6">
                This link expires{" "}
                {formatTorontoDateTime(verification.expiresAt)}.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <form action={saveVerifiedSession}>
                  <button
                    type="submit"
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white sm:w-auto"
                  >
                    Verify Email
                  </button>
                </form>
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center justify-center rounded-[10px] border border-artis-border bg-artis-white px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-navy hover:border-artis-navy"
                >
                  Back to Registration
                </Link>
              </div>
            </section>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

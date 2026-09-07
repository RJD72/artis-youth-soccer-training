// REGISTER PAGE WITH SHARED HEADER AND FOOTER — AUGUST 22, 2026
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";
import { getRegistrationOptions } from "@/lib/registration-options";

import ProgramSelector from "./program-selector";

export const metadata: Metadata = {
  title: "Register for Training",
  description:
    "Register a player for an ARTIS Soccer Academy training program.",
};

type RegisterPageProps = {
  searchParams: Promise<{
    group?: string | string[];
  }>;
};

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  // Registration availability can change in the admin dashboard. Waiting for a
  // request ensures each visitor receives the current database information.
  await connection();

  const { group: requestedGroupValue } = await searchParams;
  const requestedGroupSlug = Array.isArray(requestedGroupValue)
    ? requestedGroupValue[0]
    : requestedGroupValue;
  const { trainingGroups, trainingGroupAvailability, programPackages } =
    await getRegistrationOptions();
  const registrationAvailable =
    trainingGroups.length > 0 && programPackages.length > 0;
  const allOpenGroupsFull =
    trainingGroupAvailability.length > 0 &&
    trainingGroups.length === 0 &&
    programPackages.length > 0;
  const initialTrainingGroupId = trainingGroups.find(
    (group) => group.slug === requestedGroupSlug,
  )?.id;

  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main>
        <section className="min-h-[243px] bg-artis-deep-navy text-artis-white xl:min-h-[359px]">
          <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3.5 px-6 py-6 xl:gap-4.5 xl:px-0 xl:py-18">
            <p className="text-[11px] font-semibold uppercase leading-4 text-artis-gold xl:text-[13px] xl:leading-[19px]">
              Registration · Steps 1–2 of 3
            </p>
            <h1 className="max-w-[900px] text-[34px] font-bold leading-[49px] xl:text-5xl xl:leading-[70px]">
              Register for Training
            </h1>
            <p className="max-w-[900px] text-base leading-[23px] xl:text-lg xl:leading-[26px]">
              A parent or guardian must provide the information needed to
              register the player before continuing to secure payment.
            </p>
            <p className="max-w-[900px] text-[13px] font-medium leading-[19px] xl:text-sm xl:leading-5">
              Required fields are marked with an asterisk (*).
            </p>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 xl:px-0 xl:py-16">
          <div className="mx-auto w-full max-w-[1280px]">
            {registrationAvailable ? (
              <ProgramSelector
                trainingGroups={trainingGroups}
                trainingGroupAvailability={trainingGroupAvailability}
                programPackages={programPackages}
                initialTrainingGroupId={initialTrainingGroupId}
              />
            ) : allOpenGroupsFull ? (
              <div className="rounded-2xl border border-artis-border bg-artis-white p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold">
                  Program availability
                </p>
                <h2 className="mt-3 text-2xl font-bold">
                  Training groups are currently full
                </h2>
                <p className="mt-3 max-w-2xl leading-7 text-artis-slate">
                  These groups have reached capacity. You can join the waitlist
                  without making a payment, and ARTIS Soccer Academy will
                  contact you if a place becomes available.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {trainingGroupAvailability.map((group) => (
                    <article
                      key={group.id}
                      className="rounded-[10px] border border-artis-border bg-artis-off-white p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-lg font-bold">
                          {group.displayName}
                        </h3>
                        <p className="rounded-full bg-artis-red px-2.5 py-1 text-xs font-semibold text-artis-white">
                          Group Full
                        </p>
                      </div>
                      <Link
                        href={`/register/waitlist?group=${encodeURIComponent(group.slug)}`}
                        className="mt-5 inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white"
                      >
                        Join the Waitlist
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-artis-border bg-artis-white p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold">
                  Registration update
                </p>
                <h2 className="mt-3 text-2xl font-bold">
                  Registration is not currently available
                </h2>
                <p className="mt-3 max-w-2xl leading-7 text-artis-slate">
                  No training groups or program packages are open right now.
                  Please check back soon for updated availability.
                </p>
                <Link
                  href="/"
                  className="mt-6 inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-gold px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-navy"
                >
                  Return to Home
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

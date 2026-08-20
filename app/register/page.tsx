import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import { getRegistrationOptions } from "@/lib/registration-options";

import ProgramSelector from "./program-selector";

export const metadata: Metadata = {
  title: "Register for Training",
  description:
    "View the available ARTIS Soccer Academy training groups and program packages",
};

export default async function RegisterPage() {
  // Registration availability can change in the admin dashboard. Waiting for a
  // request ensures each visitor receives the current database information.
  await connection();

  const { trainingGroups, programPackages } = await getRegistrationOptions();
  const registrationAvailable =
    trainingGroups.length > 0 && programPackages.length > 0;

  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <header className="border-b border-artis-border bg-artis-white">
        <div className="mx-auto flex min-h-24 w-full max-w-7xl items-center gap-8 px-5 py-4 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3"
            aria-label="ARTIS Soccer Academy home"
          >
            <Image
              src="/logo.png"
              alt=""
              width={64}
              height={64}
              className="size-14 object-contain sm:size-16"
              priority
            />
            <span className="hidden text-sm font-bold tracking-wide sm:block lg:hidden">
              ARTIS Soccer Academy
            </span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-7 text-sm font-semibold lg:flex"
          >
            <Link href="/">Home</Link>
            <Link href="/#training">Training</Link>
            <Link href="/#about">About</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>

          <Link
            href="/register"
            aria-current="page"
            className="ml-auto inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-navy px-5 py-3 text-center text-sm font-semibold text-artis-white"
          >
            Register for Training
          </Link>
        </div>
      </header>

      <main>
        <section className="bg-artis-deep-navy px-5 py-14 text-artis-white sm:px-8 sm:py-16 lg:px-10 lg:py-18">
          <div className="mx-auto w-full max-w-7xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold sm:text-[13px]">
              Registration · Steps 1–2 of 3
            </p>
            <h1 className="mt-4.5 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl sm:leading-[1.45]">
              Register for Training
            </h1>
            <p className="mt-4.5 max-w-4xl text-base leading-7 sm:text-lg">
              Start by reviewing the training group and program package options
              currently available for registration.
            </p>
            <p className="mt-4.5 text-sm font-medium">
              Player, guardian, consent, and payment information will be
              collected in the registration form.
            </p>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
          <div className="mx-auto w-full max-w-7xl">
            {registrationAvailable ? (
              <ProgramSelector
                trainingGroups={trainingGroups}
                programPackages={programPackages}
              />
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
                  className="mt-6 inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-gold px-6 py-3 text-sm font-semibold text-artis-navy"
                >
                  Return to Home
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-artis-deep-navy px-5 py-12 text-artis-white sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold">ARTIS SOCCER ACADEMY</p>
            <p className="mt-2 text-sm">Contact information to be confirmed</p>
          </div>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium"
          >
            <Link href="/#training">Training</Link>
            <Link href="/#about">About</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

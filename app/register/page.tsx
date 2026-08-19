import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import { getRegistrationOptions } from "@/lib/registration-options";

export const metadata: Metadata = {
  title: "Register for Training",
  description:
    "View the available ARTIS Soccer Academy training groups and program packages",
};

const currencyFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

function formatCurrency(priceCents: number): string {
  return currencyFormatter.format(priceCents / 100);
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, hours, minutes));

  return timeFormatter.format(date);
}

function formatDay(day: string): string {
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}`;
}

function formatSessionType(sessionType: string): string {
  return sessionType === "game_training" ? "Game / match" : "Training";
}

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
              <div className="rounded-2xl border border-artis-border bg-artis-white p-5 sm:p-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold">
                    Program selection
                  </p>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                    Choose the right training option
                  </h2>
                  <p className="mt-3 max-w-3xl leading-7 text-artis-slate">
                    Review the age group schedule first, then choose the length
                    of the program. All sessions take place at Central Huron
                    Secondary School.
                  </p>
                </div>

                <div className="mt-8">
                  <h3 className="text-lg font-bold">Available age groups</h3>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {trainingGroups.map((group) => (
                      <article
                        key={group.id}
                        className="rounded-2xl border border-artis-border bg-artis-off-white p-5 sm:p-6"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-artis-gold">
                              Soccer development program
                            </p>
                            <h4 className="mt-2 text-xl font-bold">
                              {group.displayName}
                            </h4>
                          </div>
                          <span className="rounded-full bg-artis-soft-gold px-3 py-1 text-xs font-semibold">
                            Maximum {group.capacity} players
                          </span>
                        </div>

                        <ul className="mt-5 space-y-3">
                          {group.weeklySchedule.map((session) => (
                            <li
                              key={session.id}
                              className="flex flex-col gap-1 border-t border-artis-border pt-3 text-sm first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="font-semibold">
                                {formatDay(session.dayOfWeek)}
                              </span>
                              <span className="text-artis-slate">
                                {formatSessionType(session.sessionType)} ·{" "}
                                {formatTime(session.startTime)}–
                                {formatTime(session.endTime)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="mt-10">
                  <h3 className="text-lg font-bold">Program packages</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {programPackages.map((programPackage) => (
                      <article
                        key={programPackage.id}
                        className="rounded-2xl border border-artis-border p-5"
                      >
                        <p className="text-sm font-semibold text-artis-slate">
                          {programPackage.durationMonths} month
                          {programPackage.durationMonths === 1 ? "" : "s"}
                        </p>
                        <h4 className="mt-2 text-lg font-bold">
                          {programPackage.displayName}
                        </h4>
                        <p className="mt-5 text-2xl font-bold">
                          {formatCurrency(programPackage.priceCents)}
                        </p>
                        <p className="mt-1 text-sm text-artis-slate">
                          {programPackage.taxBehavior === "exclusive"
                            ? "Plus HST"
                            : "HST included"}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="mt-8 rounded-[10px] bg-artis-soft-gold p-5">
                  <h3 className="font-semibold">Program dates</h3>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-artis-slate">
                    Fixed program periods begin on the first of the month and
                    end on the final day of the applicable month. Confirmed
                    dates will be shown before payment.
                  </p>
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

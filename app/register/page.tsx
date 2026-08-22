// FIGMA-ALIGNED REGISTER PAGE — AUGUST 22, 2026
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import { getRegistrationOptions } from "@/lib/registration-options";

import ProgramSelector from "./program-selector";

const primaryNavigation = [
  { href: "/", label: "Home" },
  { href: "/#training", label: "Training" },
  { href: "/#schedule", label: "Schedule" },
  { href: "/#faq", label: "FAQ" },
  { href: "/about", label: "About Us" },
  { href: "/coaches", label: "Coaches" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/contact", label: "Contact Us" },
];

const footerNavigation = [
  { href: "/#training", label: "Training" },
  { href: "/about", label: "About" },
  { href: "/#faq", label: "FAQ" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refund-policy", label: "Refund Policy" },
];

export const metadata: Metadata = {
  title: "Register for Training",
  description:
    "Register a player for an ARTIS Soccer Academy training program.",
};

function MobileFooterContent() {
  return (
    <div className="bg-artis-deep-navy px-8 py-8 text-artis-white">
      <p className="text-[17px] font-bold leading-[25px]">
        ARTIS SOCCER ACADEMY
      </p>
      <div className="mt-3.5 space-y-1 text-sm leading-5">
        <nav aria-label="Footer navigation">
          <p>
            <Link href="/#training">Training</Link> ·{" "}
            <Link href="/about">About</Link> · <Link href="/#faq">FAQ</Link>
          </p>
          <p>
            <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/terms">Terms</Link> ·{" "}
            <Link href="/refund-policy">Refund Policy</Link>
          </p>
        </nav>
        <p>Contact information to be confirmed</p>
        <p>● Facebook · Coming Soon</p>
        <p>◎ Instagram · Coming Soon</p>
      </div>
    </div>
  );
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
      <header className="relative z-40 bg-artis-white">
        <div className="mx-auto flex h-[84px] w-full max-w-[1280px] items-center px-5 xl:h-28 xl:gap-10 xl:px-0">
          <Link
            href="/"
            className="flex shrink-0 items-center"
            aria-label="ARTIS Soccer Academy home"
          >
            <Image
              src="/logo.png"
              alt=""
              width={64}
              height={64}
              className="size-[52px] object-contain xl:size-16"
              priority
            />
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-6 whitespace-nowrap text-[15px] font-semibold leading-[22px] xl:flex"
          >
            {primaryNavigation.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/register"
            aria-current="page"
            className="ml-auto hidden min-h-12 shrink-0 items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white xl:inline-flex"
          >
            Register for Training
          </Link>

          <details className="group static ml-auto xl:hidden">
            <summary className="w-14 cursor-pointer list-none text-right text-[13px] font-semibold leading-[19px] [&::-webkit-details-marker]:hidden">
              MENU
            </summary>
            <div className="absolute inset-x-0 top-full z-50 shadow-[0_18px_30px_rgba(6,21,34,0.16)]">
              <nav
                aria-label="Mobile navigation"
                className="bg-artis-white px-6 pt-6 pb-10"
              >
                {primaryNavigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-15 items-center text-xl font-semibold leading-[30px]"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <MobileFooterContent />
            </div>
          </details>
        </div>
      </header>

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
                  className="mt-6 inline-flex min-h-12 items-center justify-center rounded-[10px] bg-artis-gold px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-navy"
                >
                  Return to Home
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer>
        <div className="xl:hidden">
          <MobileFooterContent />
        </div>

        <div className="hidden bg-artis-deep-navy px-10 py-12 text-artis-white xl:block">
          <div className="mx-auto flex w-full max-w-[1280px] items-center gap-10">
            <div className="w-[500px]">
              <p className="text-lg font-bold leading-[26px]">
                ARTIS SOCCER ACADEMY
              </p>
              <p className="mt-3 text-sm leading-5">
                Contact information to be confirmed
              </p>
            </div>

            <div className="w-[620px] text-sm font-medium leading-5">
              <nav
                aria-label="Footer navigation"
                className="flex flex-wrap gap-x-3"
              >
                {footerNavigation.map((item, index) => (
                  <span key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                    {index < footerNavigation.length - 1 ? " ·" : ""}
                  </span>
                ))}
              </nav>
              <p className="mt-1">
                ● Facebook · Coming Soon&nbsp;&nbsp;&nbsp;&nbsp;◎ Instagram ·
                Coming Soon
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

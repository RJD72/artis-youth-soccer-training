// ARTIS SPONSORS PAGE — FIGMA-ALIGNED — AUGUST 22, 2026
import type { Metadata } from "next";
import Link from "next/link";

import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";

export const metadata: Metadata = {
  title: "Sponsors",
  description:
    "View ARTIS Soccer Academy sponsors and learn how to support the academy.",
};

const sponsorPlaceholders = [
  "Sponsor position 1",
  "Sponsor position 2",
  "Sponsor position 3",
  "Sponsor position 4",
];

function SponsorLogoPlaceholder({ label }: { label: string }) {
  return (
    <div
      aria-label={`${label}: sponsor information coming soon`}
      className="flex h-35 w-full max-w-69.5 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-artis-border bg-artis-white text-center xl:h-40 xl:w-75 xl:max-w-none"
    >
      <p className="text-sm font-semibold leading-5">
        Sponsor logo coming soon
      </p>
      <p className="text-xs font-medium leading-4.5 tracking-[0.2px] text-artis-slate">
        Client-provided asset
      </p>
    </div>
  );
}

export default function SponsorsPage() {
  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="bg-artis-white">
        <section className="mx-auto w-full max-w-7xl px-6 pt-10 pb-12 xl:px-0 xl:py-18">
          <h1 className="text-[40px] font-bold leading-12 tracking-[-1px] xl:text-[64px] xl:leading-18 xl:tracking-[-2px]">
            Our Sponsors
          </h1>

          <p className="mt-6 max-w-225 text-base leading-6.5 text-artis-slate xl:mt-7 xl:text-lg xl:leading-7.5">
            Sponsor information will be added as client-approved logo assets
            become available.
          </p>

          <div className="mt-6 flex flex-col gap-4 xl:mt-7 xl:grid xl:grid-cols-4 xl:gap-6">
            {sponsorPlaceholders.map((label) => (
              <SponsorLogoPlaceholder key={label} label={label} />
            ))}
          </div>

          <section className="mt-6 bg-artis-soft-gold p-6 xl:mt-7 xl:p-10">
            <h2 className="text-[22px] font-semibold leading-7.5 xl:text-[36px] xl:font-bold xl:leading-11 xl:tracking-[-1px]">
              Interested in supporting ARTIS Soccer Academy?
            </h2>
            <p className="mt-3.5 text-base leading-6.5 text-artis-slate xl:mt-4 xl:text-lg xl:leading-7.5">
              Contact us to discuss sponsorship opportunities.
            </p>
            <Link
              href="/contact?topic=sponsorship"
              className="mt-3.5 inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white xl:mt-4 xl:w-67.5"
            >
              Contact Us About Sponsorship
            </Link>
          </section>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

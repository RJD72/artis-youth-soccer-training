// ARTIS SPONSORS PAGE — FIGMA-ALIGNED — AUGUST 22, 2026
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";

export const metadata: Metadata = {
  title: "Sponsors",
  description:
    "View ARTIS Soccer Academy sponsors and learn how to support the academy.",
};

const sponsors = [
  {
    name: "Townsend Tire",
    image: "/images/sponsors/townsend-tire.png",
    href: "https://www.townsendtire.ca/",
  },
  {
    name: "Emerald Construction & Masonry",
    image: "/images/sponsors/emerald-construction-masonry.jpeg",
    href: "https://www.facebook.com/p/Emerald-Construction-Masonry-Blyth-100091943620697/",
  },
] as const;

export default function SponsorsPage() {
  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="bg-artis-white">
        <section className="mx-auto w-full max-w-7xl px-6 pt-10 pb-12 xl:px-0 xl:py-18">
          <h1 className="text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
            Our Sponsors
          </h1>

          <p className="mt-6 max-w-225 text-base leading-6.5 text-artis-slate xl:mt-7 xl:text-lg xl:leading-7.5">
            ARTIS Soccer Academy is proud to be supported by local businesses
            and community partners.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:mt-7 xl:gap-6">
            {sponsors.map((sponsor) => (
              <a
                key={sponsor.name}
                href={sponsor.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Visit ${sponsor.name}`}
                className="group flex min-h-64 flex-col overflow-hidden rounded-2xl border border-artis-border bg-artis-white transition hover:border-artis-gold hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/30 xl:min-h-72"
              >
                <span className="flex h-52 w-full items-center justify-center p-5 xl:h-60 xl:p-7">
                  <span className="relative block size-full">
                    <Image
                      src={sponsor.image}
                      alt={`${sponsor.name} logo`}
                      fill
                      sizes="(min-width: 1280px) 600px, (min-width: 640px) 50vw, 100vw"
                      className="object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  </span>
                </span>

                <span className="mt-auto border-t border-artis-border px-5 py-4 text-center text-sm font-semibold text-artis-slate transition-colors group-hover:text-artis-navy">
                  {sponsor.name}
                </span>
              </a>
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

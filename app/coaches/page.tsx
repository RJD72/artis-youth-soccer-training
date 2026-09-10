// ARTIS COACHES PAGE
import type { Metadata } from "next";
import Image from "next/image";

import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";

export const metadata: Metadata = {
  title: "Coaches",
  description:
    "Meet the coaches supporting player development at ARTIS Soccer Academy.",
};

const coachPlaceholders = ["Coach profile 2", "Coach profile 3"];

function CoachPhotoPlaceholder() {
  return (
    <div className="flex h-39.75 w-full items-center justify-center rounded-2xl border-2 border-dashed border-artis-border bg-artis-soft-gold p-4 text-center xl:h-44.5">
      <div>
        <p
          aria-hidden="true"
          className="text-[21px] font-semibold leading-none text-artis-gold xl:text-2xl"
        >
          ▧
        </p>
        <p className="mt-1.5 text-[11px] font-semibold leading-4 text-artis-navy xl:text-xs">
          Approved coach photograph
        </p>
        <p className="mt-1 text-[8px] leading-3 text-artis-slate xl:text-[9px]">
          Client image will be added here
        </p>
      </div>
    </div>
  );
}

function HeadCoachCard() {
  return (
    <article className="flex w-full flex-col gap-4 rounded-2xl border border-artis-border bg-artis-white p-6 xl:w-[360px]">
      <div className="relative h-64 w-full overflow-hidden rounded-2xl xl:h-72">
        <Image
          src="/images/coaches/head-coach.png"
          alt="Mario Blazevic, Head Coach at ARTIS Soccer Academy"
          fill
          sizes="(min-width: 1280px) 360px, 100vw"
          className="object-cover"
          priority
        />
      </div>

      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-artis-gold">
          Head Coach
        </p>

        <h2 className="mt-1 text-[26px] font-bold leading-[34px] text-artis-navy">
          Mario Blazevic
        </h2>
      </div>

      <p className="text-base leading-[26px] text-artis-slate">
        Former professional soccer player with experience competing in
        Europe&apos;s First Division. Having progressed through every stage of
        player development, from youth soccer to the professional level, he
        brings firsthand experience, technical knowledge, discipline, and
        passion to developing the next generation of players.
      </p>
    </article>
  );
}

function CoachPlaceholderCard({ label }: { label: string }) {
  return (
    <article
      aria-label={label}
      className="flex w-full flex-col gap-4 rounded-2xl border border-artis-border bg-artis-white p-6 xl:w-[360px]"
    >
      <CoachPhotoPlaceholder />

      <h2 className="text-[22px] font-semibold leading-[30px]">
        Coach profile coming soon
      </h2>

      <p className="text-sm font-semibold leading-5">
        Role and credentials to be confirmed
      </p>

      <p className="text-base leading-[26px] text-artis-slate">
        The coach biography will be added after the information has been
        supplied and approved by ARTIS Soccer Academy.
      </p>
    </article>
  );
}

export default function CoachesPage() {
  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="bg-artis-white">
        <section className="mx-auto w-full max-w-[1280px] px-6 pt-10 pb-12 xl:px-0 xl:py-18">
          <h1 className="text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
            Meet the Coaches
          </h1>

          <p className="mt-6 max-w-[900px] text-base leading-[26px] text-artis-slate xl:mt-7 xl:text-lg xl:leading-[30px]">
            Meet the coaches bringing experience, technical knowledge and a
            passion for player development to ARTIS Soccer Academy.
          </p>

          <div className="mt-6 grid gap-5 xl:mt-7 xl:grid-cols-3 xl:justify-between xl:gap-0">
            <HeadCoachCard />

            {/* {coachPlaceholders.map((label) => (
              <CoachPlaceholderCard key={label} label={label} />
            ))} */}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

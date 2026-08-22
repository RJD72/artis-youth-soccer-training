// ARTIS FULL-GROUP PAGE — AUGUST 22, 2026
import type { Metadata } from "next";
import Link from "next/link";

import SiteFooter from "../../components/site-footer";
import SiteHeader from "../../components/site-header";

export const metadata: Metadata = {
  title: "Training Group Full",
  description:
    "Join the waitlist for a full ARTIS Soccer Academy training group.",
};

type FullGroupPageProps = {
  searchParams: Promise<{
    group?: string | string[];
  }>;
};

const trainingGroups = {
  "ages-8-10": {
    displayName: "Ages 8–10",
    capacity: 30,
  },
  "ages-11-13": {
    displayName: "Ages 11–13",
    capacity: 30,
  },
} as const;

type TrainingGroupSlug = keyof typeof trainingGroups;

function isTrainingGroupSlug(value: string): value is TrainingGroupSlug {
  return value in trainingGroups;
}

export default async function FullGroupPage({
  searchParams,
}: FullGroupPageProps) {
  const { group: groupValue } = await searchParams;
  const groupSlug = Array.isArray(groupValue) ? groupValue[0] : groupValue;
  const selectedGroup =
    groupSlug && isTrainingGroupSlug(groupSlug)
      ? trainingGroups[groupSlug]
      : undefined;
  const waitlistHref =
    groupSlug && isTrainingGroupSlug(groupSlug)
      ? `/register/waitlist?group=${groupSlug}`
      : "/register/waitlist";

  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="bg-artis-white">
        <section className="mx-auto flex w-full max-w-[880px] flex-col items-start gap-5 px-6 pt-14 pb-16 xl:gap-6 xl:px-0 xl:py-25">
          <p className="text-sm font-semibold leading-5">
            {selectedGroup?.displayName ?? "Selected age group"} · Capacity{" "}
            {selectedGroup?.capacity ?? 30} players
          </p>

          <h1 className="w-full text-[40px] font-bold leading-[48px] tracking-[-1px] xl:text-[64px] xl:leading-[72px] xl:tracking-[-2px]">
            This age group is currently full.
          </h1>

          <p className="w-full text-base leading-[26px] text-artis-slate xl:text-lg xl:leading-[30px]">
            You can still join the waitlist for the next available opening or an
            upcoming month.
          </p>

          <p className="w-full text-base leading-[26px] text-artis-slate xl:text-lg xl:leading-[30px]">
            Joining the waitlist does not require payment and does not guarantee
            placement.
          </p>

          <Link
            href={waitlistHref}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white xl:w-[220px]"
          >
            Join the Waitlist
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

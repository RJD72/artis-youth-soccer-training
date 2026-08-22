import type { Metadata } from "next";

import SiteFooter from "../components/site-footer";
import SiteHeader from "../components/site-header";

export const metedata: Metadata = {
  title: "About Us",
  description:
    "Learn about the development philosophy behind ARTIS Soccer Academy",
};

function ImagePlaceholder() {
  return (
    <div className="flex h-[195px] w-full max-w-[900px] items-center justify-center rounded-2xl border-2 border-dashed border-artis-border bg-artis-soft-gold p-5 text-center xl:h-[514px] xl:p-6">
      <div>
        <p
          aria-hidden="true"
          className="text-[26px] font-semibold leading-none text-artis-gold xl:text-[32px]"
        >
          ▧
        </p>
        <p className="mt-2 text-[13px] font-semibold leading-5 text-artis-navy xl:text-base xl:leading-6">
          Founders, leadership or coaching activity photograph
        </p>
        <p className="mt-1 text-[10px] leading-4 text-artis-slate xl:text-xs">
          Approved client photograph will be added here
        </p>
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="bg-artis-white">
        <section className="mx-auto w-full max-w-[1280px] px-6 pt-10 pb-12 xl:px-0 xl:py-18">
          <h1 className="text-[40px] font-bold leading-12 tracking-[-1px] xl:text-[64px] xl:leading-18 xl:tracking-[-2px]">
            About ARTIS Soccer Academy
          </h1>

          <p className="mt-6 max-w-[900px] text-base leading-[26px] text-artis-slate xl:mt-7 xl:text-lg xl:leading-[30px]">
            Master the Art. Build the Skill. Develop Discipline. Grow
            Confidence. Love the Game.
          </p>

          <div className="mt-6 xl:mt-7">
            <ImagePlaceholder />
          </div>

          <h2 className="mt-6 max-w-[900px] text-[22px] font-semibold leading-[30px] xl:mt-7 xl:text-[36px] xl:font-bold xl:leading-11 xl:tracking-[-1px]">
            Soccer is both an art and a skill.
          </h2>

          <p className="mt-6 max-w-225 text-base leading-6.5 text-artis-slate xl:mt-7 xl:text-lg xl:leading-7.5">
            At ARTIS Soccer Academy, players develop through creativity,
            repetition, discipline and a commitment to getting better every day.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

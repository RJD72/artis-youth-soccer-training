import type { Metadata } from "next";
import { and, eq, isNotNull } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";
import { legalDocuments } from "@/db/schema";

export const metadata: Metadata = {
  title: "Gym and Facility Rules",
  description:
    "Review the school gym and facility rules for ARTIS Soccer Academy training sessions.",
};

async function getGymFacilityRules() {
  const [document] = await db
    .select({
      title: legalDocuments.title,
      content: legalDocuments.content,
      version: legalDocuments.version,
    })
    .from(legalDocuments)
    .where(
      and(
        eq(legalDocuments.documentType, "gym_facility_rules"),
        eq(legalDocuments.isActive, true),
        isNotNull(legalDocuments.publishedAt),
      ),
    )
    .limit(1);

  return document ?? null;
}

export default async function GymRulesPage() {
  await connection();

  const rules = await getGymFacilityRules();

  return (
    <main className="min-h-screen bg-artis-off-white text-artis-navy">
      <section className="bg-artis-deep-navy text-artis-white">
        <div className="mx-auto w-full max-w-[1000px] px-6 py-10 sm:px-8 xl:px-0 xl:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold xl:text-[13px]">
            ARTIS Soccer Academy
          </p>

          <h1 className="mt-3 text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
            Gym and Facility Rules
          </h1>

          <p className="mt-4 max-w-[850px] text-base leading-7 text-artis-white/85 xl:text-lg xl:leading-8">
            Please review these school-use requirements before acknowledging the
            gym or facility rules on the registration form.
          </p>
        </div>
      </section>

      <section className="bg-artis-white">
        <div className="mx-auto w-full max-w-[1000px] px-6 py-10 sm:px-8 xl:px-0 xl:py-14">
          {rules ? (
            <>
              <article className="rounded-2xl border border-artis-border bg-artis-off-white p-6 sm:p-8">
                <div className="whitespace-pre-wrap text-[15px] leading-7 text-artis-slate">
                  {rules.content}
                </div>
              </article>

              <p className="mt-6 text-center text-xs text-artis-slate">
                Rules version: {rules.version}
              </p>

              <p className="mt-8 text-center text-sm font-semibold leading-6 text-artis-slate">
                When you have finished reviewing these rules, close this tab and
                return to the registration form.
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-artis-border bg-artis-off-white p-6 sm:p-8">
              <h2 className="text-xl font-bold">
                Gym and facility rules temporarily unavailable
              </h2>

              <p className="mt-3 leading-7 text-artis-slate">
                Please contact ARTIS Soccer Academy before completing
                registration.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

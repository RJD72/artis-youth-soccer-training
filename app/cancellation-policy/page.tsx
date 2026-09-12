import type { Metadata } from "next";
import { and, eq, isNotNull } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";
import { legalDocuments } from "@/db/schema";

export const metadata: Metadata = {
  title: "Cancellation Policy",
  description: "Review the ARTIS Soccer Academy cancellation policy.",
};

async function getCancellationPolicy() {
  const [document] = await db
    .select({
      title: legalDocuments.title,
      content: legalDocuments.content,
      version: legalDocuments.version,
    })
    .from(legalDocuments)
    .where(
      and(
        eq(legalDocuments.documentType, "cancellation_refund_policy"),
        eq(legalDocuments.isActive, true),
        isNotNull(legalDocuments.publishedAt),
      ),
    )
    .limit(1);

  return document ?? null;
}

export default async function CancellationPolicyPage() {
  await connection();

  const policy = await getCancellationPolicy();

  return (
    <main className="min-h-screen bg-artis-off-white text-artis-navy">
      <section className="bg-artis-deep-navy text-artis-white">
        <div className="mx-auto w-full max-w-[1000px] px-6 py-10 sm:px-8 xl:px-0 xl:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold xl:text-[13px]">
            ARTIS Soccer Academy
          </p>

          <h1 className="mt-3 text-[30px] font-bold leading-[44px] xl:text-[40px] xl:leading-[58px]">
            Cancellation Policy
          </h1>

          <p className="mt-4 max-w-[850px] text-base leading-7 text-artis-white/85 xl:text-lg xl:leading-8">
            Please review this policy before completing registration.
          </p>
        </div>
      </section>

      <section className="bg-artis-white">
        <div className="mx-auto w-full max-w-[1000px] px-6 py-10 sm:px-8 xl:px-0 xl:py-14">
          {policy ? (
            <>
              <article className="rounded-2xl border border-artis-border bg-artis-off-white p-6 sm:p-8">
                <div className="whitespace-pre-wrap text-[15px] leading-7 text-artis-slate">
                  {policy.content}
                </div>
              </article>

              <p className="mt-6 text-center text-xs text-artis-slate">
                Policy version: {policy.version}
              </p>

              <p className="mt-8 text-center text-sm font-semibold leading-6 text-artis-slate">
                When you have finished reviewing this policy, close this tab and
                return to the registration form.
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-artis-border bg-artis-off-white p-6 sm:p-8">
              <h2 className="text-xl font-bold">
                Cancellation policy temporarily unavailable
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

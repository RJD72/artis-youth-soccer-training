import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";

import SiteFooter from "../../../components/site-footer";
import SiteHeader from "../../../components/site-header";
import { db } from "@/db";
import { trainingGroups, waitlistEntries } from "@/db/schema";
import { verifyWaitlistConfirmationReference } from "@/lib/waitlist-confirmation";

export const metadata: Metadata = {
  title: "Waitlist Confirmation",
  description:
    "Confirmation that a player has joined an ARTIS Soccer Academy waitlist.",
};

type WaitlistConfirmationPageProps = {
  searchParams: Promise<{
    entry?: string | string[];
    expires?: string | string[];
    signature?: string | string[];
  }>;
};

type WaitlistConfirmationDetails = {
  playerName: string;
  trainingGroupName: string;
};

function getSingleSearchParameter(
  value: string | string[] | undefined,
): string | null {
  return typeof value === "string" ? value : null;
}

async function getConfirmationDetails(
  searchParams: WaitlistConfirmationPageProps["searchParams"],
): Promise<WaitlistConfirmationDetails | null> {
  const parameters = await searchParams;
  const entryValue = getSingleSearchParameter(parameters.entry);
  const expiresValue = getSingleSearchParameter(parameters.expires);
  const signatureValue = getSingleSearchParameter(parameters.signature);

  if (!entryValue || !expiresValue || !signatureValue) {
    return null;
  }

  const entryId = verifyWaitlistConfirmationReference(
    entryValue,
    expiresValue,
    signatureValue,
  );

  if (entryId === null) {
    return null;
  }

  const [waitlistEntry] = await db
    .select({
      childFirstName: waitlistEntries.childFirstName,
      childLastName: waitlistEntries.childLastName,
      trainingGroupName: trainingGroups.displayName,
    })
    .from(waitlistEntries)
    .innerJoin(
      trainingGroups,
      eq(waitlistEntries.trainingGroupId, trainingGroups.id),
    )
    .where(eq(waitlistEntries.id, entryId))
    .limit(1);

  if (!waitlistEntry) {
    return null;
  }

  return {
    playerName: `${waitlistEntry.childFirstName} ${waitlistEntry.childLastName}`,
    trainingGroupName: waitlistEntry.trainingGroupName,
  };
}

export default async function WaitlistConfirmationPage({
  searchParams,
}: WaitlistConfirmationPageProps) {
  const confirmationDetails = await getConfirmationDetails(searchParams);

  return (
    <div className="flex min-h-screen flex-col bg-artis-off-white text-artis-navy">
      <SiteHeader />

      <main className="flex-1 bg-[#eaf6f0]">
        <section className="mx-auto flex w-full max-w-[880px] flex-col items-start gap-[18px] px-6 pt-16 pb-18 xl:gap-5 xl:px-0 xl:py-25">
          {confirmationDetails ? (
            <>
              <p className="w-full text-sm font-semibold leading-5 text-artis-success">
                WAITLIST CONFIRMED
              </p>

              <h1 className="w-full text-[40px] font-bold leading-[48px] tracking-[-1px] xl:text-[64px] xl:leading-[72px] xl:tracking-[-2px]">
                You’re on the Waitlist
              </h1>

              <p className="w-full text-base leading-[26px] xl:text-lg xl:leading-[30px]">
                Player: {confirmationDetails.playerName}
              </p>

              <p className="w-full text-base leading-[26px] xl:text-lg xl:leading-[30px]">
                Selected age group: {confirmationDetails.trainingGroupName}
              </p>

              <p className="w-full text-base leading-[26px] text-artis-slate xl:text-lg xl:leading-[30px]">
                No payment has been collected.
              </p>

              <p className="w-full text-base leading-[26px] text-artis-slate xl:text-lg xl:leading-[30px]">
                ARTIS Soccer Academy will contact the parent or guardian if a
                place becomes available.
              </p>
            </>
          ) : (
            <>
              <p className="w-full text-sm font-semibold leading-5 text-artis-slate">
                CONFIRMATION UNAVAILABLE
              </p>

              <h1 className="w-full text-[40px] font-bold leading-[48px] tracking-[-1px] xl:text-[64px] xl:leading-[72px] xl:tracking-[-2px]">
                We can’t show these details
              </h1>

              <p className="w-full text-base leading-[26px] text-artis-slate xl:text-lg xl:leading-[30px]">
                This confirmation link is invalid or has expired. For privacy,
                waitlist details are available for one hour after submission.
              </p>

              <p className="w-full text-base leading-[26px] text-artis-slate xl:text-lg xl:leading-[30px]">
                If you recently submitted the waitlist form, your information
                may still have been saved successfully.
              </p>
            </>
          )}

          <Link
            href="/"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-center text-[15px] font-semibold leading-5 text-artis-white xl:w-[190px]"
          >
            Return to Home
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

// Publishes the client-provided ARTIS Soccer Academy legal documents.
//
// IMPORTANT:
// - The legal wording below is intentionally preserved as supplied by the client/lawyer.
// - The only waiver edits are:
//   1. replacing "[name of business]" with "ARTIS Soccer Academy"; and
//   2. correcting the section numbering sequence.
// - Existing legal-document versions are never overwritten with different content.
//   If this version number already exists with different text, the script stops so a
//   new version must be created instead.
//
// Run intentionally with:
//   npx tsx scripts/publish-production-legal-documents.ts --publish
//
// The --publish flag is required so this script cannot be run accidentally.

import { createHash } from "node:crypto";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db, pool } from "../db";
import { legalDocuments } from "../db/schema";

const productionDocuments = [
  {
    documentType: "participation_waiver",
    version: "2026-09-11-v1",
    title: "WAIVER & ACKNOWLEDGEMENT AND RELEASE",
    content: `WAIVER & ACKNOWLEDGEMENT AND RELEASE
WAIVER & ACKNOWLEDGEMENT AND RELEASE

In signing this document you are waiving the right to bring a court action to recover compensation or obtain any other remedy for; personal injuries, damage to property, loss of property, accident of any kind, death, arising out of your use of or participation in the youth soccer education and training program, hereinafter referred to as Artis Soccer Academy. This includes Artis Soccer Academy’s: facilities, equipment, your participation in classes, or activities sponsored by ARTIS Soccer Academy (including but not limited to tournaments, boot camps, seminars, clinics, and workshops) whether supervised or unsupervised. You must be 18 years of age or older to sign this Acknowledgement and Release, otherwise a parent or guardian must sign on your behalf.

ACKNOWLEDGEMENT AND RELEASE

WHEREAS Artis Soccer Academy operates soccer training programs and equipment located at the Central Huron Secondary School in Clinton, Ontario (hereinafter referred to as the “Academy”);

AND WHEREAS an essential condition for the Academy permitting me to use its facilities and/or participate in any programs and/or training activities, I have agreed to give this Acknowledgement and Release.

NOW THEREFORE, IN CONSIDERATION of the Academy permitting me, or my child, to participate in the program Activities, I, for myself or on behalf of my child, my personal representatives, assigns, and heirs:

(1) ACKNOWLEDGE, agree and represent that I understand the nature of the Academy and the Activities that I, or my child, am in good health and in proper physical condition to use Academy’s facilities.

(2) I fully understand that;

A). The Academy’s programs and activities may involve serious risks and dangers of serious bodily injury, including permanent disability, paralysis, infectious diseases, and death (collectively referred to as the “Risks”).

B). These Risks may be caused by my own action, the actions or inactions of others using or participating in the Academy’s programs, the condition of the Academy’s facilities or the condition in which the Academy’s activities take place, or the negligence of the Releasees listed below.

C). There may be other special or unusual risks associated with the participation in the Academy, including social or economic losses, either known to me or not readily foreseeable at this time: AND

I, AND ON BEHALF OF MY CHILD, FULLY ACCEPT AND ASSUME ALL SUCH RISKS AND ALL RESPONSIBILITY FOR ALL LOSSES, COSTS, AND DAMAGES I MAY INCUR AS A RESULT OF MY USE OF THE GYM OR MY PARTICIPATION IN THE GYM ACTIVITIES BOTH NOW AND IN THE FUTURE.

(3) HEREBY RELEASE, and forever discharge and covenant not to sue the Academy, its officers, directors, shareholders, employees, volunteers, instructors, participants in the Academy’s programs, users of the Academy’s facilities, assigns, owners and lessors of the facility where the Academy is located, all designers, manufacturers and installers of equipment and other fixtures located at the Gym’s facilities(collectively referred to as the “Releasees”) from all liability, claims, causes of action, demands, losses or damages on my account caused, or alleged to have been caused, by in whole or in part by my, or my child’s, use of, or participation in, the Academy or the negligence of the releases or otherwise. I further agree that if despite executing this acknowledgement and release I or anyone on my behalf, makes a claim against any of the releases, whether directly or indirectly, I will indemnify, save and hold harmless each of the releases from any litigation expense, solicitor fee, loss, liability, damage or cost which may be incurred as a result of such claim.

(4) CHOICE OF LAW AND ATTORNMENT- This acknowledgement and release shall be governed by and construed in accordance with the laws of the province of Ontario and the laws of Canada applicable within. I agree that the courts of the province of Ontario will have exclusive jurisdiction to determine all disputes and claims arising between the parties.

(5) SUCCESSORS AND ASSIGNS- This acknowledgement and release shall be binding upon myself, my personal representatives, assigns, and heirs and shall endure the benefit of ARTIS Soccer Academy and its respective heirs, executors, administrators, directors, successors, assigns and legal representatives.

(6) I understand and agree that as a club member, instructor, employee, or visitor I may be photographed, videotaped, contacted by email or other means, or have my likeness recorded by other means and used for commercial purposes including but not limited to marketing, instructional products, and internet applications. I also understand and agree that all pictures, videos, and other recordings done inside the Academy’s facilities are the intellectual property of the Academy. As such, permission to use said pictures, videos, and other recordings, can be granted and withdrawn by the Academy at anytime.

I have read this acknowledgement and release, and fully understand its terms and understand that I have given up substantial rights by signing it, and have signed it freely and without any inducement or assistance of any nature and intend it to be irrevocable and unconditional release of all liability to the greatest extent allowed by law and agree that if any portion of this acknowledgement and release is held to be invalid, the balance of the acknowledgement and release shall continue in full force and effect.

Dated in ON on (dd/mm/yyyy):

Name of participant:

Name of person signing:`,
  },
  {
    documentType: "cancellation_refund_policy",
    version: "2026-09-11-v1",
    title: "Cancellation Policy",
    content: `Cancellation Policy

At Artis Soccer Academy, we plan our programs, facilities, coaching, and resources in advance to provide a consistent experience for every player.

Monthly Memberships

Monthly memberships require 30 days' written notice to cancel. Payments already processed are non-refundable, and the membership will remain active through the applicable notice period.

Multi-Month & Annual Programs

Payments for 2-month, 6-month, and annual programs are non-refundable once the program has started.

Missed Sessions

We understand that players may occasionally miss sessions due to illness, injury, or other unexpected circumstances. Illness or injury-related absences will be considered on a case-by-case basis, and Artis Soccer Academy may provide a credit or other appropriate accommodation when circumstances warrant it. Regular absences due to vacations, scheduling conflicts, or other personal commitments are not eligible for refunds or credits.

Cancelled Sessions

If Artis Soccer Academy must cancel a session due to facility closures, severe weather, or other circumstances beyond our control, the session may be rescheduled or an appropriate credit may be provided.

Special Circumstances

Artis Soccer Academy may consider exceptional circumstances on a case-by-case basis.

By registering for an Artis Soccer Academy program, you acknowledge and agree to this cancellation policy.`,
  },
  {
    documentType: "gym_facility_rules",
    version: "2026-09-12-v1",
    title: "Gym and Facility Rules",
    content: `Gym and Facility Rules

These rules were provided for community use of the school facility. Players, families and other attendees should follow them whenever they are present at the facility.

Footwear and cleanliness

- Non-marking indoor shoes must be worn in the gym at all times.
- The facility must be left clean, tidy and in the same condition in which it was provided. Custodial charges may be invoiced if additional cleaning is required.

Building access and security

- Schools may cancel approved permits or individual bookings when the facility is required for a school function.
- Community-use groups must never prop open exterior doors. School buildings remain locked for the security of the building and its occupants.
- When a permit holder has a keycard, someone must wait at the entrance until every member of the group has entered.
- When a permit holder does not have a keycard, the evening custodian will admit the first member of the group. Someone from the group must then wait at the entrance until everyone has entered.

School property and displays

- Artwork, posters and other materials must not be removed from the walls during permitted use.
- School facilities are public school spaces. Displays, materials and other school property must not be removed, altered or interfered with.
- Do not place tape on gymnasium floors. Removing tape can damage the floor surface.

Equipment

- Any school equipment approved for use must be returned and stored as neatly as it was found.
- The community-use group may be responsible for replacing equipment that is missing or damaged.

Food, beverages and allergies

- Food and beverages are not permitted in the gymnasium or carpeted areas.
- School buildings are food-allergy conscious. Please avoid bringing foods that contain nuts.

Accessibility and school questions

- For accessibility information about an individual school building, please visit that school’s website before attending.
- For questions relating to the school or its facilities, please contact the school directly.

Thank you for helping keep the school safe, secure and ready for everyone who uses it.`,
  },
] as const;

type ProductionDocument = (typeof productionDocuments)[number];
type ProductionDocumentType = ProductionDocument["documentType"];

const productionDocumentTypes = productionDocuments.map(
  (document) => document.documentType,
) as ProductionDocumentType[];

function requireExplicitPublishAuthorization(): void {
  if (!process.argv.includes("--publish")) {
    throw new Error(
      "Publishing legal documents requires the explicit --publish command-line flag.",
    );
  }
}

function createContentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function publishProductionDocuments(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const document of productionDocuments) {
      const contentHash = createContentHash(document.content);

      const [existingVersion] = await tx
        .select({
          id: legalDocuments.id,
          contentHash: legalDocuments.contentHash,
          publishedAt: legalDocuments.publishedAt,
        })
        .from(legalDocuments)
        .where(
          and(
            eq(legalDocuments.documentType, document.documentType),
            eq(legalDocuments.version, document.version),
          ),
        )
        .limit(1);

      if (existingVersion && existingVersion.contentHash !== contentHash) {
        throw new Error(
          `${document.documentType} version ${document.version} already exists with different content. Create a new version instead of overwriting a published legal document.`,
        );
      }

      if (!existingVersion) {
        await tx.insert(legalDocuments).values({
          documentType: document.documentType,
          version: document.version,
          title: document.title,
          content: document.content,
          contentHash,
          isActive: false,
          publishedAt: new Date(),
        });
      }

      await tx
        .update(legalDocuments)
        .set({
          isActive: false,
        })
        .where(
          and(
            eq(legalDocuments.documentType, document.documentType),
            eq(legalDocuments.isActive, true),
          ),
        );

      const publishedAt = existingVersion?.publishedAt ?? new Date();

      await tx
        .update(legalDocuments)
        .set({
          isActive: true,
          publishedAt,
        })
        .where(
          and(
            eq(legalDocuments.documentType, document.documentType),
            eq(legalDocuments.version, document.version),
          ),
        );

      console.log(
        `Published ${document.documentType} version ${document.version}.`,
      );
    }
  });

  const activeDocuments = await db
    .select({
      id: legalDocuments.id,
      documentType: legalDocuments.documentType,
      version: legalDocuments.version,
      title: legalDocuments.title,
      publishedAt: legalDocuments.publishedAt,
    })
    .from(legalDocuments)
    .where(
      and(
        inArray(legalDocuments.documentType, productionDocumentTypes),
        eq(legalDocuments.isActive, true),
        isNotNull(legalDocuments.publishedAt),
      ),
    );

  for (const documentType of productionDocumentTypes) {
    const matches = activeDocuments.filter(
      (document) => document.documentType === documentType,
    );

    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one active ${documentType} document after publishing, but found ${matches.length}.`,
      );
    }
  }

  console.log("Production legal documents published successfully.");
  console.table(activeDocuments);
}

async function run(): Promise<void> {
  requireExplicitPublishAuthorization();

  try {
    await publishProductionDocuments();
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error("Production legal-document publishing failed:");
  console.error(error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});

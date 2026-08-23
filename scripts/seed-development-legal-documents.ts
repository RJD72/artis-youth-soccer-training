// This script creates clearly labelled legal-document placeholders for local
// development only. It exists so the complete registration and payment flow
// can be tested before the client supplies lawyer-approved documents.

import { createHash } from "node:crypto";
import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db, pool } from "../db";
import { legalDocuments } from "../db/schema";

const requiredLegalDocumentTypes = [
  "terms_conditions",
  "participation_waiver",
  "gym_facility_rules",
] as const;

type RequiredLegalDocumentType = (typeof requiredLegalDocumentTypes)[number];

type DevelopmentLegalDocument = {
  documentType: RequiredLegalDocumentType;
  title: string;
  content: string;
};

const developmentDocuments: DevelopmentLegalDocument[] = [
  {
    documentType: "terms_conditions",
    title: "Development Placeholder — Terms and Conditions",
    content:
      "DEVELOPMENT TEST PLACEHOLDER — NOT APPROVED FOR PRODUCTION. The final ARTIS Soccer Academy Terms and Conditions must replace this text before registration is opened to the public.",
  },
  {
    documentType: "participation_waiver",
    title: "Development Placeholder — Participation Waiver",
    content:
      "DEVELOPMENT TEST PLACEHOLDER — NOT APPROVED FOR PRODUCTION. The lawyer-reviewed ARTIS Soccer Academy Participation Waiver must replace this text before registration is opened to the public.",
  },
  {
    documentType: "gym_facility_rules",
    title: "Development Placeholder — Gym and Facility Rules",
    content:
      "DEVELOPMENT TEST PLACEHOLDER — NOT APPROVED FOR PRODUCTION. The client-approved gym and facility rules must replace this text before registration is opened to the public.",
  },
];

function requireDevelopmentAuthorization(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Development legal placeholders cannot be created in production.",
    );
  }

  if (process.env.ALLOW_DEVELOPMENT_LEGAL_PLACEHOLDERS !== "true") {
    throw new Error(
      "Set ALLOW_DEVELOPMENT_LEGAL_PLACEHOLDERS=true for this command only.",
    );
  }
}

function createContentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function getActiveRequiredDocuments() {
  return db
    .select({
      id: legalDocuments.id,
      documentType: legalDocuments.documentType,
      title: legalDocuments.title,
    })
    .from(legalDocuments)
    .where(
      and(
        inArray(legalDocuments.documentType, requiredLegalDocumentTypes),
        eq(legalDocuments.isActive, true),
        isNotNull(legalDocuments.publishedAt),
      ),
    );
}

function requireNoDuplicateActiveDocuments(
  activeDocuments: Awaited<ReturnType<typeof getActiveRequiredDocuments>>,
): void {
  for (const documentType of requiredLegalDocumentTypes) {
    const matchingDocuments = activeDocuments.filter(
      (document) => document.documentType === documentType,
    );

    if (matchingDocuments.length > 1) {
      throw new Error(
        `More than one active ${documentType} document exists. Resolve the duplicate before continuing.`,
      );
    }
  }
}

async function insertMissingDevelopmentDocuments(): Promise<void> {
  const activeDocuments = await getActiveRequiredDocuments();
  requireNoDuplicateActiveDocuments(activeDocuments);

  const activeDocumentTypes = new Set(
    activeDocuments.map((document) => document.documentType),
  );

  for (const document of developmentDocuments) {
    if (activeDocumentTypes.has(document.documentType)) {
      console.log(`Kept existing active document: ${document.documentType}`);
      continue;
    }

    const publishedAt = new Date();

    await db
      .insert(legalDocuments)
      .values({
        documentType: document.documentType,
        version: "development-placeholder-v1",
        title: document.title,
        content: document.content,
        contentHash: createContentHash(document.content),
        isActive: true,
        publishedAt,
      })
      .onDuplicateKeyUpdate({
        set: {
          title: document.title,
          content: document.content,
          contentHash: createContentHash(document.content),
          isActive: true,
          publishedAt,
        },
      });

    console.log(`Created development placeholder: ${document.documentType}`);
  }

  const finalActiveDocuments = await getActiveRequiredDocuments();
  requireNoDuplicateActiveDocuments(finalActiveDocuments);

  const finalDocumentTypes = new Set(
    finalActiveDocuments.map((document) => document.documentType),
  );
  const hasEveryRequiredDocument = requiredLegalDocumentTypes.every(
    (documentType) => finalDocumentTypes.has(documentType),
  );

  if (!hasEveryRequiredDocument) {
    throw new Error(
      "The development legal documents could not be prepared completely.",
    );
  }

  console.log("Development legal documents are ready for local testing.");
  console.table(finalActiveDocuments);
}

async function run(): Promise<void> {
  requireDevelopmentAuthorization();

  try {
    await insertMissingDevelopmentDocuments();
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error("Development legal-document setup failed:");
  console.error(error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});

// This server-only service finds an existing guardian by email, throttles
// repeated requests, and stores a short-lived verification token inside one
// transaction. Callers must never reveal whether a guardian was found.

import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import { guardians, guardianVerificationTokens } from "@/db/schema";
import { createGuardianVerificationToken } from "@/lib/guardian-verification-token";

const REQUEST_COOLDOWN_MILLISECONDS = 5 * 60 * 1_000;

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type GuardianVerificationRequestOutcome =
  | {
      status: "created";
      guardianName: string;
      guardianEmail: string;
      token: string;
      expiresAt: Date;
    }
  | {
      status: "not-created";
    };

type MatchedGuardian = {
  id: number;
  fullName: string;
  email: string;
};

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();

  if (
    email.length < 3 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new TypeError("The guardian email address is invalid.");
  }

  return email;
}

async function lockMatchingGuardian(
  transaction: DatabaseTransaction,
  email: string,
): Promise<MatchedGuardian | null> {
  const [guardian] = await transaction
    .select({
      id: guardians.id,
      fullName: guardians.fullName,
      email: guardians.email,
    })
    .from(guardians)
    .where(eq(guardians.email, email))
    .limit(1)
    .for("update");

  return guardian ?? null;
}

async function hasRecentUnusedToken(
  transaction: DatabaseTransaction,
  guardianId: number,
  now: Date,
): Promise<boolean> {
  const cooldownStartedAt = new Date(
    now.getTime() - REQUEST_COOLDOWN_MILLISECONDS,
  );
  const [recentToken] = await transaction
    .select({ id: guardianVerificationTokens.id })
    .from(guardianVerificationTokens)
    .where(
      and(
        eq(guardianVerificationTokens.guardianId, guardianId),
        isNull(guardianVerificationTokens.consumedAt),
        gt(guardianVerificationTokens.expiresAt, now),
        gt(guardianVerificationTokens.createdAt, cooldownStartedAt),
      ),
    )
    .limit(1);

  return recentToken !== undefined;
}

async function replaceGuardianTokens(
  transaction: DatabaseTransaction,
  guardianId: number,
  now: Date,
): Promise<{
  token: string;
  expiresAt: Date;
}> {
  // Verification tokens are not business records. Removing previous tokens
  // keeps the table small and immediately invalidates older emailed links.
  await transaction
    .delete(guardianVerificationTokens)
    .where(eq(guardianVerificationTokens.guardianId, guardianId));

  const createdToken = createGuardianVerificationToken(now);

  await transaction.insert(guardianVerificationTokens).values({
    guardianId,
    tokenHash: createdToken.tokenHash,
    expiresAt: createdToken.expiresAt,
  });

  return {
    token: createdToken.token,
    expiresAt: createdToken.expiresAt,
  };
}

export async function createGuardianVerificationRequest(
  guardianEmail: string,
): Promise<GuardianVerificationRequestOutcome> {
  const email = normalizeEmail(guardianEmail);
  const now = new Date();

  return db.transaction(async (transaction) => {
    const guardian = await lockMatchingGuardian(transaction, email);

    if (
      !guardian ||
      (await hasRecentUnusedToken(transaction, guardian.id, now))
    ) {
      return { status: "not-created" };
    }

    const createdToken = await replaceGuardianTokens(
      transaction,
      guardian.id,
      now,
    );

    return {
      status: "created",
      guardianName: guardian.fullName,
      guardianEmail: guardian.email,
      token: createdToken.token,
      expiresAt: createdToken.expiresAt,
    };
  });
}

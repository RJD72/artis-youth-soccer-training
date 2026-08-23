// This server-only service matches a returning player, throttles repeated
// requests, and stores a short-lived renewal token inside one transaction.
// Callers must never expose whether the result was created or suppressed.

import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import { guardians, players, renewalVerificationTokens } from "@/db/schema";
import { createRenewalVerificationToken } from "@/lib/renewal-verification-token";

const REQUEST_COOLDOWN_MILLISECONDS = 5 * 60 * 1_000;

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type RenewalVerificationIdentity = {
  guardianEmail: string;
  playerFullName: string;
  dateOfBirth: string;
};

export type RenewalVerificationRequestOutcome =
  | {
      status: "created";
      guardianName: string;
      guardianEmail: string;
      playerName: string;
      token: string;
      expiresAt: Date;
    }
  | {
      status: "not-created";
    };

type NormalizedRenewalIdentity = {
  guardianEmail: string;
  playerFullName: string;
  dateOfBirth: string;
};

type MatchedFamily = {
  playerId: number;
  playerName: string;
  guardianName: string;
  guardianEmail: string;
};

function normalizeSingleLine(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isValidEmail(value: string): boolean {
  return (
    value.length >= 3 &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function isValidPastDate(value: string, now: Date): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  return date.getTime() < todayUtc;
}

function normalizeIdentity(
  identity: RenewalVerificationIdentity,
  now: Date,
): NormalizedRenewalIdentity {
  const guardianEmail = identity.guardianEmail.trim().toLowerCase();
  const playerFullName = normalizeSingleLine(identity.playerFullName);
  const dateOfBirth = identity.dateOfBirth.trim();

  if (
    !isValidEmail(guardianEmail) ||
    playerFullName.length < 2 ||
    playerFullName.length > 100 ||
    !isValidPastDate(dateOfBirth, now)
  ) {
    throw new TypeError("The renewal identity is invalid.");
  }

  return {
    guardianEmail,
    playerFullName,
    dateOfBirth,
  };
}

async function lockMatchingFamily(
  transaction: DatabaseTransaction,
  identity: NormalizedRenewalIdentity,
): Promise<MatchedFamily | null> {
  const [family] = await transaction
    .select({
      playerId: players.id,
      playerName: players.fullName,
      guardianName: guardians.fullName,
      guardianEmail: guardians.email,
    })
    .from(players)
    .innerJoin(guardians, eq(players.guardianId, guardians.id))
    .where(
      and(
        eq(guardians.email, identity.guardianEmail),
        eq(players.fullName, identity.playerFullName),
        eq(players.dateOfBirth, identity.dateOfBirth),
      ),
    )
    .limit(1)
    .for("update");

  return family ?? null;
}

async function hasRecentUnusedToken(
  transaction: DatabaseTransaction,
  playerId: number,
  now: Date,
): Promise<boolean> {
  const cooldownStartedAt = new Date(
    now.getTime() - REQUEST_COOLDOWN_MILLISECONDS,
  );
  const [recentToken] = await transaction
    .select({ id: renewalVerificationTokens.id })
    .from(renewalVerificationTokens)
    .where(
      and(
        eq(renewalVerificationTokens.playerId, playerId),
        isNull(renewalVerificationTokens.consumedAt),
        gt(renewalVerificationTokens.expiresAt, now),
        gt(renewalVerificationTokens.createdAt, cooldownStartedAt),
      ),
    )
    .limit(1);

  return recentToken !== undefined;
}

async function replacePlayerTokens(
  transaction: DatabaseTransaction,
  playerId: number,
  now: Date,
): Promise<{
  token: string;
  expiresAt: Date;
}> {
  // Renewal tokens are not business-history records. Removing previous tokens
  // keeps the table small and immediately invalidates older emailed links.
  await transaction
    .delete(renewalVerificationTokens)
    .where(eq(renewalVerificationTokens.playerId, playerId));

  const createdToken = createRenewalVerificationToken(now);

  await transaction.insert(renewalVerificationTokens).values({
    playerId,
    tokenHash: createdToken.tokenHash,
    expiresAt: createdToken.expiresAt,
  });

  return {
    token: createdToken.token,
    expiresAt: createdToken.expiresAt,
  };
}

export async function createRenewalVerificationRequest(
  identity: RenewalVerificationIdentity,
): Promise<RenewalVerificationRequestOutcome> {
  const now = new Date();
  const normalizedIdentity = normalizeIdentity(identity, now);

  return db.transaction(async (transaction) => {
    const family = await lockMatchingFamily(transaction, normalizedIdentity);

    if (
      !family ||
      (await hasRecentUnusedToken(transaction, family.playerId, now))
    ) {
      return { status: "not-created" };
    }

    const createdToken = await replacePlayerTokens(
      transaction,
      family.playerId,
      now,
    );

    return {
      status: "created",
      guardianName: family.guardianName,
      guardianEmail: family.guardianEmail,
      playerName: family.playerName,
      token: createdToken.token,
      expiresAt: createdToken.expiresAt,
    };
  });
}

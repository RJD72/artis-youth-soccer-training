// This read-only lookup matches a returning player by guardian email, name,
// and date of birth. It returns only the matching player's database ID.

import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { guardians, players } from "@/db/schema";

export type RenewalPlayerIdentity = {
  guardianEmail: string;
  playerFullName: string;
  dateOfBirth: string;
};

export type RenewalPlayerLookupResult =
  | {
      status: "found";
      playerId: number;
    }
  | {
      status: "not-found";
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
  identity: RenewalPlayerIdentity,
  now: Date,
): RenewalPlayerIdentity {
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

export async function findRenewalPlayer(
  identity: RenewalPlayerIdentity,
  now: Date = new Date(),
): Promise<RenewalPlayerLookupResult> {
  const normalizedIdentity = normalizeIdentity(identity, now);

  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .innerJoin(guardians, eq(players.guardianId, guardians.id))
    .where(
      and(
        eq(guardians.email, normalizedIdentity.guardianEmail),
        eq(players.fullName, normalizedIdentity.playerFullName),
        eq(players.dateOfBirth, normalizedIdentity.dateOfBirth),
      ),
    )
    .limit(1);

  if (!player) {
    return { status: "not-found" };
  }

  return {
    status: "found",
    playerId: player.id,
  };
}

// This server-only service checks whether an emailed renewal token currently
// identifies a player. It deliberately performs no update: opening or
// refreshing the verification page must not consume a valid token.

import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import { players, renewalVerificationTokens } from "@/db/schema";
import { getRenewalVerificationTokenHash } from "@/lib/renewal-verification-token";

export type RenewalVerificationTokenResult =
  | {
      status: "valid";
      playerId: number;
      playerName: string;
      expiresAt: Date;
    }
  | {
      status: "invalid";
    };

export async function verifyRenewalVerificationToken(
  value: unknown,
  now: Date = new Date(),
): Promise<RenewalVerificationTokenResult> {
  const tokenHash = getRenewalVerificationTokenHash(value);

  if (tokenHash === null || Number.isNaN(now.getTime())) {
    return { status: "invalid" };
  }

  const [verification] = await db
    .select({
      playerId: players.id,
      playerName: players.fullName,
      expiresAt: renewalVerificationTokens.expiresAt,
    })
    .from(renewalVerificationTokens)
    .innerJoin(players, eq(renewalVerificationTokens.playerId, players.id))
    .where(
      and(
        eq(renewalVerificationTokens.tokenHash, tokenHash),
        isNull(renewalVerificationTokens.consumedAt),
        gt(renewalVerificationTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!verification) {
    // Malformed, unknown, expired and already-consumed tokens intentionally
    // share one result so callers do not disclose which condition occurred.
    return { status: "invalid" };
  }

  return {
    status: "valid",
    playerId: verification.playerId,
    playerName: verification.playerName,
    expiresAt: verification.expiresAt,
  };
}

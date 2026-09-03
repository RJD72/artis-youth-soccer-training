// This server-only service checks whether an emailed guardian token currently
// identifies an existing guardian. It deliberately performs no update: opening
// or refreshing the verification page must not consume a valid token.

import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import { guardians, guardianVerificationTokens } from "@/db/schema";
import { getGuardianVerificationTokenHash } from "@/lib/guardian-verification-token";

export type GuardianVerificationTokenResult =
  | {
      status: "valid";
      guardianId: number;
      expiresAt: Date;
    }
  | {
      status: "invalid";
    };

export async function verifyGuardianVerificationToken(
  value: unknown,
  now: Date = new Date(),
): Promise<GuardianVerificationTokenResult> {
  const tokenHash = getGuardianVerificationTokenHash(value);

  if (tokenHash === null || Number.isNaN(now.getTime())) {
    return { status: "invalid" };
  }

  const [verification] = await db
    .select({
      guardianId: guardians.id,
      expiresAt: guardianVerificationTokens.expiresAt,
    })
    .from(guardianVerificationTokens)
    .innerJoin(
      guardians,
      eq(guardianVerificationTokens.guardianId, guardians.id),
    )
    .where(
      and(
        eq(guardianVerificationTokens.tokenHash, tokenHash),
        isNull(guardianVerificationTokens.consumedAt),
        gt(guardianVerificationTokens.expiresAt, now),
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
    guardianId: verification.guardianId,
    expiresAt: verification.expiresAt,
  };
}

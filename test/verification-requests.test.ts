import { createHash } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { guardians, guardianVerificationTokens, players, renewalVerificationTokens } from "@/db/schema";
import { databaseHarness, NOW, sqlQuery } from "./database-harness";
const h = databaseHarness();
let guardianRequest: typeof import("@/lib/create-guardian-verification-request").createGuardianVerificationRequest;
let renewalRequest: typeof import("@/lib/create-renewal-verification-request").createRenewalVerificationRequest;
beforeAll(async () => { jest.doMock("@/db", () => ({ db: h.db })); ({ createGuardianVerificationRequest: guardianRequest } = await import("@/lib/create-guardian-verification-request")); ({ createRenewalVerificationRequest: renewalRequest } = await import("@/lib/create-renewal-verification-request")); });
beforeEach(() => { h.reset(); jest.useFakeTimers().setSystemTime(NOW); }); afterEach(() => { jest.useRealTimers(); });
describe.each(["guardian", "renewal"] as const)("%s verification request", kind => {
  const identityTable = kind === "guardian" ? guardians : players;
  const tokenTable = kind === "guardian" ? guardianVerificationTokens : renewalVerificationTokens;
  const call = (email = "  GUARDIAN@EXAMPLE.COM  ") => kind === "guardian" ? guardianRequest(email) : renewalRequest({ guardianEmail: email, playerFullName: "  Test   Player  ", dateOfBirth: "2015-06-15" });
  function matched() { h.read(identityTable, kind === "guardian" ? { id: 3, fullName: "Test Guardian", email: "guardian@example.com" } : { playerId: 4, playerName: "Test Player", guardianName: "Test Guardian", guardianEmail: "guardian@example.com" }); }
  it.each(["bad", "a@", "", "a\n@example.com", "x".repeat(255) + "@example.com"])("rejects malformed email", async email => { await expect(call(email)).rejects.toThrow(TypeError); expect(h.db.transaction).not.toHaveBeenCalled(); });
  it("suppresses absent identity without writes", async () => { h.read(identityTable); expect(await call()).toEqual({ status: "not-created" }); expect(h.writes()).toEqual([]); });
  it("suppresses recent unused tokens", async () => { matched(); h.read(tokenTable, { id: 7 }); expect(await call()).toEqual({ status: "not-created" }); const query = sqlQuery(h.queries(tokenTable)[0]); expect(query.sql).toContain("consumed_at"); expect(query.sql).toContain("created_at"); expect(h.writes()).toEqual([]); });
  it("normalizes identity, locks it, invalidates older tokens and stores only SHA-256", async () => {
    matched(); h.read(tokenTable); const result = await call(); expect(result.status).toBe("created"); if (result.status !== "created") throw new Error("Expected token");
    expect(result.guardianEmail).toBe("guardian@example.com"); expect(result.expiresAt).toEqual(new Date(NOW.getTime() + 1800000));
    expect(sqlQuery(h.queries(identityTable)[0]).params).toEqual(kind === "guardian" ? ["guardian@example.com"] : ["guardian@example.com", "Test Player", "2015-06-15"]);
    expect(h.queries(identityTable)[0].lock).toBe("update"); expect(h.writes().map(op => op.kind)).toEqual(["delete", "insert"]);
    expect(h.writes()[1].values).toMatchObject({ tokenHash: createHash("sha256").update(result.token).digest("hex"), expiresAt: result.expiresAt });
    expect(JSON.stringify(h.writes().map(op => op.values))).not.toContain(result.token);
  });
  it("propagates insert failure so invalidation rolls back", async () => { matched(); h.read(tokenTable); h.results.push({ affectedRows: 1 }, new Error("Synthetic insert failure")); await expect(call()).rejects.toThrow("Synthetic insert failure"); expect(h.committed).toEqual([]); expect(h.operations.at(-1)?.kind).toBe("rollback"); });
});
it.each(["2026-02-30", "2027-01-01", "2026-09-07", "bad"])("rejects invalid renewal date of birth %s", async dateOfBirth => { await expect(renewalRequest({ guardianEmail: "guardian@example.com", playerFullName: "Test Player", dateOfBirth })).rejects.toThrow("renewal identity"); expect(h.db.transaction).not.toHaveBeenCalled(); });

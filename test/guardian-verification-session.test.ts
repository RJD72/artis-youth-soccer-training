import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NOW, FUTURE } from "./database-harness";
const set = jest.fn(); const get = jest.fn<(key: string) => { value: string } | undefined>();
let session: typeof import("@/lib/guardian-verification-session");
beforeAll(async () => { jest.doMock("next/headers", () => ({ cookies: async () => ({ set, get }) })); session = await import("@/lib/guardian-verification-session"); });
beforeEach(() => { jest.clearAllMocks(); get.mockReturnValue(undefined); jest.useFakeTimers().setSystemTime(NOW); });
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
describe("guardian verification cookie", () => {
  it.each(["production", "test", "development"] as const)("sets HTTP-only scoped cookie in %s", async environment => {
    jest.replaceProperty(process, "env", { ...process.env, NODE_ENV: environment });
    await session.setGuardianVerificationSession("a".repeat(43), FUTURE);
    expect(set).toHaveBeenCalledWith({ name: "artis_guardian_verification_token", value: "a".repeat(43), expires: FUTURE, httpOnly: true, sameSite: "lax", secure: environment === "production", path: "/register", priority: "high" });
    await session.clearGuardianVerificationSession(); expect(set).toHaveBeenLastCalledWith(expect.objectContaining({ value: "", expires: new Date(0), path: "/register", httpOnly: true, secure: environment === "production" }));
  });
  it.each(["", "bad", "a".repeat(44)])("rejects malformed tokens", async token => { await expect(session.setGuardianVerificationSession(token, FUTURE)).rejects.toThrow(TypeError); expect(set).not.toHaveBeenCalled(); });
  it.each([NOW, new Date(0), new Date("invalid")])("rejects expired/invalid expiry", async expiry => { await expect(session.setGuardianVerificationSession("a".repeat(43), expiry)).rejects.toThrow(TypeError); expect(set).not.toHaveBeenCalled(); });
  it.each([undefined, "", "bad", "a".repeat(43)])("reads only syntactically valid cookies", async value => { get.mockReturnValue(value === undefined ? undefined : { value }); expect(await session.getGuardianVerificationSessionToken()).toBe(value?.length === 43 ? value : null); expect(get).toHaveBeenCalledWith("artis_guardian_verification_token"); });
});

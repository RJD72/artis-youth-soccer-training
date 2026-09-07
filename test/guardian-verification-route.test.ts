import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { FUTURE } from "./database-harness";
const verify = jest.fn<typeof import("@/lib/verify-guardian-verification-token").verifyGuardianVerificationToken>();
const setSession = jest.fn<(...args: unknown[]) => Promise<void>>(); const getToken = jest.fn<() => Promise<string | null>>();
let route: typeof import("@/app/register/verify-guardian/complete/route").GET;
let page: typeof import("@/app/register/verify-guardian/page").default;
const token = "a".repeat(43);
beforeAll(async () => { jest.doMock("@/lib/verify-guardian-verification-token", () => ({ verifyGuardianVerificationToken: verify })); jest.doMock("@/lib/guardian-verification-session", () => ({ setGuardianVerificationSession: setSession, getGuardianVerificationSessionToken: getToken })); ({ GET: route } = await import("@/app/register/verify-guardian/complete/route")); ({ default: page } = await import("@/app/register/verify-guardian/page")); });
beforeEach(() => { jest.clearAllMocks(); verify.mockReset().mockResolvedValue({ status: "valid", guardianId: 3, expiresAt: FUTURE }); setSession.mockReset().mockResolvedValue(); getToken.mockReset().mockResolvedValue(token); jest.spyOn(console, "error").mockImplementation(() => {}); }); afterEach(() => { jest.restoreAllMocks(); });
describe("guardian verification completion", () => {
  it("sets a verified session and redirects to a token-free URL", async () => { const response = await route(new NextRequest(`https://academy.example/register/verify-guardian/complete?token=${token}&extra=private`)); expect(response.status).toBe(303); expect(response.headers.get("location")).toBe("https://academy.example/register/verify-guardian?verified=true"); expect(setSession).toHaveBeenCalledWith(token, FUTURE); });
  it("redirects invalid tokens without setting cookies", async () => { verify.mockResolvedValue({ status: "invalid" }); const response = await route(new NextRequest("https://academy.example/register/verify-guardian/complete?token=bad")); expect(response.headers.get("location")).toBe("https://academy.example/register/verify-guardian"); expect(setSession).not.toHaveBeenCalled(); });
  it("does not set cookies when no token was supplied", async () => { const response = await route(new NextRequest("https://academy.example/register/verify-guardian/complete")); expect(response.status).toBe(303); expect(setSession).not.toHaveBeenCalled(); });
  it("sanitizes verification failures", async () => { verify.mockRejectedValue(new Error(`private ${token}`)); const response = await route(new NextRequest(`https://academy.example/register/verify-guardian/complete?token=${token}`)); expect(response.headers.get("location")).not.toContain(token); expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain(token); });
  it("renders success only after rechecking the session token", async () => { const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ verified: "true" }) })); expect(html).toContain("Your email has been verified."); expect(html).toContain("original"); expect(html).not.toContain(token); expect(verify).toHaveBeenCalledWith(token); });
  it("does not trust a verified=true URL without valid session verification", async () => { verify.mockResolvedValue({ status: "invalid" }); const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({ verified: "true" }) })); expect(html).toContain("no longer valid"); expect(html).toContain('href="/register"'); expect(html).not.toContain("Your email has been verified."); });
});

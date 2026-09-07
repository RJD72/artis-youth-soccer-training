import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
const getSession = jest.fn<(...args: unknown[]) => Promise<unknown>>(); const requestHeaders = new Headers({ "x-test": "synthetic" });
const redirect = jest.fn((url: string): never => { throw new Error(`redirect:${url}`); });
let auth: typeof import("@/lib/admin-auth");
beforeAll(async () => { jest.doMock("@/lib/auth", () => ({ auth: { api: { getSession } } })); jest.doMock("next/headers", () => ({ headers: async () => requestHeaders })); jest.doMock("next/navigation", () => ({ redirect })); auth = await import("@/lib/admin-auth"); });
beforeEach(() => { jest.clearAllMocks(); getSession.mockResolvedValue(null); jest.replaceProperty(process, "env", { ...process.env, ADMIN_EMAIL_ALLOWLIST: " ADMIN@EXAMPLE.COM , other@example.com " }); }); afterEach(() => { jest.restoreAllMocks(); });
describe("admin session allowlist", () => {
  it.each([null, { user: { email: "outsider@example.com" } }])("rejects absent/disallowed sessions", async session => { getSession.mockResolvedValue(session); expect(await auth.getAdminSession()).toBeNull(); await expect(auth.requireAdminSession()).rejects.toThrow("redirect:/admin/login"); });
  it("normalizes allowlist and session addresses", async () => { const session = { user: { email: " Admin@Example.com " } }; getSession.mockResolvedValue(session); expect(await auth.requireAdminSession()).toBe(session); expect(getSession).toHaveBeenCalledWith({ headers: requestHeaders }); expect(redirect).not.toHaveBeenCalled(); });
  it("fails closed for missing allowlist", async () => { delete process.env.ADMIN_EMAIL_ALLOWLIST; getSession.mockResolvedValue({ user: { email: "admin@example.com" } }); expect(await auth.getAdminSession()).toBeNull(); });
  it("propagates provider errors", async () => { getSession.mockRejectedValue(new Error("Synthetic auth failure")); await expect(auth.getAdminSession()).rejects.toThrow("Synthetic auth failure"); });
});

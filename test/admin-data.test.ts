import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { registrations, waitlistEntries, trainingGroups } from "@/db/schema";
import { databaseHarness, NOW, sqlQuery } from "./database-harness";
const h = databaseHarness();
const admin = jest.fn<() => Promise<unknown>>();
const sync = jest.fn<() => Promise<void>>();
const revalidate = jest.fn();
let registrationQuery: typeof import("@/lib/admin-registrations").getAdminRegistrations;
let waitlistQuery: typeof import("@/lib/admin-waitlist").getAdminWaitlist;
let waitlistAction: typeof import("@/app/admin/waitlist/actions").updateWaitlistEntryStatus;
let groupAction: typeof import("@/app/admin/actions").updateTrainingGroupRegistrationStatus;
beforeAll(async () => {
  jest.doMock("@/db", () => ({ db: h.db }));
  jest.doMock("@/lib/admin-auth", () => ({ requireAdminSession: admin }));
  jest.doMock("@/lib/synchronize-registration-statuses", () => ({
    synchronizeRegistrationStatuses: sync,
  }));
  jest.doMock("next/cache", () => ({ revalidatePath: revalidate }));
  ({ getAdminRegistrations: registrationQuery } =
    await import("@/lib/admin-registrations"));
  ({ getAdminWaitlist: waitlistQuery } = await import("@/lib/admin-waitlist"));
  ({ updateWaitlistEntryStatus: waitlistAction } =
    await import("@/app/admin/waitlist/actions"));
  ({ updateTrainingGroupRegistrationStatus: groupAction } =
    await import("@/app/admin/actions"));
});
beforeEach(() => {
  h.reset();
  admin.mockResolvedValue({});
  sync.mockResolvedValue();
  jest.useFakeTimers().setSystemTime(NOW);
});
afterEach(() => {
  jest.useRealTimers();
});
describe.each(["registrations", "waitlist"] as const)(
  "protected %s data",
  (kind) => {
    const table = kind === "registrations" ? registrations : waitlistEntries;
    const query = (
      input: { status?: string; search?: string; page?: number | string } = {},
    ) =>
      kind === "registrations"
        ? registrationQuery(input)
        : waitlistQuery(input);
    it("authenticates before synchronization or reading", async () => {
      admin.mockRejectedValue(new Error("Unauthorized"));
      await expect(query()).rejects.toThrow("Unauthorized");
      expect(sync).not.toHaveBeenCalled();
      expect(h.db.select).not.toHaveBeenCalled();
    });
    it("normalizes invalid filters and pages to safe defaults", async () => {
      h.read(table, { value: 0 });
      h.read(table);
      const result = await query({
        status: "garbage",
        search: "  Test  ",
        page: -1,
      });
      expect(result.filters).toEqual({
        status: kind === "registrations" ? "current" : "active",
        search: "Test",
      });
      expect(result.pagination).toMatchObject({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        pageSize: 25,
      });
      const params = sqlQuery(h.queries(table)[0]).params;
      expect(params).not.toContain("cancelled");
      expect(params).not.toContain("expired");
    });
    it("escapes wildcard characters and keeps SQL injection text in bound parameters", async () => {
      h.read(table, { value: 26 });
      h.read(table);
      const search = "x%_\\' OR 1=1 --";
      await query({ search, page: 99 });
      const sql = sqlQuery(h.queries(table)[0]);
      expect(sql.sql).not.toContain("OR 1=1 --");
      expect(sql.params).toContain("%x\\%\\_\\\\' OR 1=1 --%");
      expect(h.queries(table)[1]).toMatchObject({ limit: 25, offset: 25 });
    });
    it("limits search length and binds normalized phone digits", async () => {
      h.read(table, { value: 1 });
      h.read(table);
      const result = await query({ search: "519-555-0123" + "x".repeat(150) });
      expect(result.filters.search).toHaveLength(100);
      expect(sqlQuery(h.queries(table)[0]).params).toContain("%5195550123%");
    });
    it.each(
      kind === "registrations"
        ? [
            "all",
            "active",
            "scheduled",
            "pending_payment",
            "expired",
            "cancelled",
            "waitlisted",
          ]
        : ["all", "waiting", "contacted", "converted", "cancelled"],
    )("applies explicit status %s", async (status) => {
      h.read(table, { value: 0 });
      h.read(table);
      expect((await query({ status })).filters.status).toBe(status);
      if (status === "all") expect(h.queries(table)[0].where).toBeUndefined();
      else expect(sqlQuery(h.queries(table)[0]).params).toContain(status);
    });
    it("propagates read failures", async () => {
      h.reads.push({ table, error: new Error("Synthetic read failure") });
      await expect(query()).rejects.toThrow("Synthetic read failure");
    });
  },
);
it("maps expired pending reservations to expired without exposing medical/provider fields", async () => {
  h.read(registrations, { value: 1 });
  h.read(registrations, {
    id: 1,
    status: "pending_payment",
    reservationExpiresAt: NOW,
  });
  const result = await registrationQuery();
  expect(result.registrations[0].status).toBe("expired");
  const fields = h.queries(registrations)[1].fields as object;
  expect(Object.keys(fields)).not.toEqual(
    expect.arrayContaining([
      "medicalInformationEncrypted",
      "stripePaymentIntentId",
    ]),
  );
});
describe.each(["waitlist", "group"] as const)("protected %s action", (kind) => {
  const table = kind === "waitlist" ? waitlistEntries : trainingGroups;
  const call = (
    id = "1",
    value = kind === "waitlist" ? "cancelled" : "false",
  ) => {
    const form = new FormData();
    form.set(kind === "waitlist" ? "waitlistEntryId" : "trainingGroupId", id);
    form.set(kind === "waitlist" ? "status" : "registrationOpen", value);
    return kind === "waitlist" ? waitlistAction(form) : groupAction(form);
  };
  it("authenticates before validating", async () => {
    admin.mockRejectedValue(new Error("Unauthorized"));
    await expect(call("bad")).rejects.toThrow("Unauthorized");
    expect(h.writes()).toEqual([]);
  });
  it.each(["0", "-1", "1.5", "bad"])("rejects invalid ID %s", async (id) => {
    await expect(call(id)).rejects.toThrow(TypeError);
    expect(h.writes()).toEqual([]);
  });
  it("rejects invalid state", async () => {
    const invalidValue = kind === "waitlist" ? "invalid" : "converted";

    await expect(call("1", invalidValue)).rejects.toThrow(TypeError);

    expect(h.writes()).toEqual([]);
  });
  it("updates only eligible rows and refreshes after success", async () => {
    await call();
    expect(h.writes(table)[0].values).toEqual(
      kind === "waitlist"
        ? { status: "cancelled" }
        : { registrationOpen: false },
    );
    expect(sqlQuery(h.writes(table)[0]).params).toEqual(
      kind === "waitlist" ? [1, "waiting", "contacted"] : [1],
    );
    expect(revalidate).toHaveBeenCalledWith(
      kind === "waitlist" ? "/admin/waitlist" : "/admin",
    );
  });
  it("detects missing or concurrently updated records", async () => {
    h.results.push({ affectedRows: 0 });
    await expect(call()).rejects.toThrow(/could not be updated/);
    expect(revalidate).not.toHaveBeenCalled();
  });
});

it("converts only contacted waitlist entries", async () => {
  const form = new FormData();

  form.set("waitlistEntryId", "1");
  form.set("status", "converted");

  await waitlistAction(form);

  expect(h.writes(waitlistEntries)[0].values).toEqual({
    status: "converted",
  });

  expect(sqlQuery(h.writes(waitlistEntries)[0]).params).toEqual([
    1,
    "contacted",
  ]);

  expect(revalidate).toHaveBeenCalledWith("/admin/waitlist");
});

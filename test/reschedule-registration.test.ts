import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { registrations, trainingGroups, players, programPackages } from "@/db/schema";
import { databaseHarness, NOW, sqlQuery } from "./database-harness";
import { group } from "./registration-fixtures";
const h = databaseHarness(); const admin = jest.fn<() => Promise<unknown>>();
let reschedule: typeof import("@/lib/reschedule-registration").rescheduleRegistration;
const registration = { id: 1, playerId: 4, trainingGroupId: 1, programPackageId: 2, status: "scheduled", startsOn: "2026-10-01", endsOn: "2026-12-31" };
beforeAll(async () => { jest.doMock("@/db", () => ({ db: h.db })); jest.doMock("@/lib/admin-auth", () => ({ requireAdminSession: admin })); ({ rescheduleRegistration: reschedule } = await import("@/lib/reschedule-registration")); });
beforeEach(() => { h.reset(); admin.mockResolvedValue({}); });
function initial() { h.read(registrations, registration); h.read(trainingGroups, group); h.read(programPackages, { durationMonths: 3 }); h.read(players, { dateOfBirth: "2015-06-15" }); }
describe("reschedule registration", () => {
  it("authenticates first", async () => { admin.mockRejectedValue(new Error("Unauthorized")); await expect(reschedule(0, "bad", NOW)).rejects.toThrow("Unauthorized"); expect(h.db.transaction).not.toHaveBeenCalled(); });
  it.each([[0, "2026-10-01", "invalid-registration-id"], [1, "2026-10-02", "invalid-start-month"], [1, "2026-13-01", "invalid-start-month"], [1, "2026-08-01", "start-month-too-early"], [1, "2028-10-01", "start-month-too-late"]])("rejects invalid input %p / %p", async (id, date, code) => { expect(await reschedule(id, date, NOW)).toEqual({ status: "rejected", code }); expect(h.db.transaction).not.toHaveBeenCalled(); });
  it.each(["pending_payment", "active", "cancelled", "expired", "waitlisted"])("rejects %s state", async status => { h.read(registrations, { ...registration, status }); expect(await reschedule(1, "2026-11-01", NOW)).toMatchObject({ code: "registration-not-reschedulable" }); expect(h.writes()).toEqual([]); });
  it("returns unchanged without capacity queries or writes for same dates", async () => { initial(); expect(await reschedule(1, "2026-10-01", NOW)).toMatchObject({ status: "unchanged", startsOn: "2026-10-01", endsOn: "2026-12-31" }); expect(h.writes()).toEqual([]); expect(h.queries(registrations)).toHaveLength(1); });
  it.each([["2026-11-01", "2027-01-31", "scheduled"], ["2026-09-01", "2026-11-30", "active"]])("recalculates period from %s", async (startsOn, endsOn, status) => {
    initial(); h.read(registrations); h.read(registrations, { occupiedSpots: 1 });
    expect(await reschedule("1", startsOn, NOW)).toEqual({ status: "rescheduled", registrationStatus: status, startsOn, endsOn });
    expect(h.writes(registrations)[0].values).toEqual({ status, startsOn, endsOn, activatedAt: status === "active" ? NOW : null });
    expect(sqlQuery(h.writes(registrations)[0]).params).toEqual([1, "scheduled"]);
    expect(h.queries(trainingGroups)[0].lock).toBe("update");
  });
  it("rejects a conflicting registration before checking group occupancy", async () => { initial(); h.read(registrations, { id: 8 }); expect(await reschedule(1, "2026-11-01", NOW)).toMatchObject({ code: "player-period-conflict" }); expect(h.writes()).toEqual([]); });
  it("protects the final place using date-overlap and pending-reservation predicates", async () => { initial(); h.read(registrations); h.read(registrations, { occupiedSpots: 2 }); expect(await reschedule(1, "2026-11-01", NOW)).toMatchObject({ code: "training-group-full" }); const query = sqlQuery(h.queries(registrations)[2]); expect(query.params).toEqual(expect.arrayContaining(["2027-01-31", "2026-11-01", "pending_payment", "scheduled", "active"])); expect(h.writes()).toEqual([]); });
  it("checks age on the new start date", async () => { h.read(registrations, registration); h.read(trainingGroups, group); h.read(programPackages, { durationMonths: 3 }); h.read(players, { dateOfBirth: "2013-10-01" }); expect(await reschedule(1, "2026-11-01", NOW)).toMatchObject({ code: "age-mismatch" }); });
  it.each([0, 1, 2, 3])("rejects missing required row %i", async index => {
    initial(); h.reads.length = index + 1; h.reads[index].rows = [];
    expect(await reschedule(1, "2026-11-01", NOW)).toMatchObject({ code: ["registration-not-found", "training-group-unavailable", "program-package-unavailable", "registration-not-found"][index] }); expect(h.writes()).toEqual([]);
  });
  it("bubbles concurrent update failure for rollback", async () => { initial(); h.read(registrations); h.read(registrations, { occupiedSpots: 0 }); h.results.push({ affectedRows: 0 }); await expect(reschedule(1, "2026-11-01", NOW)).rejects.toThrow("could not be changed"); expect(h.committed).toEqual([]); });
  it("rejects invalid current date", async () => { await expect(reschedule(1, "2026-11-01", new Date("invalid"))).rejects.toThrow(TypeError); expect(h.db.transaction).not.toHaveBeenCalled(); });
});

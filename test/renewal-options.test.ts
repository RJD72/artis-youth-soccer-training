import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { players, programPackages, registrations } from "@/db/schema";
import { databaseHarness, NOW, sqlQuery } from "./database-harness";
import { program } from "./registration-fixtures";

const h = databaseHarness();
const sync = jest.fn<() => Promise<void>>();
let options: typeof import("@/lib/renewal-options").getRenewalOptionsForPlayer;
const player = { id: 4, fullName: "Test Player" };
const history = {
  trainingGroupId: 1,
  trainingGroupSlug: "development",
  trainingGroupName: "Development",
  minimumAge: 9,
  maximumAge: 12,
  capacity: 2,
  dateOfBirth: "2015-06-15",
};

beforeAll(async () => {
  jest.doMock("@/db", () => ({ db: h.db }));
  jest.doMock("@/lib/synchronize-registration-statuses", () => ({
    synchronizeRegistrationStatuses: sync,
  }));
  ({ getRenewalOptionsForPlayer: options } =
    await import("@/lib/renewal-options"));
});

beforeEach(() => {
  h.reset();
  sync.mockResolvedValue();
});

function initial(paidThrough = "2026-09-30") {
  h.read(players, player);
  h.read(registrations);
  h.read(registrations);
  h.read(registrations, history);
  h.read(registrations, { endsOn: paidThrough });
  h.read(programPackages, {
    ...program,
    displayName: "Three months",
    slug: "three-months",
  });
}

describe("renewal options", () => {
  it.each([0, -1, Number.NaN, 4_294_967_296])(
    "rejects invalid player ID %p before querying",
    async (playerId) => {
      expect(await options(playerId, NOW)).toEqual({ status: "invalid-token" });
      expect(h.db.select).not.toHaveBeenCalled();
      expect(sync).not.toHaveBeenCalled();
    },
  );

  it("rejects a missing player before loading renewal data", async () => {
    h.read(players);
    expect(await options(4, NOW)).toEqual({ status: "invalid-token" });
    expect(sync).not.toHaveBeenCalled();
  });

  it.each([
    [1, { reservationExpiresAt: new Date("2026-09-08T12:00:00.000Z") }, "payment-pending"],
    [2, { endsOn: "2026-12-31" }, "upcoming-registration"],
  ] as const)(
    "blocks pending or future registration",
    async (index, row, reason) => {
      initial();
      h.reads[index].rows = [row];
      expect(await options(4, NOW)).toMatchObject({ status: "blocked", reason });
      expect(h.writes()).toEqual([]);
    },
  );

  it.each([
    [3, "registration-history-unavailable"],
    [5, "packages-unavailable"],
  ] as const)("blocks absent history/packages", async (index, reason) => {
    initial();
    h.reads[index].rows = [];
    expect(await options(4, NOW)).toMatchObject({ status: "blocked", reason });
  });

  it.each([
    ["2026-08-31", "2026-10-01"],
    ["2026-11-15", "2026-11-16"],
  ])(
    "uses paid-through %s for renewal start",
    async (paidThrough, renewsOn) => {
      initial(paidThrough);
      h.read(registrations, { occupiedSpots: 1 });
      expect(await options(4, NOW)).toMatchObject({
        status: "ready",
        renewsOn,
        trainingGroup: { id: 1 },
        programPackages: [expect.objectContaining({ id: 2 })],
      });
      expect(h.writes()).toEqual([]);
    },
  );

  it("does not advertise packages to a player who has aged out", async () => {
    initial();
    h.reads[3].rows = [{ ...history, dateOfBirth: "2013-01-01" }];
    expect(await options(4, NOW)).toMatchObject({
      status: "blocked",
      reason: "packages-unavailable",
    });
  });

  it("offers only packages with capacity throughout their own period", async () => {
    initial();
    h.reads[5].rows = [
      { ...program, id: 2, durationMonths: 1 },
      { ...program, id: 3, durationMonths: 3 },
    ];
    h.read(registrations, { occupiedSpots: 1 });
    h.read(registrations, { occupiedSpots: 2 });
    const result = await options(4, NOW);
    expect(result).toMatchObject({
      status: "ready",
      programPackages: [expect.objectContaining({ id: 2 })],
    });
    if (result.status === "ready") {
      expect(result.programPackages).toHaveLength(1);
    }
  });

  it("requires paid history consistent with the final transaction", async () => {
    initial();
    h.read(registrations, { occupiedSpots: 0 });
    await options(4, NOW);
    const query = sqlQuery(h.queries(registrations)[2]);
    expect(query.params).toContain("succeeded");
    expect(query.params).not.toContain("pending_payment");
    expect(sync.mock.invocationCallOrder[0]).toBeLessThan(
      h.db.select.mock.invocationCallOrder[1],
    );
  });

  it("rejects malformed stored dates", async () => {
    initial("2026-02-30");
    await expect(options(4, NOW)).rejects.toThrow("stored registration date");
  });

  it("propagates database errors", async () => {
    initial();
    h.reads[1].error = new Error("Synthetic query failure");
    await expect(options(4, NOW)).rejects.toThrow("Synthetic query failure");
  });
});

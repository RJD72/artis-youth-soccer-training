import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import {
  programPackages,
  trainingGroups,
  waitlistEntries,
  weeklySchedules,
} from "@/db/schema";

import { databaseHarness, NOW, sqlQuery } from "./database-harness";

const h = databaseHarness();
const sync = jest.fn<(now: Date) => Promise<void>>();

let options: typeof import("@/lib/registration-options").getRegistrationOptions;
let summaries: typeof import("@/lib/admin-dashboard").getTrainingGroupCapacitySummaries;

beforeAll(async () => {
  jest.doMock("@/db", () => ({ db: h.db }));
  jest.doMock("@/lib/synchronize-registration-statuses", () => ({
    synchronizeRegistrationStatuses: sync,
  }));

  ({ getRegistrationOptions: options } =
    await import("@/lib/registration-options"));
  ({ getTrainingGroupCapacitySummaries: summaries } =
    await import("@/lib/admin-dashboard"));
});

beforeEach(() => {
  h.reset();
  sync.mockResolvedValue();
  jest.useFakeTimers().setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("registration options and capacity summaries", () => {
  it("returns selectable groups separately while preserving full and manually closed groups for display", async () => {
    h.read(
      trainingGroups,
      { id: 1, capacity: 10, registrationOpen: true, occupiedSpots: 8 },
      { id: 2, capacity: 5, registrationOpen: true, occupiedSpots: 5 },
      { id: 3, capacity: 5, registrationOpen: false, occupiedSpots: 1 },
    );

    h.read(
      weeklySchedules,
      { id: 7, trainingGroupId: 1 },
      { id: 8, trainingGroupId: 2 },
    );
    h.read(programPackages, { id: 2 }, { id: 1 });

    expect(await options()).toEqual({
      trainingGroups: [
        {
          id: 1,
          capacity: 10,
          registrationOpen: true,
          availableSpots: 2,
          weeklySchedule: [{ id: 7, trainingGroupId: 1 }],
        },
      ],
      trainingGroupAvailability: [
        {
          id: 1,
          capacity: 10,
          registrationOpen: true,
          availableSpots: 2,
          weeklySchedule: [{ id: 7, trainingGroupId: 1 }],
        },
        {
          id: 2,
          capacity: 5,
          registrationOpen: true,
          availableSpots: 0,
          weeklySchedule: [{ id: 8, trainingGroupId: 2 }],
        },
        {
          id: 3,
          capacity: 5,
          registrationOpen: false,
          availableSpots: 4,
          weeklySchedule: [],
        },
      ],
      programPackages: [{ id: 2 }, { id: 1 }],
    });

    expect(sync).toHaveBeenCalledWith(NOW);
    expect(sync.mock.invocationCallOrder[0]).toBeLessThan(
      h.db.select.mock.invocationCallOrder[0],
    );

    expect(h.queries(trainingGroups)[0].where).toBeUndefined();

    const join = sqlQuery({
      kind: "join",
      where: h.queries(trainingGroups)[0].joins![0],
    });

    expect(join.params).toEqual(
      expect.arrayContaining(["active", "scheduled", "pending_payment"]),
    );
    expect(join.sql).toContain("reservation_expires_at");

    expect(sqlQuery(h.queries(programPackages)[0]).params).toEqual([true]);
    expect(h.queries(programPackages)[0].order).toEqual([
      programPackages.displayOrder,
    ]);
    expect(sqlQuery(h.queries(weeklySchedules)[0]).params).toEqual([true]);
  });

  it("reports full/closed groups for admin with remaining places clamped to zero", async () => {
    h.read(trainingGroups, {
      id: 1,
      capacity: 2,
      occupiedSpots: 3,
      registrationOpen: false,
    });

    h.read(waitlistEntries);

    expect(await summaries()).toEqual([
      {
        id: 1,
        capacity: 2,
        occupiedSpots: 3,
        availableSpots: 0,
        registrationOpen: false,
        waitingFamilies: 0,
      },
    ]);

    expect(h.queries(trainingGroups)[0].where).toBeUndefined();
  });

  it("handles empty options", async () => {
    h.read(trainingGroups);
    h.read(weeklySchedules);
    h.read(programPackages);

    expect(await options()).toEqual({
      trainingGroups: [],
      trainingGroupAvailability: [],
      programPackages: [],
    });
  });

  it("propagates synchronization failure before reading", async () => {
    sync.mockRejectedValue(new Error("Synthetic sync failure"));

    await expect(options()).rejects.toThrow("Synthetic sync failure");
    expect(h.db.select).not.toHaveBeenCalled();
  });

  it("propagates database failure", async () => {
    h.reads.push({
      table: trainingGroups,
      error: new Error("Synthetic read failure"),
    });
    h.read(weeklySchedules);
    h.read(programPackages);

    await expect(options()).rejects.toThrow("Synthetic read failure");
  });
});

import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import { trainingGroups, waitlistEntries } from "@/db/schema";

import {
  databaseHarness,
  sqlQuery,
  sqlSelectedField,
} from "./database-harness";

const h = databaseHarness();

const synchronizeRegistrationStatuses = jest.fn(async () => ({
  activated: 0,
  expired: 0,
}));

let getTrainingGroupCapacitySummaries: typeof import("@/lib/admin-dashboard").getTrainingGroupCapacitySummaries;

beforeAll(async () => {
  jest.doMock("@/db", () => ({
    db: h.db,
  }));

  jest.doMock("@/lib/synchronize-registration-statuses", () => ({
    synchronizeRegistrationStatuses,
  }));

  ({ getTrainingGroupCapacitySummaries } =
    await import("@/lib/admin-dashboard"));
});

beforeEach(() => {
  h.reset();

  synchronizeRegistrationStatuses.mockResolvedValue({
    activated: 0,
    expired: 0,
  });
});

describe("admin dashboard capacity summaries", () => {
  it("counts each player once and includes waiting families", async () => {
    h.read(trainingGroups, {
      id: 1,
      displayName: "Ages 8–10",
      minimumAge: 8,
      maximumAge: 10,
      capacity: 30,
      registrationOpen: true,
      occupiedSpots: 28,
    });

    h.read(waitlistEntries, {
      trainingGroupId: 1,
      waitingFamilies: 3,
    });

    const result = await getTrainingGroupCapacitySummaries();

    expect(result).toEqual([
      {
        id: 1,
        displayName: "Ages 8–10",
        minimumAge: 8,
        maximumAge: 10,
        capacity: 30,
        registrationOpen: true,
        occupiedSpots: 28,
        availableSpots: 2,
        waitingFamilies: 3,
      },
    ]);
    expect(
      sqlSelectedField(
        h.queries(trainingGroups)[0],
        "occupiedSpots",
      ).sql,
    ).toBe("count(distinct `registrations`.`player_id`)");
    expect(
      sqlSelectedField(
        h.queries(waitlistEntries)[0],
        "waitingFamilies",
      ).sql,
    ).toBe("count(`waitlist_entries`.`id`)");
  });

  it("uses zero when a group has no waiting families", async () => {
    h.read(trainingGroups, {
      id: 1,
      displayName: "Ages 8–10",
      minimumAge: 8,
      maximumAge: 10,
      capacity: 30,
      registrationOpen: true,
      occupiedSpots: 20,
    });

    h.read(waitlistEntries);

    const result = await getTrainingGroupCapacitySummaries();

    expect(result[0].waitingFamilies).toBe(0);
    expect(result[0].availableSpots).toBe(10);
  });

  it("counts only waitlist entries with waiting status", async () => {
    h.read(trainingGroups);
    h.read(waitlistEntries);

    await getTrainingGroupCapacitySummaries();

    const waitlistQuery = h.queries(waitlistEntries)[0];

    expect(sqlQuery(waitlistQuery).params).toContain("waiting");
  });
});

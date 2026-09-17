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
  legalDocuments,
  legalAcceptances,
  payments,
  players,
  programPackages,
  registrations,
  trainingGroups,
} from "@/db/schema";
import { databaseHarness, NOW, sqlQuery } from "./database-harness";
import { group, program, legal } from "./registration-fixtures";
const h = databaseHarness();
const sync = jest.fn<() => Promise<void>>();
let create: typeof import("@/lib/create-pending-renewal").createPendingRenewalForPlayer;
const identity = {
  playerId: 4,
  playerName: "Test Player",
  dateOfBirth: "2015-06-15",
  guardianId: 3,
  guardianName: "Test Guardian",
};
const submission = {
  programPackageId: 2,
  paymentMethod: "stripe" as const,
  authorizedRegistrantConfirmed: true as const,
  informationAccuracyConfirmed: true as const,
  participationWaiverAccepted: true as const,
  gymRulesAccepted: true as const,
  cancellationPolicyAccepted: true as const,
  marketingConsent: false,
  photoVideoConsent: false,
};
beforeAll(async () => {
  jest.doMock("@/db", () => ({ db: h.db }));
  jest.doMock("@/lib/synchronize-registration-statuses", () => ({
    synchronizeRegistrationStatuses: sync,
  }));
  ({ createPendingRenewalForPlayer: create } =
    await import("@/lib/create-pending-renewal"));
});
beforeEach(() => {
  h.reset();
  sync.mockResolvedValue();
  jest.useFakeTimers().setSystemTime(NOW);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
function initial(paidThrough = "2026-09-30") {
  h.read(players, identity);
  h.read(registrations);
  h.read(registrations);
  h.read(registrations, { trainingGroupId: 1, guardianRelationship: "Parent" });
  h.read(trainingGroups, group);
  h.read(programPackages, program);
  h.read(registrations, { endsOn: paidThrough });
  h.read(legalDocuments, ...legal);
  h.read(registrations, { occupiedSpots: 1 });
}
describe("pending renewal", () => {
  it.each([0, -1, Number.NaN, 4_294_967_296])(
    "rejects invalid player ID %p without database calls",
    async (playerId) => {
      expect(await create(playerId, submission)).toEqual({
        status: "rejected",
        code: "invalid-token",
      });
      expect(sync).not.toHaveBeenCalled();
      expect(h.db.transaction).not.toHaveBeenCalled();
    },
  );
  it.each([
    { programPackageId: 0 },
    { paymentMethod: "cash" },
    { cancellationPolicyAccepted: false },
    { marketingConsent: "yes" },
  ])("rejects invalid submission %p", async (change) => {
    expect(
      await create(4, { ...submission, ...change } as typeof submission),
    ).toEqual({ status: "rejected", code: "invalid-submission" });
    expect(h.db.transaction).not.toHaveBeenCalled();
  });
  it("rejects a missing player through the locked identity lookup", async () => {
    h.read(players);
    expect(await create(4, submission)).toEqual({
      status: "rejected",
      code: "invalid-token",
    });
    expect(sqlQuery(h.queries(players)[0]).params).toContain(4);
    expect(h.queries(players)[0].lock).toBe("update");
  });
  it.each([
    [1, "payment-pending"],
    [2, "upcoming-registration"],
  ] as const)(
    "blocks overlapping registration at read %i",
    async (index, code) => {
      initial();
      h.reads[index].rows = [{ id: 8 }];
      expect(await create(4, submission)).toEqual({
        status: "rejected",
        code,
      });
      expect(h.writes()).toEqual([]);
    },
  );
  it.each([
    [3, "registration-history-unavailable"],
    [4, "invalid-selection"],
    [5, "invalid-selection"],
    [7, "legal-documents-unavailable"],
  ] as const)(
    "rejects missing required data at read %i",
    async (index, code) => {
      initial();
      h.reads[index].rows = [];
      expect(await create(4, submission)).toEqual({
        status: "rejected",
        code,
      });
      expect(h.writes()).toEqual([]);
    },
  );
  it("rejects age mismatch at renewal date", async () => {
    initial();
    h.reads[0].rows = [{ ...identity, dateOfBirth: "2013-01-01" }];
    expect(await create(4, submission)).toMatchObject({
      code: "age-mismatch",
    });
  });
  it("rejects full group and counts other players with overlapping reserved periods", async () => {
    initial();
    h.reads[8].rows = [{ occupiedSpots: 2 }];
    expect(await create(4, submission)).toMatchObject({
      code: "group-full",
    });
    const query = sqlQuery(h.queries(registrations).at(-1)!);
    expect(query.params).toEqual(
      expect.arrayContaining([
        4,
        1,
        "2026-10-01",
        "2026-12-31",
        "pending_payment",
        "scheduled",
        "active",
      ]),
    );
    expect(h.writes()).toEqual([]);
  });
  it.each(["stripe", "e_transfer"] as const)(
    "saves trusted %s amounts, relationships and dates",
    async (paymentMethod) => {
      initial();
      h.results.push({ insertId: 5 }, { insertId: 6 }, { insertId: 7 });
      expect(await create(4, { ...submission, paymentMethod })).toEqual({
        status: "created",
        registrationId: 5,
        paymentId: 7,
        paymentMethod,
        manualPaymentReference:
          paymentMethod === "e_transfer" ? "ARTIS-7" : null,
        trainingGroupSlug: "development",
        startsOn: "2026-10-01",
        endsOn: "2026-12-31",
        subtotalCents: 10000,
        taxCents: 1300,
        totalCents: 11300,
        currency: "CAD",
      });
      expect(sync.mock.invocationCallOrder[0]).toBeLessThan(
        h.db.transaction.mock.invocationCallOrder[0],
      );
      expect(
        h
          .writes()
          .slice(0, 3)
          .map((op) => op.table),
      ).toEqual([registrations, legalAcceptances, payments]);
      expect(h.writes(registrations)[0].values).toMatchObject({
        playerId: 4,
        guardianRelationship: "Parent",
        reservationExpiresAt: new Date(
          NOW.getTime() + (paymentMethod === "stripe" ? 3600000 : 86400000),
        ),
      });
      expect(h.queries(trainingGroups)[0].lock).toBe("update");
    },
  );
  it("allows a returning player when new-family registration is closed", async () => {
    initial();
    h.reads[4].rows = [{ ...group, registrationOpen: false }];
    expect(await create(4, submission)).toMatchObject({
      status: "created",
    });
  });
  it.each([
    ["2026-08-31", "2026-10-01", "2026-12-31"],
    ["2026-11-15", "2026-11-16", "2027-01-31"],
    ["2026-12-31", "2027-01-01", "2027-03-31"],
  ])(
    "preserves admin-adjusted paid-through date %s",
    async (paidThrough, startsOn, endsOn) => {
      initial(paidThrough);
      expect(await create(4, submission)).toMatchObject({
        status: "created",
        startsOn,
        endsOn,
      });
    },
  );
  it("rejects corrupt stored calendar dates", async () => {
    initial("2026-02-30");
    await expect(create(4, submission)).rejects.toThrow(
      "stored registration date",
    );
    expect(h.committed).toEqual([]);
  });
  it.each([0, 2])(
    "rolls back failed insert %i",
    async (index) => {
      initial();
      h.results.push(
        ...Array.from({ length: index }, () => ({
          insertId: 1,
          affectedRows: 1,
        })),
        { insertId: 0, affectedRows: 0 },
      );
      await expect(create(4, submission)).rejects.toThrow(/could not be/);
      expect(h.committed).toEqual([]);
      expect(h.operations.at(-1)?.kind).toBe("rollback");
    },
  );
  it("propagates synchronization failure before the transaction", async () => {
    sync.mockRejectedValue(new Error("Synthetic synchronization failure"));
    await expect(create(4, submission)).rejects.toThrow(
      "Synthetic synchronization failure",
    );
    expect(h.db.transaction).not.toHaveBeenCalled();
  });
});

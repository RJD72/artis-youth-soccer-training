import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import type { RegistrationStatusSynchronizationOutcome } from "@/lib/synchronize-registration-statuses";

type SynchronizeRegistrationStatusesFunction =
  (typeof import("@/lib/synchronize-registration-statuses"))["synchronizeRegistrationStatuses"];

const mockedUpdateWhere =
  jest.fn<() => Promise<Array<{ affectedRows: number }>>>();
const mockedUpdateSet = jest.fn((values: unknown) => {
  void values;
  return { where: mockedUpdateWhere };
});
const mockedUpdate = jest.fn(() => ({ set: mockedUpdateSet }));
const databaseTransaction = { update: mockedUpdate };
const mockedDatabaseTransaction =
  jest.fn<
    (
      callback: (
        transaction: typeof databaseTransaction,
      ) => Promise<RegistrationStatusSynchronizationOutcome>,
    ) => Promise<RegistrationStatusSynchronizationOutcome>
  >();

let synchronizeRegistrationStatuses: SynchronizeRegistrationStatusesFunction;

beforeAll(async () => {
  jest.doMock("@/db", () => ({
    db: { transaction: mockedDatabaseTransaction },
  }));

  ({ synchronizeRegistrationStatuses } =
    await import("@/lib/synchronize-registration-statuses"));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedUpdateWhere
    .mockResolvedValueOnce([{ affectedRows: 3 }])
    .mockResolvedValueOnce([{ affectedRows: 2 }]);
  mockedDatabaseTransaction.mockImplementation(async (...values: unknown[]) => {
    const callback = values[0] as (
      transaction: typeof databaseTransaction,
    ) => Promise<RegistrationStatusSynchronizationOutcome>;

    return callback(databaseTransaction);
  });
});

describe("synchronizeRegistrationStatuses", () => {
  it("expires ended registrations before activating current registrations", async () => {
    const now = new Date("2026-09-07T12:00:00.000Z");

    await expect(synchronizeRegistrationStatuses(now)).resolves.toEqual({
      activated: 2,
      expired: 3,
    });
    expect(mockedDatabaseTransaction).toHaveBeenCalledTimes(1);
    expect(mockedUpdateSet.mock.calls).toEqual([
      [{ status: "expired" }],
      [{ status: "active", activatedAt: now }],
    ]);
    expect(mockedUpdateWhere).toHaveBeenCalledTimes(2);
    expect(mockedUpdateWhere.mock.invocationCallOrder[0]).toBeLessThan(
      mockedUpdateWhere.mock.invocationCallOrder[1],
    );
  });

  it("is safely repeatable when no rows need changing", async () => {
    mockedUpdateWhere.mockReset();
    mockedUpdateWhere.mockResolvedValue([{ affectedRows: 0 }]);

    await expect(synchronizeRegistrationStatuses()).resolves.toEqual({
      activated: 0,
      expired: 0,
    });
  });

  it("rejects an invalid synchronization date before opening a transaction", async () => {
    await expect(
      synchronizeRegistrationStatuses(new Date("invalid")),
    ).rejects.toThrow(
      "A valid registration synchronization date must be provided.",
    );
    expect(mockedDatabaseTransaction).not.toHaveBeenCalled();
  });

  it("does not attempt activation when expiration fails", async () => {
    mockedUpdateWhere.mockReset();
    mockedUpdateWhere.mockRejectedValueOnce(new Error("Database unavailable"));

    await expect(synchronizeRegistrationStatuses()).rejects.toThrow(
      "Database unavailable",
    );
    expect(mockedUpdateSet).toHaveBeenCalledTimes(1);
    expect(mockedUpdateSet).toHaveBeenCalledWith({ status: "expired" });
  });

  it("propagates a transaction failure", async () => {
    mockedDatabaseTransaction.mockRejectedValueOnce(
      new Error("Transaction unavailable"),
    );

    await expect(synchronizeRegistrationStatuses()).rejects.toThrow(
      "Transaction unavailable",
    );
    expect(mockedUpdate).not.toHaveBeenCalled();
  });
});

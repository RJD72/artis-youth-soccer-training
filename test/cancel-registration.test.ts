import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import type { RegistrationCancellationOutcome } from "@/lib/cancel-registration";

type CancelRegistrationFunction =
  (typeof import("@/lib/cancel-registration"))["cancelRegistration"];

type RegistrationStatus =
  | "pending_payment"
  | "scheduled"
  | "active"
  | "waitlisted"
  | "expired"
  | "cancelled";

type LockedRegistration = {
  id: number;
  status: RegistrationStatus;
};

let selectedRegistration: LockedRegistration | undefined;
let affectedRows = 1;

const mockedSelectForUpdate = jest.fn(async (lock: string) => {
  void lock;
  return selectedRegistration ? [selectedRegistration] : [];
});
const mockedSelectLimit = jest.fn(() => ({ for: mockedSelectForUpdate }));
const mockedSelectWhere = jest.fn(() => ({ limit: mockedSelectLimit }));
const mockedSelectFrom = jest.fn(() => ({ where: mockedSelectWhere }));
const mockedSelect = jest.fn(() => ({ from: mockedSelectFrom }));

const mockedUpdateWhere = jest.fn(async () => [{ affectedRows }]);
const mockedUpdateSet = jest.fn((values: unknown) => {
  void values;
  return { where: mockedUpdateWhere };
});
const mockedUpdate = jest.fn(() => ({ set: mockedUpdateSet }));

const databaseTransaction = {
  select: mockedSelect,
  update: mockedUpdate,
};

const mockedDatabaseTransaction = jest.fn();
const mockedRequireAdminSession = jest.fn<() => Promise<unknown>>();

let cancelRegistration: CancelRegistrationFunction;

beforeAll(async () => {
  jest.doMock("@/db", () => ({
    db: { transaction: mockedDatabaseTransaction },
  }));
  jest.doMock("@/lib/admin-auth", () => ({
    requireAdminSession: mockedRequireAdminSession,
  }));

  ({ cancelRegistration } = await import("@/lib/cancel-registration"));
});

beforeEach(() => {
  jest.clearAllMocks();
  selectedRegistration = { id: 17, status: "scheduled" };
  affectedRows = 1;
  mockedRequireAdminSession.mockResolvedValue({});
  mockedDatabaseTransaction.mockImplementation(async (...values: unknown[]) => {
    const callback = values[0] as (
      transaction: typeof databaseTransaction,
    ) => Promise<RegistrationCancellationOutcome>;

    return callback(databaseTransaction);
  });
});

describe("cancelRegistration", () => {
  it.each(["scheduled", "active"] as const)(
    "cancels a %s registration without changing its payment",
    async (status) => {
      const cancellationDate = new Date("2026-09-07T12:00:00.000Z");
      selectedRegistration = { id: 17, status };

      await expect(cancelRegistration(17, cancellationDate)).resolves.toEqual({
        status: "cancelled",
        previousStatus: status,
      });
      expect(mockedSelectForUpdate).toHaveBeenCalledWith("update");
      expect(mockedUpdateSet).toHaveBeenCalledWith({
        status: "cancelled",
        cancelledAt: cancellationDate,
      });
      expect(mockedUpdateWhere).toHaveBeenCalledTimes(1);
    },
  );

  it("accepts a numeric registration ID submitted as a string", async () => {
    await expect(cancelRegistration("17")).resolves.toEqual({
      status: "cancelled",
      previousStatus: "scheduled",
    });
  });

  it.each([
    null,
    undefined,
    "",
    "registration",
    0,
    -1,
    1.5,
    Number.NaN,
    4_294_967_296,
  ])("rejects the invalid registration ID %p", async (registrationId) => {
    await expect(cancelRegistration(registrationId)).resolves.toEqual({
      status: "rejected",
      code: "invalid-registration-id",
    });
    expect(mockedDatabaseTransaction).not.toHaveBeenCalled();
  });

  it("rejects a registration that does not exist", async () => {
    selectedRegistration = undefined;

    await expect(cancelRegistration(18)).resolves.toEqual({
      status: "rejected",
      code: "registration-not-found",
    });
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("treats an already-cancelled registration as an idempotent success", async () => {
    selectedRegistration = { id: 19, status: "cancelled" };

    await expect(cancelRegistration(19)).resolves.toEqual({
      status: "already-cancelled",
    });
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it.each(["pending_payment", "waitlisted", "expired"] as const)(
    "does not cancel a registration with status %s",
    async (status) => {
      selectedRegistration = { id: 20, status };

      await expect(cancelRegistration(20)).resolves.toEqual({
        status: "rejected",
        code: "registration-not-cancellable",
      });
      expect(mockedUpdate).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid cancellation date", async () => {
    await expect(cancelRegistration(17, new Date("invalid"))).rejects.toThrow(
      "A valid registration cancellation date is required.",
    );
    expect(mockedDatabaseTransaction).not.toHaveBeenCalled();
  });

  it("throws if a concurrent change prevents the update", async () => {
    affectedRows = 0;

    await expect(cancelRegistration(17)).rejects.toThrow(
      "The registration could not be cancelled.",
    );
  });

  it("requires an authenticated administrator before validating input", async () => {
    mockedRequireAdminSession.mockRejectedValue(new Error("Unauthorized"));

    await expect(cancelRegistration("not-an-id")).rejects.toThrow(
      "Unauthorized",
    );
    expect(mockedDatabaseTransaction).not.toHaveBeenCalled();
  });
});

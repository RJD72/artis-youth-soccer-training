import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import { payments, registrations } from "@/db/schema";
import type { RegistrationCancellationOutcome } from "@/lib/cancel-registration";

type CancelPendingETransferRegistrationFunction =
  (typeof import("@/lib/cancel-registration"))["cancelPendingETransferRegistration"];

type LockedPendingETransfer = {
  paymentId: number;
  registrationId: number;
  paymentStatus:
    | "pending"
    | "succeeded"
    | "failed"
    | "cancelled"
    | "partially_refunded"
    | "refunded";
  registrationStatus:
    | "pending_payment"
    | "scheduled"
    | "active"
    | "waitlisted"
    | "expired"
    | "cancelled";
};

let selectedPayment: LockedPendingETransfer | undefined;

let paymentAffectedRows = 1;
let registrationAffectedRows = 1;

const mockedSelectForUpdate = jest.fn(async (lock: string) => {
  void lock;

  return selectedPayment ? [selectedPayment] : [];
});

const mockedSelectLimit = jest.fn(() => ({
  for: mockedSelectForUpdate,
}));

const mockedSelectWhere = jest.fn(() => ({
  limit: mockedSelectLimit,
}));

const mockedSelectInnerJoin = jest.fn(() => ({
  where: mockedSelectWhere,
}));

const mockedSelectFrom = jest.fn(() => ({
  innerJoin: mockedSelectInnerJoin,
}));

const mockedSelect = jest.fn(() => ({
  from: mockedSelectFrom,
}));

const mockedPaymentUpdateWhere = jest.fn(async () => [
  { affectedRows: paymentAffectedRows },
]);

const mockedRegistrationUpdateWhere = jest.fn(async () => [
  { affectedRows: registrationAffectedRows },
]);

const mockedPaymentUpdateSet = jest.fn((values: unknown) => {
  void values;

  return {
    where: mockedPaymentUpdateWhere,
  };
});

const mockedRegistrationUpdateSet = jest.fn((values: unknown) => {
  void values;

  return {
    where: mockedRegistrationUpdateWhere,
  };
});

const mockedUpdate = jest.fn((table: unknown) => {
  if (table === payments) {
    return {
      set: mockedPaymentUpdateSet,
    };
  }

  if (table === registrations) {
    return {
      set: mockedRegistrationUpdateSet,
    };
  }

  throw new Error("Unexpected table update.");
});

const databaseTransaction = {
  select: mockedSelect,
  update: mockedUpdate,
};

const mockedDatabaseTransaction = jest.fn();
const mockedRequireAdminSession = jest.fn<() => Promise<unknown>>();

let cancelPendingETransferRegistration: CancelPendingETransferRegistrationFunction;

beforeAll(async () => {
  jest.doMock("@/db", () => ({
    db: {
      transaction: mockedDatabaseTransaction,
    },
  }));

  jest.doMock("@/lib/admin-auth", () => ({
    requireAdminSession: mockedRequireAdminSession,
  }));

  ({ cancelPendingETransferRegistration } =
    await import("@/lib/cancel-registration"));
});

beforeEach(() => {
  jest.clearAllMocks();

  selectedPayment = {
    paymentId: 31,
    registrationId: 17,
    paymentStatus: "pending",
    registrationStatus: "pending_payment",
  };

  paymentAffectedRows = 1;
  registrationAffectedRows = 1;

  mockedRequireAdminSession.mockResolvedValue({});

  mockedDatabaseTransaction.mockImplementation(async (...values: unknown[]) => {
    const callback = values[0] as (
      transaction: typeof databaseTransaction,
    ) => Promise<RegistrationCancellationOutcome>;

    return callback(databaseTransaction);
  });
});

describe("cancelPendingETransferRegistration", () => {
  it("cancels a pending e-transfer payment and its pending registration", async () => {
    const cancellationDate = new Date("2026-09-12T13:00:00.000Z");

    await expect(
      cancelPendingETransferRegistration(17, 31, cancellationDate),
    ).resolves.toEqual({
      status: "cancelled",
      previousStatus: "pending_payment",
    });

    expect(mockedSelectForUpdate).toHaveBeenCalledWith("update");

    expect(mockedPaymentUpdateSet).toHaveBeenCalledWith({
      status: "cancelled",
    });

    expect(mockedRegistrationUpdateSet).toHaveBeenCalledWith({
      status: "cancelled",
      cancelledAt: cancellationDate,
      reservationExpiresAt: null,
    });

    expect(mockedPaymentUpdateWhere).toHaveBeenCalledTimes(1);
    expect(mockedRegistrationUpdateWhere).toHaveBeenCalledTimes(1);
  });

  it("accepts registration and payment IDs submitted as strings", async () => {
    await expect(
      cancelPendingETransferRegistration("17", "31"),
    ).resolves.toEqual({
      status: "cancelled",
      previousStatus: "pending_payment",
    });
  });

  it.each([
    [null, 31],
    [undefined, 31],
    ["", 31],
    ["registration", 31],
    [0, 31],
    [-1, 31],
    [1.5, 31],
    [17, null],
    [17, undefined],
    [17, ""],
    [17, "payment"],
    [17, 0],
    [17, -1],
    [17, 1.5],
    [4_294_967_296, 31],
    [17, 4_294_967_296],
  ])(
    "rejects invalid identifiers registration=%p payment=%p",
    async (registrationId, paymentId) => {
      await expect(
        cancelPendingETransferRegistration(registrationId, paymentId),
      ).resolves.toEqual({
        status: "rejected",
        code: "invalid-registration-id",
      });

      expect(mockedDatabaseTransaction).not.toHaveBeenCalled();
    },
  );

  it("rejects an e-transfer payment that cannot be found", async () => {
    selectedPayment = undefined;

    await expect(cancelPendingETransferRegistration(17, 31)).resolves.toEqual({
      status: "rejected",
      code: "registration-not-found",
    });

    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("treats an already-cancelled registration as an idempotent success", async () => {
    selectedPayment = {
      paymentId: 31,
      registrationId: 17,
      paymentStatus: "cancelled",
      registrationStatus: "cancelled",
    };

    await expect(cancelPendingETransferRegistration(17, 31)).resolves.toEqual({
      status: "already-cancelled",
    });

    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it.each([
    {
      paymentStatus: "succeeded" as const,
      registrationStatus: "pending_payment" as const,
    },
    {
      paymentStatus: "cancelled" as const,
      registrationStatus: "pending_payment" as const,
    },
    {
      paymentStatus: "pending" as const,
      registrationStatus: "scheduled" as const,
    },
    {
      paymentStatus: "pending" as const,
      registrationStatus: "active" as const,
    },
    {
      paymentStatus: "pending" as const,
      registrationStatus: "expired" as const,
    },
  ])(
    "rejects a non-cancellable payment/registration state %#",
    async ({ paymentStatus, registrationStatus }) => {
      selectedPayment = {
        paymentId: 31,
        registrationId: 17,
        paymentStatus,
        registrationStatus,
      };

      await expect(cancelPendingETransferRegistration(17, 31)).resolves.toEqual(
        {
          status: "rejected",
          code: "registration-not-cancellable",
        },
      );

      expect(mockedUpdate).not.toHaveBeenCalled();
    },
  );

  it("throws if the pending payment cannot be updated", async () => {
    paymentAffectedRows = 0;

    await expect(cancelPendingETransferRegistration(17, 31)).rejects.toThrow(
      "The pending e-transfer payment could not be cancelled.",
    );

    expect(mockedRegistrationUpdateSet).not.toHaveBeenCalled();
  });

  it("throws if the pending registration cannot be updated", async () => {
    registrationAffectedRows = 0;

    await expect(cancelPendingETransferRegistration(17, 31)).rejects.toThrow(
      "The pending e-transfer registration could not be cancelled.",
    );
  });

  it("rejects an invalid cancellation date", async () => {
    await expect(
      cancelPendingETransferRegistration(17, 31, new Date("invalid")),
    ).rejects.toThrow("A valid registration cancellation date is required.");

    expect(mockedDatabaseTransaction).not.toHaveBeenCalled();
  });

  it("requires an authenticated administrator before validating identifiers", async () => {
    mockedRequireAdminSession.mockRejectedValue(new Error("Unauthorized"));

    await expect(
      cancelPendingETransferRegistration("bad-registration", "bad-payment"),
    ).rejects.toThrow("Unauthorized");

    expect(mockedDatabaseTransaction).not.toHaveBeenCalled();
  });
});

import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import { createGuardianVerificationToken } from "@/lib/guardian-verification-token";
import { createRenewalVerificationToken } from "@/lib/renewal-verification-token";

type VerifyGuardianTokenFunction =
  (typeof import("@/lib/verify-guardian-verification-token"))["verifyGuardianVerificationToken"];
type VerifyRenewalTokenFunction =
  (typeof import("@/lib/verify-renewal-verification-token"))["verifyRenewalVerificationToken"];

type VerificationRow = {
  guardianId?: number;
  playerId?: number;
  playerName?: string;
  expiresAt: Date;
};

let selectedVerification: VerificationRow | undefined;

const mockedSelectLimit = jest.fn(async (limit: number) => {
  void limit;
  return selectedVerification ? [selectedVerification] : [];
});
const mockedSelectWhere = jest.fn((condition: unknown) => {
  void condition;
  return { limit: mockedSelectLimit };
});
const mockedSelectInnerJoin = jest.fn((table: unknown, condition: unknown) => {
  void table;
  void condition;
  return { where: mockedSelectWhere };
});
const mockedSelectFrom = jest.fn((table: unknown) => {
  void table;
  return { innerJoin: mockedSelectInnerJoin };
});
const mockedSelect = jest.fn((fields: unknown) => {
  void fields;
  return { from: mockedSelectFrom };
});
const mockedUpdate = jest.fn();

let verifyGuardianVerificationToken: VerifyGuardianTokenFunction;
let verifyRenewalVerificationToken: VerifyRenewalTokenFunction;

beforeAll(async () => {
  jest.doMock("@/db", () => ({
    db: {
      select: mockedSelect,
      update: mockedUpdate,
    },
  }));

  ({ verifyGuardianVerificationToken } =
    await import("@/lib/verify-guardian-verification-token"));
  ({ verifyRenewalVerificationToken } =
    await import("@/lib/verify-renewal-verification-token"));
});

beforeEach(() => {
  jest.clearAllMocks();
  selectedVerification = undefined;
});

describe("verifyGuardianVerificationToken", () => {
  it("returns the guardian identity for a current unused token", async () => {
    const now = new Date("2026-09-07T12:00:00.000Z");
    const expiresAt = new Date("2026-09-07T12:30:00.000Z");
    const { token } = createGuardianVerificationToken(now);
    selectedVerification = { guardianId: 31, expiresAt };

    await expect(verifyGuardianVerificationToken(token, now)).resolves.toEqual({
      status: "valid",
      guardianId: 31,
      expiresAt,
    });
    expect(mockedSelectLimit).toHaveBeenCalledWith(1);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("returns the same result for an unknown, expired, or consumed token", async () => {
    const now = new Date("2026-09-07T12:00:00.000Z");
    const { token } = createGuardianVerificationToken(now);

    await expect(verifyGuardianVerificationToken(token, now)).resolves.toEqual({
      status: "invalid",
    });
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it.each([null, undefined, "", "not-a-token", "a".repeat(42)])(
    "rejects malformed input %p without querying the database",
    async (value) => {
      await expect(verifyGuardianVerificationToken(value)).resolves.toEqual({
        status: "invalid",
      });
      expect(mockedSelect).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid comparison date without querying the database", async () => {
    const { token } = createGuardianVerificationToken();

    await expect(
      verifyGuardianVerificationToken(token, new Date("invalid")),
    ).resolves.toEqual({ status: "invalid" });
    expect(mockedSelect).not.toHaveBeenCalled();
  });
});

describe("verifyRenewalVerificationToken", () => {
  it("returns the player identity for a current unused token", async () => {
    const now = new Date("2026-09-07T12:00:00.000Z");
    const expiresAt = new Date("2026-09-07T12:30:00.000Z");
    const { token } = createRenewalVerificationToken(now);
    selectedVerification = {
      playerId: 41,
      playerName: "Maya Singh",
      expiresAt,
    };

    await expect(verifyRenewalVerificationToken(token, now)).resolves.toEqual({
      status: "valid",
      playerId: 41,
      playerName: "Maya Singh",
      expiresAt,
    });
    expect(mockedSelectLimit).toHaveBeenCalledWith(1);
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it("returns the same result for an unknown, expired, or consumed token", async () => {
    const now = new Date("2026-09-07T12:00:00.000Z");
    const { token } = createRenewalVerificationToken(now);

    await expect(verifyRenewalVerificationToken(token, now)).resolves.toEqual({
      status: "invalid",
    });
    expect(mockedUpdate).not.toHaveBeenCalled();
  });

  it.each([null, undefined, "", "not-a-token", "a".repeat(44)])(
    "rejects malformed input %p without querying the database",
    async (value) => {
      await expect(verifyRenewalVerificationToken(value)).resolves.toEqual({
        status: "invalid",
      });
      expect(mockedSelect).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid comparison date without querying the database", async () => {
    const { token } = createRenewalVerificationToken();

    await expect(
      verifyRenewalVerificationToken(token, new Date("invalid")),
    ).resolves.toEqual({ status: "invalid" });
    expect(mockedSelect).not.toHaveBeenCalled();
  });

  it("propagates a database failure", async () => {
    const { token } = createRenewalVerificationToken();
    mockedSelectLimit.mockRejectedValueOnce(new Error("Database unavailable"));

    await expect(verifyRenewalVerificationToken(token)).rejects.toThrow(
      "Database unavailable",
    );
  });
});

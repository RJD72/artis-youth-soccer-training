import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { guardians, legalDocuments, legalAcceptances, payments, players, programPackages, registrations, trainingGroups } from "@/db/schema";
import { decryptRegistrationText } from "@/lib/registration-encryption";
import { databaseHarness, NOW, FUTURE, sqlQuery, sqlSelectedField } from "./database-harness";
import { group, program, guardian, legal, submission } from "./registration-fixtures";
const h = databaseHarness();
let create: typeof import("@/lib/create-pending-registration").createPendingRegistration;
beforeAll(async () => { jest.doMock("@/db", () => ({ db: h.db })); ({ createPendingRegistration: create } = await import("@/lib/create-pending-registration")); });
beforeEach(() => {
  h.reset(); jest.useFakeTimers().setSystemTime(NOW);
  jest.replaceProperty(process, "env", { ...process.env, REGISTRATION_DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
function initial() { h.read(trainingGroups, group); h.read(programPackages, program); h.read(legalDocuments, ...legal); }
function newFamily() { initial(); h.read(guardians); h.read(registrations, { occupiedSpots: 1 }); h.read(guardians, guardian); h.read(players); }
const historicalAttempt = {
  registrationId: 10,
  registrationStatus: "cancelled",
  trainingGroupId: group.id,
  startsOn: "2026-10-01",
  endsOn: "2026-12-31",
  reservationExpiresAt: new Date("2026-09-06T12:00:00.000Z"),
  packagePriceCents: 10000,
  registrationCurrency: "CAD",
  paymentId: 11,
  paymentStatus: "cancelled",
  paymentMethod: "stripe",
  manualPaymentReference: null,
  stripeCheckoutSessionId: null,
  subtotalCents: 10000,
  taxCents: 1300,
  totalCents: 11300,
  paymentCurrency: "CAD",
} as const;
function existingPlayerHistory(...rows: object[]) {
  initial();
  h.read(guardians, guardian);
  h.read(players, { id: 4 });
  h.read(registrations, ...rows);
}
function prepareFreshAttemptResults(cleanup = false) {
  h.read(registrations, { occupiedSpots: 0 });
  if (cleanup) h.results.push({ affectedRows: 1 }, { affectedRows: 1 });
  h.results.push({ insertId: 5 }, { insertId: 6 }, { insertId: 7 });
}
describe("create pending registration", () => {
  it.each([NOW, new Date("invalid")])("rejects non-future reservation expiry", async expiry => {
    await expect(create(submission(), expiry)).rejects.toThrow(TypeError); expect(h.db.transaction).not.toHaveBeenCalled();
  });
  it.each([[[], "invalid-selection"], [[{ ...group, registrationOpen: false }], "registration-closed"]] as const)("rejects missing/closed group", async (rows, code) => {
    h.read(trainingGroups, ...rows); expect(await create(submission(), FUTURE)).toMatchObject({ status: "rejected", code }); expect(h.writes()).toEqual([]);
  });
  it("rejects an unavailable package with an active-package SQL filter", async () => {
    h.read(trainingGroups, group); h.read(programPackages);
    expect(await create(submission(), FUTURE)).toMatchObject({ code: "invalid-selection" });
    expect(sqlQuery(h.queries(programPackages)[0]).params).toEqual([2, true]);
  });
  it("checks player age on the calculated start date", async () => {
    h.read(trainingGroups, group); h.read(programPackages, program);
    expect(await create({ ...submission(), dateOfBirth: "2022-01-01" }, FUTURE)).toMatchObject({ code: "age-mismatch" }); expect(h.writes()).toEqual([]);
  });
  it("requires each published legal document", async () => {
    h.read(trainingGroups, group); h.read(programPackages, program); h.read(legalDocuments, legal[0], legal[0], legal[2]);
    expect(await create(submission(), FUTURE)).toMatchObject({ code: "legal-documents-unavailable" }); expect(h.writes()).toEqual([]);
  });
  it.each([2, 3])("rejects full unique-player capacity including pending reservations: %i", async occupiedSpots => {
    initial(); h.read(guardians); h.read(registrations, { occupiedSpots });
    expect(await create(submission(), FUTURE)).toMatchObject({ code: "group-full" });
    const query = sqlQuery(h.queries(registrations)[0]);
    expect(query.params).toEqual(expect.arrayContaining([1, "scheduled", "active", "pending_payment"]));
    expect(query.params).not.toEqual(expect.arrayContaining(["expired", "cancelled"]));
    expect(query.sql).toContain("reservation_expires_at");
    expect(sqlSelectedField(h.queries(registrations)[0], "occupiedSpots").sql).toBe("count(distinct `registrations`.`player_id`)");
    expect(h.writes()).toEqual([]);
  });
  it("allows multiple children to reuse an existing guardian email", async () => {
    initial(); h.read(guardians, guardian); h.read(players); h.read(registrations, { occupiedSpots: 1 }); h.read(guardians, guardian); h.read(players);
    h.results.push({ insertId: 0 }, { insertId: 4 }, { insertId: 5 }, { insertId: 6 }, { insertId: 7 });
    expect(await create(submission(), FUTURE)).toMatchObject({ status: "created", registrationId: 5, paymentId: 7 });
    expect(h.operations.find(op => op.kind === "upsert")?.values).toEqual({ set: { email: "guardian@example.com" } });
    expect(h.writes(players)).toHaveLength(1);
    expect(h.writes(players)[0]).toMatchObject({ kind: "insert", values: { guardianId: guardian.id, fullName: "Test Player", dateOfBirth: "2015-06-15" } });
    expect(h.writes(registrations)[0].values).toMatchObject({ playerId: 4 });
    expect(h.operations.at(-1)?.kind).toBe("commit");
  });
  it.each(["scheduled", "active"] as const)("rejects a %s registration as already registered", async registrationStatus => {
    existingPlayerHistory({ ...historicalAttempt, registrationStatus, paymentStatus: "succeeded" });
    expect(await create(submission(), FUTURE)).toMatchObject({ status: "rejected", code: "already-registered" });
    expect(h.writes()).toEqual([]);
  });
  it("routes a player with successful payment history to renewal", async () => {
    existingPlayerHistory({ ...historicalAttempt, registrationStatus: "expired", paymentStatus: "succeeded" });
    expect(await create(submission(), FUTURE)).toMatchObject({ status: "rejected", code: "renewal-required" });
    expect(h.writes()).toEqual([]);
  });
  it("keeps successful payment history on the verified renewal path even with a newer pending attempt", async () => {
    existingPlayerHistory(
      { ...historicalAttempt, registrationId: 8, paymentId: 9, registrationStatus: "expired", paymentStatus: "succeeded" },
      { ...historicalAttempt, registrationStatus: "pending_payment", paymentStatus: "pending", reservationExpiresAt: FUTURE },
    );
    expect(await create(submission(), FUTURE)).toMatchObject({ status: "rejected", code: "renewal-required" });
    expect(h.writes()).toEqual([]);
  });
  it.each([
    ["stripe", null],
    ["e_transfer", "ARTIS-11"],
  ] as const)("resumes an active pending %s attempt with stored routing and pricing", async (paymentMethod, manualPaymentReference) => {
    existingPlayerHistory({ ...historicalAttempt, registrationStatus: "pending_payment", paymentStatus: "pending", paymentMethod, manualPaymentReference, reservationExpiresAt: FUTURE });
    expect(await create({ ...submission(), paymentMethod: paymentMethod === "stripe" ? "e_transfer" : "stripe" }, FUTURE)).toEqual({
      status: "resumed",
      registrationId: 10,
      paymentId: 11,
      paymentMethod,
      manualPaymentReference,
      trainingGroupSlug: "development",
      startsOn: "2026-10-01",
      endsOn: "2026-12-31",
      subtotalCents: 10000,
      taxCents: 1300,
      totalCents: 11300,
      currency: "CAD",
    });
    expect(h.writes()).toEqual([]);
  });
  it("blocks an active pending attempt in another training group", async () => {
    existingPlayerHistory({ ...historicalAttempt, registrationStatus: "pending_payment", paymentStatus: "pending", trainingGroupId: 99, reservationExpiresAt: FUTURE });
    expect(await create(submission(), FUTURE)).toMatchObject({ status: "rejected", code: "payment-pending" });
    expect(h.writes()).toEqual([]);
  });
  it("blocks an expired Stripe attempt that still has a Checkout Session", async () => {
    existingPlayerHistory({ ...historicalAttempt, registrationStatus: "pending_payment", paymentStatus: "pending", stripeCheckoutSessionId: "cs_existing" });
    expect(await create(submission(), FUTURE)).toMatchObject({ status: "rejected", code: "payment-pending" });
    expect(h.writes()).toEqual([]);
  });
  it.each(["cancelled", "failed"] as const)("creates a fresh attempt after a terminal %s Stripe payment", async paymentStatus => {
    existingPlayerHistory({ ...historicalAttempt, paymentStatus });
    prepareFreshAttemptResults();
    expect(await create(submission(), FUTURE)).toMatchObject({ status: "created", registrationId: 5, paymentId: 7 });
    expect(h.writes(players)).toEqual([]);
    expect(h.writes(guardians)).toEqual([]);
    expect(h.writes(registrations)[0].values).toMatchObject({ playerId: 4 });
    expect(sqlQuery(h.queries(registrations)[1]).sql).toContain("<> ?");
    expect(sqlQuery(h.queries(registrations)[1]).params).toContain(4);
  });
  it.each([
    ["stripe", null],
    ["e_transfer", null],
  ] as const)("safely cancels an expired local %s attempt before creating a fresh one", async (paymentMethod, stripeCheckoutSessionId) => {
    existingPlayerHistory({ ...historicalAttempt, registrationStatus: "pending_payment", paymentStatus: "pending", paymentMethod, stripeCheckoutSessionId });
    prepareFreshAttemptResults(true);
    expect(await create(submission(), FUTURE)).toMatchObject({ status: "created", registrationId: 5, paymentId: 7 });
    expect(h.writes(payments)[0].values).toEqual({ status: "cancelled" });
    expect(h.writes(registrations)[0].values).toEqual({ status: "cancelled", cancelledAt: NOW, reservationExpiresAt: null });
    expect(h.writes(players)).toEqual([]);
    expect(h.writes(guardians)).toEqual([]);
    expect(h.writes(registrations)[1].values).toMatchObject({ playerId: 4, status: "pending_payment" });
  });
  it("creates a fresh attempt for an orphan existing player", async () => {
    existingPlayerHistory();
    prepareFreshAttemptResults();
    expect(await create(submission(), FUTURE)).toMatchObject({ status: "created", registrationId: 5, paymentId: 7 });
    expect(h.writes(players)).toEqual([]);
    expect(h.writes(guardians)).toEqual([]);
    expect(h.writes(registrations)[0].values).toMatchObject({ playerId: 4 });
  });
  it.each(["stripe", "e_transfer"] as const)("persists a complete %s registration with encrypted notes and trusted price", async paymentMethod => {
    newFamily(); h.results.push({ insertId: 3 }, { insertId: 4 }, { insertId: 5 }, { insertId: 6 }, { insertId: 7 });
    expect(await create({ ...submission(), paymentMethod }, FUTURE)).toEqual({ status: "created", registrationId: 5, paymentId: 7, paymentMethod, manualPaymentReference: paymentMethod === "e_transfer" ? "ARTIS-7" : null, trainingGroupSlug: "development", startsOn: "2026-10-01", endsOn: "2026-12-31", subtotalCents: 10000, taxCents: 1300, totalCents: 11300, currency: "CAD" });
    expect(h.writes().slice(0, 5).map(op => op.table)).toEqual([guardians, players, registrations, legalAcceptances, payments]);
    expect(h.writes(guardians)[0].values).toEqual({
      fullName: "Test Guardian",
      email: "guardian@example.com",
      phone: "519-555-0123",
      secondaryPhone: null,
    });
    const saved = h.writes(players)[0].values as Record<string, string>;
    expect(decryptRegistrationText(saved.medicalInformationEncrypted)).toBe("Synthetic medical note");
    expect(decryptRegistrationText(saved.coachInformationEncrypted)).toBe("Synthetic coach note");
    expect(JSON.stringify(h.writes().map(op => op.values))).not.toContain("Synthetic medical note");
    expect(h.writes(registrations)[0].values).toMatchObject({ playerId: 4, programPackageId: 2, status: "pending_payment", reservationExpiresAt: FUTURE, packagePriceCents: 10000 });
    expect(h.writes(payments)[0].values).toMatchObject({ registrationId: 5, paymentMethod, totalCents: 11300, status: "pending" });
    expect(h.queries(trainingGroups)[0].lock).toBe("update"); expect(h.operations.at(-1)?.kind).toBe("commit");
  });
  it("does not require a guardian verification token when reusing an existing email", async () => {
    initial(); h.read(guardians, guardian); h.read(players); h.read(registrations, { occupiedSpots: 0 }); h.read(guardians, guardian); h.read(players);
    h.results.push({ insertId: 0 }, { insertId: 4 }, { insertId: 5 }, { insertId: 6 }, { insertId: 7 });
    expect(await create(submission(), FUTURE)).toMatchObject({ status: "created", registrationId: 5, paymentId: 7 });
    expect(h.operations.filter(op => op.kind === "select").map(op => op.table)).toEqual([trainingGroups, programPackages, legalDocuments, guardians, players, registrations, guardians, players]);
    expect(h.writes().map(op => ({ kind: op.kind, table: op.table }))).toEqual([guardians, players, registrations, legalAcceptances, payments].map(table => ({ kind: "insert", table })));
    expect(h.reads).toEqual([]);
    expect(h.operations.at(-1)?.kind).toBe("commit");
  });
  it("rechecks concurrent guardian details without overwriting them", async () => {
    const concurrentGuardian = { ...guardian, id: 9, fullName: "Different Guardian", phone: "5195559999", secondaryPhone: "5195558888" };
    initial(); h.read(guardians); h.read(registrations, { occupiedSpots: 0 }); h.read(guardians, concurrentGuardian); h.read(players);
    h.results.push({ insertId: 0 }, { insertId: 4 }, { insertId: 5 }, { insertId: 6 }, { insertId: 7 });
    expect(await create(submission(), FUTURE)).toMatchObject({ status: "created", registrationId: 5, paymentId: 7 });
    expect(h.operations.filter(op => op.kind === "upsert")).toEqual([{ kind: "upsert", table: guardians, values: { set: { email: "guardian@example.com" } } }]);
    expect(h.writes(guardians)).toHaveLength(1);
    expect(h.writes(guardians)[0].kind).toBe("insert");
    expect(h.writes(players)).toHaveLength(1);
    expect(h.writes(players)[0]).toMatchObject({ kind: "insert", values: { guardianId: concurrentGuardian.id, fullName: "Test Player" } });
    expect(h.operations.at(-1)?.kind).toBe("commit");
  });
  it("uses the same recovery rules for a player found after the guardian upsert", async () => {
    initial();
    h.read(guardians);
    h.read(registrations, { occupiedSpots: 0 });
    h.read(guardians, guardian);
    h.read(players, { id: 4 });
    h.read(registrations, { ...historicalAttempt, registrationStatus: "pending_payment", paymentStatus: "pending", reservationExpiresAt: FUTURE });
    expect(await create(submission(), FUTURE)).toMatchObject({ status: "resumed", registrationId: 10, paymentId: 11 });
    expect(h.writes(players)).toEqual([]);
    expect(h.writes(registrations)).toEqual([]);
    expect(h.writes(payments)).toEqual([]);
  });
  it.each([1, 2, 4])("rejects invalid insert ID at write %i and bubbles rollback", async index => {
    newFamily(); h.results.push(...Array.from({ length: index }, () => ({ insertId: 1 })), { insertId: 0 });
    await expect(create(submission(), FUTURE)).rejects.toThrow(/could not be saved/); expect(h.committed).toEqual([]); expect(h.operations.at(-1)?.kind).toBe("rollback");
  });
  it("does not report success if e-transfer reference update loses a race", async () => {
    newFamily(); h.results.push(...Array.from({ length: 5 }, () => ({ insertId: 1 })), { affectedRows: 0 });
    await expect(create({ ...submission(), paymentMethod: "e_transfer" }, FUTURE)).rejects.toThrow("e-transfer reference"); expect(h.committed).toEqual([]);
  });
  it("propagates a transaction error without partial success", async () => {
    newFamily(); h.results.push({ insertId: 3 }, new Error("Synthetic database failure"));
    await expect(create(submission(), FUTURE)).rejects.toThrow("Synthetic database failure"); expect(h.committed).toEqual([]);
  });
});

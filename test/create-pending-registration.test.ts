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
  it.each([false, true])("routes an existing player to duplicate/renewal handling (%p)", async active => {
    initial(); h.read(guardians, guardian); h.read(players, { id: 4 }); h.read(registrations, ...(active ? [{ id: 1 }] : []));
    expect(await create(submission(), FUTURE)).toMatchObject({ code: active ? "already-registered" : "renewal-required" }); expect(h.writes()).toEqual([]);
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

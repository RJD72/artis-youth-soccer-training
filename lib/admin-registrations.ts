// This file contains protected, read-only registration queries for administrators.
// Filtering, searching, and pagination happen in MySQL so the browser never
// receives every family's contact information at once. The overview deliberately
// excludes medical, emergency-contact, payment-provider, and legal-acceptance
// details because the list does not need that sensitive information.

import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  like,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  guardians,
  players,
  programPackages,
  registrations,
  trainingGroups,
} from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";
import { synchronizeRegistrationStatuses } from "@/lib/synchronize-registration-statuses";

const DEFAULT_PAGE_SIZE = 25;
const LEGACY_RECENT_PAGE_SIZE = 50;
const MAX_SEARCH_LENGTH = 100;

export const adminRegistrationStatusFilters = [
  "current",
  "all",
  "pending_payment",
  "scheduled",
  "active",
  "waitlisted",
  "expired",
  "cancelled",
] as const;

export type AdminRegistrationStatusFilter =
  (typeof adminRegistrationStatusFilters)[number];

export type AdminRegistrationQueryInput = {
  status?: string;
  search?: string;
  page?: string | number;
};

type RegistrationStatus = typeof registrations.$inferSelect.status;

type NormalizedAdminRegistrationQuery = {
  status: AdminRegistrationStatusFilter;
  search: string;
  requestedPage: number;
};

function isAdminRegistrationStatusFilter(
  value: string,
): value is AdminRegistrationStatusFilter {
  return adminRegistrationStatusFilters.some((status) => status === value);
}

function normalizeStatusFilter(
  value: string | undefined,
): AdminRegistrationStatusFilter {
  return value && isAdminRegistrationStatusFilter(value) ? value : "current";
}

function normalizeSearch(value: string | undefined): string {
  return value?.trim().slice(0, MAX_SEARCH_LENGTH) ?? "";
}

function normalizePage(value: string | number | undefined): number {
  const parsedPage = typeof value === "number" ? value : Number(value);

  return Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
}

function normalizeQuery(
  input: AdminRegistrationQueryInput,
): NormalizedAdminRegistrationQuery {
  return {
    status: normalizeStatusFilter(input.status),
    search: normalizeSearch(input.search),
    requestedPage: normalizePage(input.page),
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function getStatusCondition(
  status: AdminRegistrationStatusFilter,
  now: Date,
): SQL | undefined {
  switch (status) {
    case "current":
      return or(
        inArray(registrations.status, ["scheduled", "active"]),
        and(
          eq(registrations.status, "pending_payment"),
          gt(registrations.reservationExpiresAt, now),
        ),
      );
    case "pending_payment":
      return and(
        eq(registrations.status, "pending_payment"),
        gt(registrations.reservationExpiresAt, now),
      );
    case "expired":
      return or(
        eq(registrations.status, "expired"),
        and(
          eq(registrations.status, "pending_payment"),
          or(
            isNull(registrations.reservationExpiresAt),
            lte(registrations.reservationExpiresAt, now),
          ),
        ),
      );
    case "scheduled":
    case "active":
    case "waitlisted":
    case "cancelled":
      return eq(registrations.status, status);
    case "all":
      return undefined;
  }
}

function getSearchCondition(search: string): SQL | undefined {
  if (!search) {
    return undefined;
  }

  const pattern = `%${escapeLikePattern(search)}%`;
  const conditions: SQL[] = [
    like(players.fullName, pattern),
    like(guardians.fullName, pattern),
    like(guardians.email, pattern),
    like(guardians.phone, pattern),
  ];
  const phoneDigits = search.replace(/\D/g, "");

  // A guardian may type 5195551234 while the stored phone is formatted as
  // (519) 555-1234. MySQL removes formatting before comparing the digits.
  // The search value remains a bound Drizzle parameter, not executable SQL.
  if (phoneDigits.length >= 3) {
    const normalizedStoredPhone = sql<string>`REGEXP_REPLACE(${guardians.phone}, '[^0-9]', '')`;

    conditions.push(sql`${normalizedStoredPhone} LIKE ${`%${phoneDigits}%`}`);
  }

  return or(...conditions);
}

function combineConditions(
  statusCondition: SQL | undefined,
  searchCondition: SQL | undefined,
): SQL | undefined {
  const conditions = [statusCondition, searchCondition].filter(
    (condition): condition is SQL => condition !== undefined,
  );

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function getEffectiveStatus(
  status: RegistrationStatus,
  reservationExpiresAt: Date | null,
  now: Date,
): RegistrationStatus {
  const pendingReservationHasExpired =
    status === "pending_payment" &&
    (reservationExpiresAt === null ||
      reservationExpiresAt.getTime() <= now.getTime());

  return pendingReservationHasExpired ? "expired" : status;
}

async function queryAdminRegistrations(
  input: AdminRegistrationQueryInput,
  pageSize: number,
) {
  // Authentication protects the data-access function itself. A future page
  // cannot accidentally expose family contact information by importing it.
  await requireAdminSession();

  const query = normalizeQuery(input);
  const now = new Date();

  await synchronizeRegistrationStatuses(now);

  const whereCondition = combineConditions(
    getStatusCondition(query.status, now),
    getSearchCondition(query.search),
  );

  const [totalRow] = await db
    .select({ value: count(registrations.id) })
    .from(registrations)
    .innerJoin(players, eq(registrations.playerId, players.id))
    .innerJoin(guardians, eq(players.guardianId, guardians.id))
    .where(whereCondition);

  const totalItems = totalRow?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(query.requestedPage, totalPages);
  const offset = (currentPage - 1) * pageSize;

  const rows = await db
    .select({
      id: registrations.id,
      status: registrations.status,
      createdAt: registrations.createdAt,
      startsOn: registrations.startsOn,
      endsOn: registrations.endsOn,
      reservationExpiresAt: registrations.reservationExpiresAt,
      waitlistedAt: registrations.waitlistedAt,
      packagePriceCents: registrations.packagePriceCents,
      currency: registrations.currency,
      playerName: players.fullName,
      guardianName: guardians.fullName,
      guardianEmail: guardians.email,
      guardianPhone: guardians.phone,
      trainingGroupName: trainingGroups.displayName,
      programPackageName: programPackages.displayName,
    })
    .from(registrations)
    .innerJoin(players, eq(registrations.playerId, players.id))
    .innerJoin(guardians, eq(players.guardianId, guardians.id))
    .innerJoin(
      trainingGroups,
      eq(registrations.trainingGroupId, trainingGroups.id),
    )
    .innerJoin(
      programPackages,
      eq(registrations.programPackageId, programPackages.id),
    )
    .where(whereCondition)
    .orderBy(desc(registrations.createdAt), desc(registrations.id))
    .limit(pageSize)
    .offset(offset);

  return {
    registrations: rows.map((row) => ({
      ...row,
      status: getEffectiveStatus(row.status, row.reservationExpiresAt, now),
    })),
    filters: {
      status: query.status,
      search: query.search,
    },
    pagination: {
      currentPage,
      pageSize,
      totalItems,
      totalPages,
      hasPreviousPage: currentPage > 1,
      hasNextPage: currentPage < totalPages,
    },
  };
}

export function getAdminRegistrations(input: AdminRegistrationQueryInput = {}) {
  return queryAdminRegistrations(input, DEFAULT_PAGE_SIZE);
}

// Keep the existing page working until its table UI is replaced in the next
// step. This compatibility function can be removed once nothing imports it.
export async function getRecentAdminRegistrations() {
  const result = await queryAdminRegistrations(
    { status: "all", page: 1 },
    LEGACY_RECENT_PAGE_SIZE,
  );

  return result.registrations;
}

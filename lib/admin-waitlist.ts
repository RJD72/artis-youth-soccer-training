// This file contains the protected, read-only waitlist query used by the
// administrator area. Filtering, searching, and pagination happen in MySQL so
// the browser receives only the family records needed for the current page.

import "server-only";

import {
  and,
  asc,
  count,
  eq,
  inArray,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { trainingGroups, waitlistEntries } from "@/db/schema";
import { requireAdminSession } from "@/lib/admin-auth";

const DEFAULT_PAGE_SIZE = 25;
const LEGACY_ACTIVE_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;

export const adminWaitlistStatusFilters = [
  "active",
  "all",
  "waiting",
  "contacted",
  "converted",
  "cancelled",
] as const;

export type AdminWaitlistStatusFilter =
  (typeof adminWaitlistStatusFilters)[number];

export type AdminWaitlistQueryInput = {
  status?: string;
  search?: string;
  page?: string | number;
};

type NormalizedAdminWaitlistQuery = {
  status: AdminWaitlistStatusFilter;
  search: string;
  requestedPage: number;
};

function isAdminWaitlistStatusFilter(
  value: string,
): value is AdminWaitlistStatusFilter {
  return adminWaitlistStatusFilters.some((status) => status === value);
}

function normalizeStatusFilter(
  value: string | undefined,
): AdminWaitlistStatusFilter {
  return value && isAdminWaitlistStatusFilter(value) ? value : "active";
}

function normalizeSearch(value: string | undefined): string {
  return value?.trim().slice(0, MAX_SEARCH_LENGTH) ?? "";
}

function normalizePage(value: string | number | undefined): number {
  const parsedPage = typeof value === "number" ? value : Number(value);

  return Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
}

function normalizeQuery(
  input: AdminWaitlistQueryInput,
): NormalizedAdminWaitlistQuery {
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
  status: AdminWaitlistStatusFilter,
): SQL | undefined {
  switch (status) {
    case "active":
      return inArray(waitlistEntries.status, ["waiting", "contacted"]);
    case "waiting":
    case "contacted":
    case "converted":
    case "cancelled":
      return eq(waitlistEntries.status, status);
    case "all":
      return undefined;
  }
}

function getSearchCondition(search: string): SQL | undefined {
  if (!search) {
    return undefined;
  }

  const pattern = `%${escapeLikePattern(search)}%`;
  const childFullName = sql<string>`CONCAT(${waitlistEntries.childFirstName}, ' ', ${waitlistEntries.childLastName})`;
  const conditions: SQL[] = [
    like(waitlistEntries.childFirstName, pattern),
    like(waitlistEntries.childLastName, pattern),
    sql`${childFullName} LIKE ${pattern}`,
    like(waitlistEntries.guardianFullName, pattern),
    like(waitlistEntries.email, pattern),
    like(waitlistEntries.phone, pattern),
  ];
  const phoneDigits = search.replace(/\D/g, "");

  // Phone searches work whether the administrator enters formatting or digits
  // only. The value remains a bound Drizzle parameter.
  if (phoneDigits.length >= 3) {
    const normalizedStoredPhone = sql<string>`REGEXP_REPLACE(${waitlistEntries.phone}, '[^0-9]', '')`;

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

async function queryAdminWaitlist(
  input: AdminWaitlistQueryInput,
  pageSize: number,
) {
  // Protect the query itself, not only the page that calls it. This prevents a
  // future developer from accidentally exposing family contact information.
  await requireAdminSession();

  const query = normalizeQuery(input);
  const whereCondition = combineConditions(
    getStatusCondition(query.status),
    getSearchCondition(query.search),
  );

  const [totalRow] = await db
    .select({ value: count(waitlistEntries.id) })
    .from(waitlistEntries)
    .where(whereCondition);

  const totalItems = totalRow?.value ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(query.requestedPage, totalPages);
  const offset = (currentPage - 1) * pageSize;

  const rows = await db
    .select({
      id: waitlistEntries.id,
      status: waitlistEntries.status,
      childFirstName: waitlistEntries.childFirstName,
      childLastName: waitlistEntries.childLastName,
      guardianFullName: waitlistEntries.guardianFullName,
      email: waitlistEntries.email,
      phone: waitlistEntries.phone,
      notes: waitlistEntries.notes,
      createdAt: waitlistEntries.createdAt,
      updatedAt: waitlistEntries.updatedAt,
      trainingGroupName: trainingGroups.displayName,
    })
    .from(waitlistEntries)
    .innerJoin(
      trainingGroups,
      eq(waitlistEntries.trainingGroupId, trainingGroups.id),
    )
    .where(whereCondition)
    .orderBy(asc(waitlistEntries.createdAt), asc(waitlistEntries.id))
    .limit(pageSize)
    .offset(offset);

  return {
    entries: rows.map((entry) => ({
      ...entry,
      childName: `${entry.childFirstName} ${entry.childLastName}`,
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

export function getAdminWaitlist(input: AdminWaitlistQueryInput = {}) {
  return queryAdminWaitlist(input, DEFAULT_PAGE_SIZE);
}

// Keep the existing card page working until its responsive table UI is
// replaced in the next step.
export async function getActiveAdminWaitlistEntries() {
  const result = await queryAdminWaitlist(
    { status: "active", page: 1 },
    LEGACY_ACTIVE_PAGE_SIZE,
  );

  return result.entries;
}

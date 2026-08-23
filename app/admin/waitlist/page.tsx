import type { Metadata } from "next";
import Link from "next/link";

import {
  getAdminWaitlist,
  type AdminWaitlistStatusFilter,
} from "@/lib/admin-waitlist";

import { WaitlistEntryActions } from "./waitlist-entry-actions";

export const metadata: Metadata = {
  title: "Waitlist",
};

type AdminWaitlistPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
};

type AdminWaitlistEntry = Awaited<
  ReturnType<typeof getAdminWaitlist>
>["entries"][number];

const statusFilterLabels: Record<AdminWaitlistStatusFilter, string> = {
  active: "Active waitlist",
  all: "All entries",
  waiting: "Waiting",
  contacted: "Contacted",
  converted: "Converted",
  cancelled: "Cancelled",
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

function getFirstSearchParameter(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(value: Date): string {
  return dateFormatter.format(value);
}

function formatStatus(status: string): string {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "contacted":
      return "Contacted";
    case "converted":
      return "Converted";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function getStatusClassName(status: string): string {
  switch (status) {
    case "contacted":
    case "converted":
      return "bg-artis-success/10 text-artis-success";
    case "cancelled":
      return "bg-artis-error/10 text-artis-error";
    default:
      return "bg-artis-soft-gold text-artis-navy";
  }
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${getStatusClassName(
        status,
      )}`}
    >
      {formatStatus(status)}
    </span>
  );
}

function EntryNotes({ notes }: { notes: string | null }) {
  if (!notes) {
    return <span className="text-xs text-artis-slate">No notes</span>;
  }

  return (
    <details className="text-xs text-artis-navy">
      <summary className="cursor-pointer font-semibold underline decoration-artis-gold decoration-2 underline-offset-4">
        View notes
      </summary>
      <p className="mt-2 max-w-sm whitespace-pre-wrap leading-5 text-artis-slate">
        {notes}
      </p>
    </details>
  );
}

function isEditableEntry(entry: AdminWaitlistEntry): boolean {
  return entry.status === "waiting" || entry.status === "contacted";
}

function DesktopEntryActions({ entry }: { entry: AdminWaitlistEntry }) {
  if (!isEditableEntry(entry)) {
    return <span className="text-xs text-artis-slate">No active actions</span>;
  }

  return (
    <details>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-[10px] border border-artis-border bg-artis-white px-4 py-2.5 text-sm font-semibold text-artis-navy transition-colors hover:border-artis-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-artis-gold">
        Manage
      </summary>
      <div className="mt-3 min-w-44">
        <WaitlistEntryActions
          entryId={entry.id}
          entryStatus={entry.status}
          childName={entry.childName}
        />
      </div>
    </details>
  );
}

function MobileEntryActions({ entry }: { entry: AdminWaitlistEntry }) {
  if (!isEditableEntry(entry)) {
    return null;
  }

  return (
    <div className="mt-5 border-t border-artis-border pt-5">
      <WaitlistEntryActions
        entryId={entry.id}
        entryStatus={entry.status}
        childName={entry.childName}
      />
    </div>
  );
}

function WaitlistTable({ entries }: { entries: AdminWaitlistEntry[] }) {
  return (
    <div className="mt-6 hidden overflow-visible rounded-[12px] border border-artis-border bg-artis-white lg:block">
      <table className="w-full border-separate border-spacing-0 text-left">
        <caption className="sr-only">
          Filtered ARTIS Soccer Academy waitlist entries
        </caption>
        <thead className="bg-artis-navy text-artis-white">
          <tr>
            <th
              scope="col"
              className="rounded-tl-[11px] px-4 py-3.5 text-xs font-semibold"
            >
              Child
            </th>
            <th scope="col" className="px-4 py-3.5 text-xs font-semibold">
              Guardian and contact
            </th>
            <th scope="col" className="px-4 py-3.5 text-xs font-semibold">
              Training group
            </th>
            <th scope="col" className="px-4 py-3.5 text-xs font-semibold">
              Status
            </th>
            <th scope="col" className="px-4 py-3.5 text-xs font-semibold">
              Timeline and notes
            </th>
            <th
              scope="col"
              className="rounded-tr-[11px] px-4 py-3.5 text-xs font-semibold"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="align-top transition-colors hover:bg-artis-off-white [&:not(:last-child)>td]:border-b [&:not(:last-child)>td]:border-artis-border"
            >
              <td className="px-4 py-4">
                <p className="font-semibold text-artis-navy">
                  {entry.childName}
                </p>
                <p className="mt-1 text-xs text-artis-slate">
                  Entry #{entry.id}
                </p>
              </td>
              <td className="max-w-64 px-4 py-4">
                <p className="font-medium text-artis-navy">
                  {entry.guardianFullName}
                </p>
                <a
                  href={`mailto:${entry.email}`}
                  className="mt-1 block break-all text-xs text-artis-navy underline decoration-artis-gold underline-offset-4"
                >
                  {entry.email}
                </a>
                <a
                  href={`tel:${entry.phone}`}
                  className="mt-1 block text-xs text-artis-navy underline decoration-artis-gold underline-offset-4"
                >
                  {entry.phone}
                </a>
              </td>
              <td className="px-4 py-4">
                <p className="text-sm font-medium text-artis-navy">
                  {entry.trainingGroupName}
                </p>
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={entry.status} />
              </td>
              <td className="min-w-52 px-4 py-4">
                <p className="text-xs leading-5 text-artis-slate">
                  Joined {formatDateTime(entry.createdAt)}
                </p>
                <p className="mb-2 text-xs leading-5 text-artis-slate">
                  Updated {formatDateTime(entry.updatedAt)}
                </p>
                <EntryNotes notes={entry.notes} />
              </td>
              <td className="min-w-48 px-4 py-4">
                <DesktopEntryActions entry={entry} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WaitlistCards({ entries }: { entries: AdminWaitlistEntry[] }) {
  return (
    <ol className="mt-6 space-y-4 lg:hidden">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="rounded-[12px] border border-artis-border bg-artis-white p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-artis-gold">
                Entry #{entry.id}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-artis-navy">
                {entry.childName}
              </h2>
            </div>
            <StatusBadge status={entry.status} />
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                Guardian
              </dt>
              <dd className="mt-1 text-sm font-medium text-artis-navy">
                {entry.guardianFullName}
              </dd>
              <dd className="mt-1 text-sm">
                <a
                  href={`mailto:${entry.email}`}
                  className="block break-all text-artis-navy underline decoration-artis-gold underline-offset-4"
                >
                  {entry.email}
                </a>
                <a
                  href={`tel:${entry.phone}`}
                  className="mt-1 block text-artis-navy underline decoration-artis-gold underline-offset-4"
                >
                  {entry.phone}
                </a>
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                Training group
              </dt>
              <dd className="mt-1 text-sm font-medium text-artis-navy">
                {entry.trainingGroupName}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                Joined
              </dt>
              <dd className="mt-1 text-sm leading-6 text-artis-slate">
                {formatDateTime(entry.createdAt)}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                Last updated
              </dt>
              <dd className="mt-1 text-sm leading-6 text-artis-slate">
                {formatDateTime(entry.updatedAt)}
              </dd>
            </div>
          </dl>

          <div className="mt-4 rounded-[10px] bg-artis-off-white px-3 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-artis-slate">
              Notes
            </p>
            <EntryNotes notes={entry.notes} />
          </div>

          <MobileEntryActions entry={entry} />
        </li>
      ))}
    </ol>
  );
}

function buildPageHref(
  status: AdminWaitlistStatusFilter,
  search: string,
  page: number,
): string {
  const parameters = new URLSearchParams();

  if (status !== "active") {
    parameters.set("status", status);
  }

  if (search) {
    parameters.set("q", search);
  }

  if (page > 1) {
    parameters.set("page", String(page));
  }

  const query = parameters.toString();

  return query ? `/admin/waitlist?${query}` : "/admin/waitlist";
}

export default async function AdminWaitlistPage({
  searchParams,
}: AdminWaitlistPageProps) {
  const parameters = await searchParams;
  const result = await getAdminWaitlist({
    status: getFirstSearchParameter(parameters.status),
    search: getFirstSearchParameter(parameters.q),
    page: getFirstSearchParameter(parameters.page),
  });
  const { entries, filters, pagination } = result;
  const firstVisibleItem =
    pagination.totalItems === 0
      ? 0
      : (pagination.currentPage - 1) * pagination.pageSize + 1;
  const lastVisibleItem = Math.min(
    pagination.currentPage * pagination.pageSize,
    pagination.totalItems,
  );
  const hasActiveFilters =
    filters.status !== "active" || filters.search.length > 0;

  return (
    <main className="min-h-screen bg-artis-off-white px-4 py-12 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-[1400px]">
        <Link
          href="/admin"
          className="inline-flex text-sm font-semibold text-artis-navy underline decoration-artis-gold decoration-2 underline-offset-4"
        >
          ← Back to dashboard
        </Link>

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-artis-gold">
          ARTIS Soccer Academy
        </p>

        <h1 className="mt-3 text-[38px] leading-tight font-bold tracking-tight text-artis-navy">
          Waitlist
        </h1>

        <p className="mt-4 max-w-2xl text-[17px] leading-7 text-artis-slate">
          Find waitlist entries, review family contact information and manage
          each family’s current status.
        </p>

        <form
          action="/admin/waitlist"
          method="get"
          className="mt-8 rounded-[12px] border border-artis-border bg-artis-white p-5 sm:p-6"
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(280px,1fr)_280px_auto] lg:items-end">
            <div>
              <label
                htmlFor="waitlist-search"
                className="block text-[13px] font-semibold text-artis-navy"
              >
                Search waitlist
              </label>
              <input
                id="waitlist-search"
                name="q"
                type="search"
                defaultValue={filters.search}
                maxLength={100}
                placeholder="Child, guardian, email or phone"
                className="mt-2 h-[52px] w-full rounded-[10px] border border-artis-border bg-artis-white px-4 text-[15px] text-artis-navy outline-none placeholder:text-artis-slate focus:border-artis-gold focus:ring-2 focus:ring-artis-gold/20"
              />
            </div>

            <div>
              <label
                htmlFor="waitlist-status"
                className="block text-[13px] font-semibold text-artis-navy"
              >
                Waitlist status
              </label>
              <select
                id="waitlist-status"
                name="status"
                defaultValue={filters.status}
                className="mt-2 h-[52px] w-full cursor-pointer rounded-[10px] border border-artis-border bg-artis-white px-4 text-[15px] text-artis-navy outline-none focus:border-artis-gold focus:ring-2 focus:ring-artis-gold/20"
              >
                {Object.entries(statusFilterLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="min-h-12 rounded-[10px] bg-artis-navy px-6 py-3.5 text-[15px] font-semibold text-artis-white transition-colors hover:bg-artis-deep-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-artis-gold"
            >
              Apply filters
            </button>
          </div>

          {hasActiveFilters ? (
            <Link
              href="/admin/waitlist"
              className="mt-4 inline-flex text-sm font-semibold text-artis-navy underline decoration-artis-gold decoration-2 underline-offset-4"
            >
              Clear search and filters
            </Link>
          ) : null}
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <output className="text-sm text-artis-slate">
            Showing {firstVisibleItem}–{lastVisibleItem} of{" "}
            {pagination.totalItems} entries
          </output>
          <p className="text-sm font-semibold text-artis-navy">
            {statusFilterLabels[filters.status]}
          </p>
        </div>

        {entries.length > 0 ? (
          <>
            <WaitlistTable entries={entries} />
            <WaitlistCards entries={entries} />
          </>
        ) : (
          <div className="mt-6 rounded-[12px] border border-dashed border-artis-border bg-artis-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-artis-navy">
              No matching waitlist entries
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-artis-slate">
              Try a different name, contact detail or status filter.
            </p>
            {hasActiveFilters ? (
              <Link
                href="/admin/waitlist"
                className="mt-4 inline-flex text-sm font-semibold text-artis-navy underline decoration-artis-gold decoration-2 underline-offset-4"
              >
                View active waitlist
              </Link>
            ) : null}
          </div>
        )}

        {pagination.totalPages > 1 ? (
          <nav
            aria-label="Waitlist pages"
            className="mt-6 flex items-center justify-between gap-4"
          >
            {pagination.hasPreviousPage ? (
              <Link
                href={buildPageHref(
                  filters.status,
                  filters.search,
                  pagination.currentPage - 1,
                )}
                className="inline-flex min-h-12 items-center rounded-[10px] border border-artis-border bg-artis-white px-5 py-3 text-sm font-semibold text-artis-navy transition-colors hover:border-artis-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-artis-gold"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}

            <span className="text-sm text-artis-slate">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>

            {pagination.hasNextPage ? (
              <Link
                href={buildPageHref(
                  filters.status,
                  filters.search,
                  pagination.currentPage + 1,
                )}
                className="inline-flex min-h-12 items-center rounded-[10px] border border-artis-border bg-artis-white px-5 py-3 text-sm font-semibold text-artis-navy transition-colors hover:border-artis-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-artis-gold"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </main>
  );
}

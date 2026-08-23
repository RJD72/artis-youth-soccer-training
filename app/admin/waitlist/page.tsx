import type { Metadata } from "next";
import Link from "next/link";

import { getActiveAdminWaitlistEntries } from "@/lib/admin-waitlist";

import { WaitlistEntryActions } from "./waitlist-entry-actions";

export const metadata: Metadata = {
  title: "Waitlist",
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

function formatDateTime(value: Date): string {
  return dateFormatter.format(value);
}

function formatStatus(status: string): string {
  return status === "contacted" ? "Contacted" : "Waiting";
}

function getStatusClassName(status: string): string {
  return status === "contacted"
    ? "bg-artis-success/10 text-artis-success"
    : "bg-artis-soft-gold text-artis-navy";
}

export default async function AdminWaitlistPage() {
  const waitlistEntries = await getActiveAdminWaitlistEntries();

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

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-artis-navy sm:text-4xl">
          Active waitlist
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-artis-slate">
          Review families who are waiting for a place. Entries appear in the
          order they were received, with the longest-waiting family first.
        </p>

        {waitlistEntries.length > 0 ? (
          <ol className="mt-8 space-y-4">
            {waitlistEntries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-2xl border border-artis-border bg-artis-white p-5 sm:p-6 lg:grid lg:grid-cols-[minmax(180px,0.8fr)_minmax(250px,1.15fr)_minmax(230px,1fr)_180px] lg:items-start lg:gap-6 lg:rounded-[10px] lg:px-6 lg:py-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-3 lg:block">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-artis-gold">
                        Entry #{entry.id}
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-artis-navy">
                        {entry.childName}
                      </h2>
                      <p className="mt-1 text-sm text-artis-slate">
                        {entry.trainingGroupName}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold lg:mt-3 lg:inline-flex ${getStatusClassName(
                        entry.status,
                      )}`}
                    >
                      {formatStatus(entry.status)}
                    </span>
                  </div>
                </div>

                <dl className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:mt-0 lg:grid-cols-1">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                      Parent or guardian
                    </dt>
                    <dd className="mt-1 font-medium text-artis-navy">
                      {entry.guardianFullName}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                      Contact
                    </dt>
                    <dd className="mt-1 text-sm text-artis-navy">
                      <a
                        href={`mailto:${entry.email}`}
                        className="block break-all underline decoration-artis-gold underline-offset-4"
                      >
                        {entry.email}
                      </a>
                      <a
                        href={`tel:${entry.phone}`}
                        className="mt-1 block underline decoration-artis-gold underline-offset-4"
                      >
                        {entry.phone}
                      </a>
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 min-w-0 lg:mt-0">
                  <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                        Joined waitlist
                      </dt>
                      <dd className="mt-1 text-sm text-artis-navy">
                        {formatDateTime(entry.createdAt)}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                        Last updated
                      </dt>
                      <dd className="mt-1 text-sm text-artis-navy">
                        {formatDateTime(entry.updatedAt)}
                      </dd>
                    </div>
                  </dl>

                  {entry.notes ? (
                    <div className="mt-4 rounded-[10px] bg-artis-off-white px-3 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                        Notes
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-artis-navy">
                        {entry.notes}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 border-t border-artis-border pt-5 lg:mt-0 lg:border-t-0 lg:pt-0">
                  <WaitlistEntryActions
                    entryId={entry.id}
                    entryStatus={entry.status}
                    childName={entry.childName}
                  />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-artis-border bg-artis-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-artis-navy">
              No active waitlist entries
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-artis-slate">
              New waitlist submissions will appear here. Cancelled and converted
              entries are not included in this working list.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

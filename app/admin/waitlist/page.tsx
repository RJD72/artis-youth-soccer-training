import type { Metadata } from "next";
import Link from "next/link";

import { getActiveAdminWaitlistEntries } from "@/lib/admin-waitlist";

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
      <section className="mx-auto w-full max-w-6xl">
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
          <ol className="mt-8 grid gap-5 lg:grid-cols-2">
            {waitlistEntries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-2xl border border-artis-border bg-artis-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-artis-gold">
                      Waitlist entry #{entry.id}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-artis-navy">
                      {entry.childName}
                    </h2>
                    <p className="mt-1 text-sm text-artis-slate">
                      {entry.trainingGroupName}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClassName(
                      entry.status,
                    )}`}
                  >
                    {formatStatus(entry.status)}
                  </span>
                </div>

                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
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
                  <div className="mt-5 rounded-[10px] bg-artis-off-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                      Notes from family
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-artis-navy">
                      {entry.notes}
                    </p>
                  </div>
                ) : null}
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

// This page protects the admin dashboard and only allows approved administrators to view it.
// It checks the current user session, redirects anyone who is not signed in or not on the allowlist,
// and then shows the admin UI for approved users.

import Link from "next/link";

import { requireAdminSession } from "@/lib/admin-auth";
import { getTrainingGroupCapacitySummaries } from "@/lib/admin-dashboard";

import { updateTrainingGroupRegistrationStatus } from "./actions";
import { SignOutButton } from "./sign-out-button";

export default async function AdminPage() {
  const session = await requireAdminSession();
  const trainingGroupSummaries = await getTrainingGroupCapacitySummaries();

  return (
    <main className="min-h-screen bg-artis-off-white px-4 py-12 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-artis-gold">
          ARTIS Soccer Academy
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-artis-navy sm:text-4xl">
          Administrator dashboard
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-artis-slate">
          Welcome, {session.user.name}. Your administrator session is active and
          your email is approved for access.
        </p>

        <div className="mt-8 flex flex-col gap-5 rounded-2xl border border-artis-border bg-artis-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-artis-navy">
              Signed in as
            </p>
            <p className="mt-1 text-artis-slate">{session.user.email}</p>
          </div>

          <SignOutButton />
        </div>

        <nav
          className="mt-8 grid gap-5 lg:grid-cols-2"
          aria-label="Administrator tools"
        >
          <Link
            href="/admin/registrations"
            className="flex h-full flex-col justify-between gap-5 rounded-2xl border border-artis-border bg-artis-white p-5 transition hover:border-artis-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/30 sm:p-6"
          >
            <span>
              <span className="block text-lg font-semibold text-artis-navy">
                Player registrations
              </span>
              <span className="mt-1 block max-w-2xl text-sm leading-6 text-artis-slate">
                Review recent registrations, guardian contact information,
                selected programs, dates, and current statuses.
              </span>
            </span>

            <span className="shrink-0 font-semibold text-artis-navy underline decoration-artis-gold decoration-2 underline-offset-4">
              View registrations →
            </span>
          </Link>

          <Link
            href="/admin/waitlist"
            className="flex h-full flex-col justify-between gap-5 rounded-2xl border border-artis-border bg-artis-white p-5 transition hover:border-artis-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/30 sm:p-6"
          >
            <span>
              <span className="block text-lg font-semibold text-artis-navy">
                Active waitlist
              </span>
              <span className="mt-1 block max-w-2xl text-sm leading-6 text-artis-slate">
                Review waiting families, guardian contact information, selected
                age groups, submission dates, and current statuses.
              </span>
            </span>

            <span className="shrink-0 font-semibold text-artis-navy underline decoration-artis-gold decoration-2 underline-offset-4">
              View waitlist →
            </span>
          </Link>
        </nav>

        <div className="mt-10 border-t border-artis-border pt-8">
          <h2 className="text-2xl font-semibold text-artis-navy">
            Training Group Capacity
          </h2>
          <p className="mt-2 max-w-2xl leading-7 text-artis-slate">
            See how many places are occupied and available in each age group.
          </p>

          {trainingGroupSummaries.length > 0 ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {trainingGroupSummaries.map((group) => (
                <article
                  key={group.id}
                  className="rounded-2xl border border-artis-border bg-artis-white p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-artis-navy">
                        {group.displayName}
                      </h3>
                      <p className="mt-1 text-sm text-artis-slate">
                        Players ages {group.minimumAge}–{group.maximumAge}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        group.registrationOpen
                          ? "bg-artis-success/10 text-artis-success"
                          : "bg-artis-soft-gold text-artis-navy"
                      }`}
                    >
                      Registration {group.registrationOpen ? "open" : "closed"}
                    </span>
                  </div>

                  <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-artis-off-white p-3">
                      <dt className="text-xs font-medium uppercase tracking-wide text-artis-slate">
                        Occupied
                      </dt>
                      <dd className="mt-1 text-2xl font-bold text-artis-navy">
                        {group.occupiedSpots}
                      </dd>
                    </div>

                    <div className="rounded-xl bg-artis-off-white p-3">
                      <dt className="text-xs font-medium uppercase tracking-wide text-artis-slate">
                        Available
                      </dt>
                      <dd className="mt-1 text-2xl font-bold text-artis-success">
                        {group.availableSpots}
                      </dd>
                    </div>

                    <div className="rounded-xl bg-artis-off-white p-3">
                      <dt className="text-xs font-medium uppercase tracking-wide text-artis-slate">
                        Capacity
                      </dt>
                      <dd className="mt-1 text-2xl font-bold text-artis-navy">
                        {group.capacity}
                      </dd>
                    </div>
                  </dl>

                  <form
                    action={updateTrainingGroupRegistrationStatus}
                    className="mt-6 border-t border-artis-border pt-5"
                  >
                    <input
                      type="hidden"
                      name="trainingGroupId"
                      value={group.id}
                    />
                    <input
                      type="hidden"
                      name="registrationOpen"
                      value={String(!group.registrationOpen)}
                    />

                    <button
                      type="submit"
                      className={`min-h-12 w-full rounded-[10px] px-6 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 sm:w-auto ${
                        group.registrationOpen
                          ? "bg-artis-gold text-artis-deep-navy hover:bg-artis-gold/85 focus-visible:ring-artis-navy/20"
                          : "bg-artis-navy text-artis-white hover:bg-artis-deep-navy focus-visible:ring-artis-gold/30"
                      }`}
                    >
                      {group.registrationOpen
                        ? "Close registration"
                        : "Open registration"}
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-artis-border bg-artis-white p-5 text-artis-slate">
              No training groups have been created yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

// This page protects the admin dashboard and only allows approved administrators to view it.
// It checks the current user session, redirects anyone who is not signed in or not on the allowlist,
// and then shows the admin UI for approved users.

import { requireAdminSession } from "@/lib/admin-auth";
import { getTrainingGroupCapacitySummaries } from "@/lib/admin-dashboard";

import { SignOutButton } from "./sign-out-button";

export default async function AdminPage() {
  const session = await requireAdminSession();
  const trainingGroupSummaries = await getTrainingGroupCapacitySummaries();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 sm:px-6">
      <section className="mx-auto w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
          ARTIS Soccer Academy
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          Administrator dashboard
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-slate-600">
          Welcome, {session.user.name}. Your administrator session is active and
          your email is approved for access.
        </p>
        <div className="mt-8 flex flex-col gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Signed in as</p>
            <p className="mt-1 text-slate-600">{session.user.email}</p>
          </div>

          <SignOutButton />
        </div>

        <div className="mt-8 border-t border-slate-200 pt-8">
          <h2 className="text-xl font-semibold text-slate-950">
            Training Group Capacity
          </h2>
          <p className="mt-2 max-w-2xl leading-7 text-slate-600">
            See how many places are occupied and available in each age group.
          </p>

          {trainingGroupSummaries.length > 0 ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {trainingGroupSummaries.map((group) => (
                <article
                  key={group.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">
                        {group.displayName}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        Players ages {group.minimumAge}–{group.maximumAge}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        group.registrationOpen
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      Registration {group.registrationOpen ? "open" : "closed"}
                    </span>
                  </div>

                  <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-white p-3">
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Occupied
                      </dt>
                      <dd className="mt-1 text-2xl font-bold text-slate-950">
                        {group.occupiedSpots}
                      </dd>
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Available
                      </dt>
                      <dd className="mt-1 text-2xl font-bold text-emerald-700">
                        {group.availableSpots}
                      </dd>
                    </div>

                    <div className="rounded-xl bg-white p-3">
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Capacity
                      </dt>
                      <dd className="mt-1 text-2xl font-bold text-slate-950">
                        {group.capacity}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-600">
              No training groups have been created yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

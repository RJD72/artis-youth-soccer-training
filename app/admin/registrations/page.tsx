import type { Metadata } from "next";
import Link from "next/link";

import { getRecentAdminRegistrations } from "@/lib/admin-registrations";

export const metadata: Metadata = {
  title: "Registrations",
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

const dateOnlyFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function formatDateTime(value: Date): string {
  return dateFormatter.format(value);
}

function formatDateOnly(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return dateOnlyFormatter.format(date);
}

function formatProgramDates(startsOn: string | null, endsOn: string | null) {
  if (!startsOn && !endsOn) {
    return "Not scheduled";
  }

  return `${formatDateOnly(startsOn)} – ${formatDateOnly(endsOn)}`;
}

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function formatStatus(status: string): string {
  switch (status) {
    case "pending_payment":
      return "Pending payment";
    case "scheduled":
      return "Scheduled";
    case "active":
      return "Active";
    case "waitlisted":
      return "Waitlisted";
    case "expired":
      return "Payment expired";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function getStatusClassName(status: string): string {
  switch (status) {
    case "active":
      return "bg-artis-success/10 text-artis-success";
    case "cancelled":
      return "bg-artis-error/10 text-artis-error";
    case "expired":
      return "bg-artis-error/10 text-artis-error";
    default:
      return "bg-artis-soft-gold text-artis-navy";
  }
}

function getEffectiveStatus(
  status: string,
  reservationExpiresAt: Date | null,
  now: Date,
): string {
  const hasExpiredReservation =
    status === "pending_payment" &&
    reservationExpiresAt !== null &&
    reservationExpiresAt.getTime() <= now.getTime();

  return hasExpiredReservation ? "expired" : status;
}

export default async function AdminRegistrationsPage() {
  const registrations = await getRecentAdminRegistrations();
  const now = new Date();

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
          Registrations
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-artis-slate">
          Review the 50 most recent player registrations and their current
          program status.
        </p>

        {registrations.length > 0 ? (
          <ul className="mt-8 space-y-4">
            {registrations.map((registration) => {
              const effectiveStatus = getEffectiveStatus(
                registration.status,
                registration.reservationExpiresAt,
                now,
              );
              const reservationHasExpired = effectiveStatus === "expired";

              return (
                <li
                  key={registration.id}
                  className="rounded-2xl border border-artis-border bg-artis-white p-5 sm:p-6 lg:grid lg:grid-cols-[minmax(180px,0.8fr)_minmax(250px,1.15fr)_minmax(210px,0.9fr)_minmax(260px,1.2fr)] lg:items-start lg:gap-6 lg:rounded-[10px] lg:px-6 lg:py-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3 lg:block">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-artis-gold">
                          Registration #{registration.id}
                        </p>
                        <h2 className="mt-2 text-xl font-semibold text-artis-navy">
                          {registration.playerName}
                        </h2>
                        <p className="mt-1 text-sm text-artis-slate">
                          {registration.trainingGroupName}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold lg:mt-3 lg:inline-flex ${getStatusClassName(
                          effectiveStatus,
                        )}`}
                      >
                        {formatStatus(effectiveStatus)}
                      </span>
                    </div>
                  </div>

                  <dl className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:mt-0 lg:grid-cols-1">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                        Guardian
                      </dt>
                      <dd className="mt-1 font-medium text-artis-navy">
                        {registration.guardianName}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                        Contact
                      </dt>
                      <dd className="mt-1 text-sm text-artis-navy">
                        <a
                          href={`mailto:${registration.guardianEmail}`}
                          className="block break-all underline decoration-artis-gold underline-offset-4"
                        >
                          {registration.guardianEmail}
                        </a>
                        <a
                          href={`tel:${registration.guardianPhone}`}
                          className="mt-1 block underline decoration-artis-gold underline-offset-4"
                        >
                          {registration.guardianPhone}
                        </a>
                      </dd>
                    </div>
                  </dl>

                  <dl className="mt-6 grid min-w-0 gap-4 sm:grid-cols-2 lg:mt-0 lg:grid-cols-1">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                        Program
                      </dt>
                      <dd className="mt-1 font-medium text-artis-navy">
                        {registration.programPackageName}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                        Package price
                      </dt>
                      <dd className="mt-1 font-medium text-artis-navy">
                        {formatCurrency(
                          registration.packagePriceCents,
                          registration.currency,
                        )}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-6 min-w-0 lg:mt-0">
                    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                          Program dates
                        </dt>
                        <dd className="mt-1 text-sm text-artis-navy">
                          {formatProgramDates(
                            registration.startsOn,
                            registration.endsOn,
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                          Registered
                        </dt>
                        <dd className="mt-1 text-sm text-artis-navy">
                          {formatDateTime(registration.createdAt)}
                        </dd>
                      </div>
                    </dl>

                    {registration.reservationExpiresAt ? (
                      <p
                        className={`mt-4 rounded-[10px] px-3 py-2.5 text-sm leading-5 ${
                          reservationHasExpired
                            ? "bg-artis-error/10 font-semibold text-artis-error"
                            : "bg-artis-soft-gold text-artis-navy"
                        }`}
                      >
                        Payment reservation{" "}
                        {reservationHasExpired ? "expired" : "expires"}{" "}
                        {formatDateTime(registration.reservationExpiresAt)}.
                      </p>
                    ) : null}

                    {registration.waitlistedAt ? (
                      <p className="mt-4 rounded-[10px] bg-artis-soft-gold px-3 py-2.5 text-sm leading-5 text-artis-navy">
                        Added to the waitlist{" "}
                        {formatDateTime(registration.waitlistedAt)}.
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-artis-border bg-artis-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-artis-navy">
              No registrations yet
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-artis-slate">
              New player registrations will appear here after families begin
              submitting the registration form.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import {
  getAdminRegistrations,
  type AdminRegistrationStatusFilter,
} from "@/lib/admin-registrations";

import { CancelRegistrationControl } from "./cancel-registration-control";
import { ConfirmETransferControl } from "./confirm-e-transfer-control";

export const metadata: Metadata = {
  title: "Registrations",
};

type AdminRegistrationsPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
};

type AdminRegistration = Awaited<
  ReturnType<typeof getAdminRegistrations>
>["registrations"][number];

const statusFilterLabels: Record<AdminRegistrationStatusFilter, string> = {
  current: "Current registrations",
  all: "All registrations",
  pending_payment: "Pending payment",
  scheduled: "Scheduled",
  active: "Active",
  waitlisted: "Waitlisted",
  expired: "Payment expired",
  cancelled: "Cancelled",
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

function getFirstSearchParameter(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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

function formatProgramDates(
  startsOn: string | null,
  endsOn: string | null,
): string {
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

function formatPaymentMethod(paymentMethod: string): string {
  return paymentMethod === "e_transfer" ? "E-transfer" : "Stripe";
}

function formatPaymentStatus(paymentStatus: string): string {
  switch (paymentStatus) {
    case "pending":
      return "Pending";
    case "succeeded":
      return "Paid";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "partially_refunded":
      return "Partially refunded";
    case "refunded":
      return "Refunded";
    default:
      return paymentStatus;
  }
}

function getStatusClassName(status: string): string {
  switch (status) {
    case "active":
      return "bg-artis-success/10 text-artis-success";
    case "scheduled":
      return "bg-artis-navy/10 text-artis-navy";
    case "cancelled":
    case "expired":
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

function PaymentSummary({ registration }: { registration: AdminRegistration }) {
  if (!registration.paymentMethod || !registration.paymentStatus) {
    return <p className="text-xs text-artis-error">Payment unavailable</p>;
  }

  return (
    <div className="text-xs leading-5 text-artis-slate">
      <p>
        {formatPaymentMethod(registration.paymentMethod)} ·{" "}
        {formatPaymentStatus(registration.paymentStatus)}
      </p>
      {registration.paidAt ? (
        <p>Paid {formatDateTime(registration.paidAt)}</p>
      ) : null}
    </div>
  );
}

function RegistrationActions({
  registration,
}: {
  registration: AdminRegistration;
}) {
  const canConfirmETransfer =
    registration.paymentMethod === "e_transfer" &&
    registration.paymentStatus === "pending" &&
    registration.paymentId !== null;
  const canCancelRegistration =
    registration.status === "scheduled" || registration.status === "active";

  if (!canConfirmETransfer && !canCancelRegistration) {
    return <span className="text-xs text-artis-slate">No active actions</span>;
  }

  return (
    <div className="space-y-2">
      {canConfirmETransfer ? (
        <ConfirmETransferControl
          registrationId={registration.id}
          paymentId={registration.paymentId!}
          playerName={registration.playerName}
          amountLabel={formatCurrency(
            registration.packagePriceCents,
            registration.currency,
          )}
          paymentReference={registration.manualPaymentReference}
        />
      ) : null}

      {registration.status === "scheduled" ||
      registration.status === "active" ? (
        <CancelRegistrationControl
          registrationId={registration.id}
          playerName={registration.playerName}
          registrationStatus={registration.status}
        />
      ) : null}
    </div>
  );
}

function hasRegistrationActions(registration: AdminRegistration): boolean {
  const canConfirmETransfer =
    registration.paymentMethod === "e_transfer" &&
    registration.paymentStatus === "pending" &&
    registration.paymentId !== null;
  const canCancelRegistration =
    registration.status === "scheduled" || registration.status === "active";

  return canConfirmETransfer || canCancelRegistration;
}

function ReservationTiming({
  registration,
}: {
  registration: AdminRegistration;
}) {
  const hasPaymentReservationStatus =
    registration.status === "pending_payment" ||
    registration.status === "expired";

  if (!hasPaymentReservationStatus || !registration.reservationExpiresAt) {
    return null;
  }

  const reservationHasExpired = registration.status === "expired";

  return (
    <p
      className={
        reservationHasExpired
          ? "mt-1 font-semibold text-artis-error"
          : "mt-1 text-artis-slate"
      }
    >
      {reservationHasExpired ? "Expired" : "Expires"}{" "}
      {formatDateTime(registration.reservationExpiresAt)}
    </p>
  );
}

function RegistrationTable({
  registrations,
}: {
  registrations: AdminRegistration[];
}) {
  return (
    <div className="mt-6 hidden overflow-hidden rounded-[12px] border border-artis-border bg-artis-white lg:block">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Filtered ARTIS Soccer Academy registrations
        </caption>
        <thead className="bg-artis-navy text-artis-white">
          <tr>
            <th scope="col" className="px-4 py-3.5 text-xs font-semibold">
              Player
            </th>
            <th scope="col" className="px-4 py-3.5 text-xs font-semibold">
              Guardian and contact
            </th>
            <th scope="col" className="px-4 py-3.5 text-xs font-semibold">
              Training
            </th>
            <th scope="col" className="px-4 py-3.5 text-xs font-semibold">
              Package
            </th>
            <th scope="col" className="px-4 py-3.5 text-xs font-semibold">
              Status
            </th>
            <th scope="col" className="px-4 py-3.5 text-xs font-semibold">
              Timeline
            </th>
            <th scope="col" className="px-4 py-3.5 text-xs font-semibold">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-artis-border">
          {registrations.map((registration) => (
            <tr
              key={registration.id}
              className="align-top transition-colors hover:bg-artis-off-white"
            >
              <td className="px-4 py-4">
                <p className="font-semibold text-artis-navy">
                  {registration.playerName}
                </p>
                <p className="mt-1 text-xs text-artis-slate">
                  Registration #{registration.id}
                </p>
              </td>
              <td className="max-w-64 px-4 py-4">
                <p className="font-medium text-artis-navy">
                  {registration.guardianName}
                </p>
                <a
                  href={`mailto:${registration.guardianEmail}`}
                  className="mt-1 block break-all text-xs text-artis-navy underline decoration-artis-gold underline-offset-4"
                >
                  {registration.guardianEmail}
                </a>
                <a
                  href={`tel:${registration.guardianPhone}`}
                  className="mt-1 block text-xs text-artis-navy underline decoration-artis-gold underline-offset-4"
                >
                  {registration.guardianPhone}
                </a>
              </td>
              <td className="px-4 py-4">
                <p className="text-sm font-medium text-artis-navy">
                  {registration.trainingGroupName}
                </p>
                <p className="mt-1 text-xs leading-5 text-artis-slate">
                  {formatProgramDates(
                    registration.startsOn,
                    registration.endsOn,
                  )}
                </p>
              </td>
              <td className="px-4 py-4">
                <p className="text-sm font-medium text-artis-navy">
                  {registration.programPackageName}
                </p>
                <p className="mt-1 text-xs text-artis-slate">
                  {formatCurrency(
                    registration.packagePriceCents,
                    registration.currency,
                  )}
                </p>
              </td>
              <td className="px-4 py-4">
                <StatusBadge status={registration.status} />
                <div className="mt-2">
                  <PaymentSummary registration={registration} />
                </div>
              </td>
              <td className="min-w-48 px-4 py-4 text-xs leading-5">
                <p className="text-artis-slate">
                  Registered {formatDateTime(registration.createdAt)}
                </p>
                <ReservationTiming registration={registration} />
                {registration.waitlistedAt ? (
                  <p className="mt-1 text-artis-slate">
                    Waitlisted {formatDateTime(registration.waitlistedAt)}
                  </p>
                ) : null}
              </td>
              <td className="min-w-52 px-4 py-4">
                <RegistrationActions registration={registration} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegistrationCards({
  registrations,
}: {
  registrations: AdminRegistration[];
}) {
  return (
    <ul className="mt-6 space-y-4 lg:hidden">
      {registrations.map((registration) => (
        <li
          key={registration.id}
          className="rounded-[12px] border border-artis-border bg-artis-white p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-artis-gold">
                Registration #{registration.id}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-artis-navy">
                {registration.playerName}
              </h2>
            </div>
            <StatusBadge status={registration.status} />
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                Guardian
              </dt>
              <dd className="mt-1 text-sm font-medium text-artis-navy">
                {registration.guardianName}
              </dd>
              <dd className="mt-1 text-sm">
                <a
                  href={`mailto:${registration.guardianEmail}`}
                  className="block break-all text-artis-navy underline decoration-artis-gold underline-offset-4"
                >
                  {registration.guardianEmail}
                </a>
                <a
                  href={`tel:${registration.guardianPhone}`}
                  className="mt-1 block text-artis-navy underline decoration-artis-gold underline-offset-4"
                >
                  {registration.guardianPhone}
                </a>
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                Training
              </dt>
              <dd className="mt-1 text-sm font-medium text-artis-navy">
                {registration.trainingGroupName}
              </dd>
              <dd className="mt-1 text-sm leading-6 text-artis-slate">
                {formatProgramDates(registration.startsOn, registration.endsOn)}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                Package
              </dt>
              <dd className="mt-1 text-sm font-medium text-artis-navy">
                {registration.programPackageName}
              </dd>
              <dd className="mt-1 text-sm text-artis-slate">
                {formatCurrency(
                  registration.packagePriceCents,
                  registration.currency,
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                Timeline
              </dt>
              <dd className="mt-1 text-sm leading-6 text-artis-slate">
                Registered {formatDateTime(registration.createdAt)}
                <ReservationTiming registration={registration} />
                {registration.waitlistedAt ? (
                  <p>Waitlisted {formatDateTime(registration.waitlistedAt)}</p>
                ) : null}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-artis-slate">
                Payment
              </dt>
              <dd className="mt-1">
                <PaymentSummary registration={registration} />
              </dd>
            </div>
          </dl>

          {hasRegistrationActions(registration) ? (
            <div className="mt-5 border-t border-artis-border pt-5">
              <RegistrationActions registration={registration} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function buildPageHref(
  status: AdminRegistrationStatusFilter,
  search: string,
  page: number,
): string {
  const parameters = new URLSearchParams();

  if (status !== "current") {
    parameters.set("status", status);
  }

  if (search) {
    parameters.set("q", search);
  }

  if (page > 1) {
    parameters.set("page", String(page));
  }

  const query = parameters.toString();

  return query ? `/admin/registrations?${query}` : "/admin/registrations";
}

export default async function AdminRegistrationsPage({
  searchParams,
}: AdminRegistrationsPageProps) {
  const parameters = await searchParams;
  const result = await getAdminRegistrations({
    status: getFirstSearchParameter(parameters.status),
    search: getFirstSearchParameter(parameters.q),
    page: getFirstSearchParameter(parameters.page),
  });
  const { registrations, filters, pagination } = result;
  const firstVisibleItem =
    pagination.totalItems === 0
      ? 0
      : (pagination.currentPage - 1) * pagination.pageSize + 1;
  const lastVisibleItem = Math.min(
    pagination.currentPage * pagination.pageSize,
    pagination.totalItems,
  );
  const hasActiveFilters =
    filters.status !== "current" || filters.search.length > 0;

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
          Registrations
        </h1>

        <p className="mt-4 max-w-2xl text-[17px] leading-7 text-artis-slate">
          Find player registrations, review payment status and check program
          details.
        </p>

        <form
          action="/admin/registrations"
          method="get"
          className="mt-8 rounded-[12px] border border-artis-border bg-artis-white p-5 sm:p-6"
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(280px,1fr)_280px_auto] lg:items-end">
            <div>
              <label
                htmlFor="registration-search"
                className="block text-[13px] font-semibold text-artis-navy"
              >
                Search registrations
              </label>
              <input
                id="registration-search"
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
                htmlFor="registration-status"
                className="block text-[13px] font-semibold text-artis-navy"
              >
                Registration status
              </label>
              <select
                id="registration-status"
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
              href="/admin/registrations"
              className="mt-4 inline-flex text-sm font-semibold text-artis-navy underline decoration-artis-gold decoration-2 underline-offset-4"
            >
              Clear search and filters
            </Link>
          ) : null}
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <output className="text-sm text-artis-slate">
            Showing {firstVisibleItem}–{lastVisibleItem} of{" "}
            {pagination.totalItems} registrations
          </output>
          <p className="text-sm font-semibold text-artis-navy">
            {statusFilterLabels[filters.status]}
          </p>
        </div>

        {registrations.length > 0 ? (
          <>
            <RegistrationTable registrations={registrations} />
            <RegistrationCards registrations={registrations} />
          </>
        ) : (
          <div className="mt-6 rounded-[12px] border border-dashed border-artis-border bg-artis-white p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-artis-navy">
              No matching registrations
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-artis-slate">
              Try a different name, contact detail or status filter.
            </p>
            {hasActiveFilters ? (
              <Link
                href="/admin/registrations"
                className="mt-4 inline-flex text-sm font-semibold text-artis-navy underline decoration-artis-gold decoration-2 underline-offset-4"
              >
                View current registrations
              </Link>
            ) : null}
          </div>
        )}

        {pagination.totalPages > 1 ? (
          <nav
            aria-label="Registration pages"
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

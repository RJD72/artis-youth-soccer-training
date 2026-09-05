"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  rescheduleRegistrationAction,
  type RescheduleRegistrationActionErrorCode,
  type RescheduleRegistrationActionState,
} from "./actions";

type RescheduleRegistrationControlProps = {
  registrationId: number;
  playerName: string;
  currentStartsOn: string;
  earliestStartMonth: string;
  latestStartMonth: string;
};

const initialActionState: RescheduleRegistrationActionState = {
  status: "idle",
};

const reschedulingErrorMessages: Record<
  RescheduleRegistrationActionErrorCode,
  string
> = {
  "invalid-registration-id":
    "The registration identifier is invalid. Refresh the page and try again.",
  "invalid-start-month":
    "Choose a valid starting month before saving the change.",
  "start-month-too-early":
    "The starting month cannot be earlier than the current month.",
  "start-month-too-late":
    "The starting month cannot be more than 24 months in the future.",
  "registration-not-found":
    "This registration could not be found. Refresh the page before trying again.",
  "registration-not-reschedulable":
    "Only scheduled registrations can have their starting month changed.",
  "training-group-unavailable":
    "The registration’s training group is unavailable. No dates were changed.",
  "program-package-unavailable":
    "The registration’s program package is unavailable. No dates were changed.",
  "age-mismatch":
    "The player will not be within this training group’s age range on the selected start date.",
  "player-period-conflict":
    "The selected dates overlap another current registration for this player.",
  "training-group-full":
    "The training group is full during the selected period. Choose another starting month.",
  "unable-to-reschedule":
    "The dates could not be changed because of a server error. The original schedule remains unchanged.",
};

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "long",
  timeZone: "UTC",
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

export function RescheduleRegistrationControl({
  registrationId,
  playerName,
  currentStartsOn,
  earliestStartMonth,
  latestStartMonth,
}: RescheduleRegistrationControlProps) {
  const reschedulingDialog = useRef<HTMLDialogElement>(null);
  const [selectedMonth, setSelectedMonth] = useState(
    currentStartsOn.slice(0, 7),
  );
  const [state, formAction, isPending] = useActionState(
    rescheduleRegistrationAction,
    initialActionState,
  );
  const datesWereChanged =
    state.status === "success" && state.result === "rescheduled";

  useEffect(() => {
    if (state.status === "success") {
      reschedulingDialog.current?.close();
    }
  }, [state]);

  function openReschedulingDialog() {
    if (!datesWereChanged) {
      reschedulingDialog.current?.showModal();
    }
  }

  function closeReschedulingDialog() {
    if (!isPending) {
      reschedulingDialog.current?.close();
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openReschedulingDialog}
        disabled={datesWereChanged}
        className="min-h-11 w-full rounded-[10px] border border-artis-navy bg-artis-white px-4 py-2.5 text-sm font-semibold text-artis-navy transition hover:border-artis-gold hover:bg-artis-soft-gold/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/25 disabled:cursor-not-allowed disabled:border-artis-border disabled:text-artis-slate disabled:opacity-70"
      >
        {datesWereChanged ? "Start month updated" : "Change start month"}
      </button>

      {state.status === "success" ? (
        <output className="mt-2 block rounded-[8px] bg-artis-success/10 px-3 py-2 text-xs font-semibold leading-5 text-artis-success">
          {state.result === "unchanged" ? (
            "The selected month is already the registration’s starting month."
          ) : (
            <>
              Dates updated to {formatDate(state.startsOn)} through{" "}
              {formatDate(state.endsOn)}. The registration is now{" "}
              {state.registrationStatus}.
            </>
          )}
        </output>
      ) : null}

      <dialog
        ref={reschedulingDialog}
        aria-labelledby={`reschedule-registration-title-${registrationId}`}
        aria-describedby={`reschedule-registration-description-${registrationId}`}
        onCancel={(event) => {
          if (isPending) {
            event.preventDefault();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeReschedulingDialog();
          }
        }}
        className="m-auto w-[calc(100%_-_2rem)] max-w-[500px] overflow-hidden rounded-2xl border border-artis-border bg-artis-white p-0 text-artis-navy shadow-2xl backdrop:bg-artis-deep-navy/70"
      >
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-artis-gold">
            Schedule adjustment
          </p>

          <h2
            id={`reschedule-registration-title-${registrationId}`}
            className="mt-3 text-2xl font-bold tracking-tight"
          >
            Change {playerName}’s start month
          </h2>

          <div
            id={`reschedule-registration-description-${registrationId}`}
            className="mt-3 space-y-3 text-sm leading-6 text-artis-slate"
          >
            <p>The current starting date is {formatDate(currentStartsOn)}.</p>
            <p>
              The purchased package length and payment will stay unchanged. The
              ending date will be recalculated from the new starting month.
            </p>
          </div>

          <form action={formAction} className="mt-6">
            <input type="hidden" name="registrationId" value={registrationId} />
            <input
              type="hidden"
              name="startMonth"
              value={selectedMonth ? `${selectedMonth}-01` : ""}
            />

            <label
              htmlFor={`start-month-${registrationId}`}
              className="block text-sm font-semibold text-artis-navy"
            >
              New starting month
            </label>
            <input
              id={`start-month-${registrationId}`}
              type="month"
              value={selectedMonth}
              min={earliestStartMonth}
              max={latestStartMonth}
              required
              disabled={isPending}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="mt-2 h-[52px] w-full rounded-[10px] border border-artis-border bg-artis-white px-4 text-[15px] text-artis-navy outline-none focus:border-artis-gold focus:ring-2 focus:ring-artis-gold/20 disabled:cursor-wait disabled:opacity-70"
            />

            {state.status === "error" ? (
              <p
                className="mt-4 rounded-[10px] bg-artis-error/10 px-4 py-3 text-sm font-medium leading-6 text-artis-error"
                role="alert"
              >
                {reschedulingErrorMessages[state.code]}
              </p>
            ) : null}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={closeReschedulingDialog}
                disabled={isPending}
                className="min-h-12 rounded-[10px] border border-artis-border bg-artis-white px-4 py-3 text-sm font-semibold text-artis-navy transition hover:border-artis-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Keep current dates
              </button>

              <button
                type="submit"
                disabled={isPending || selectedMonth.length === 0}
                className="min-h-12 rounded-[10px] bg-artis-navy px-4 py-3 text-sm font-semibold text-artis-white transition hover:bg-artis-deep-navy focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/30 disabled:cursor-wait disabled:opacity-70"
              >
                {isPending ? "Saving…" : "Save new month"}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}

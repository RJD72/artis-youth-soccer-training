"use client";

import { useRef } from "react";

import { updateWaitlistEntryStatus } from "./actions";

type WaitlistEntryActionsProps = {
  entryId: number;
  entryStatus: string;
  childName: string;
};

export function WaitlistEntryActions({
  entryId,
  entryStatus,
  childName,
}: WaitlistEntryActionsProps) {
  const confirmationDialog = useRef<HTMLDialogElement>(null);
  const nextStatus = entryStatus === "waiting" ? "contacted" : "waiting";

  function openConfirmationDialog() {
    confirmationDialog.current?.showModal();
  }

  function closeConfirmationDialog() {
    confirmationDialog.current?.close();
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
      <form action={updateWaitlistEntryStatus}>
        <input type="hidden" name="waitlistEntryId" value={entryId} />
        <button
          type="submit"
          name="status"
          value={nextStatus}
          className="min-h-11 w-full rounded-[10px] bg-artis-navy px-4 py-2.5 text-sm font-semibold text-artis-white transition hover:bg-artis-deep-navy focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/30"
        >
          {entryStatus === "waiting"
            ? "Mark as contacted"
            : "Return to waiting"}
        </button>
      </form>

      <button
        type="button"
        onClick={openConfirmationDialog}
        className="min-h-11 w-full rounded-[10px] border border-artis-error bg-artis-white px-4 py-2.5 text-sm font-semibold text-artis-error transition hover:bg-artis-error/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-error/20"
      >
        Cancel entry
      </button>

      <dialog
        ref={confirmationDialog}
        aria-labelledby={`cancel-entry-title-${entryId}`}
        aria-describedby={`cancel-entry-description-${entryId}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeConfirmationDialog();
          }
        }}
        className="m-auto w-[calc(100%_-_2rem)] max-w-[460px] overflow-hidden rounded-2xl border border-artis-border bg-artis-white p-0 text-artis-navy shadow-2xl backdrop:bg-artis-deep-navy/70"
      >
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-artis-error">
            Confirm cancellation
          </p>

          <h2
            id={`cancel-entry-title-${entryId}`}
            className="mt-3 text-2xl font-bold tracking-tight"
          >
            Cancel {childName}’s waitlist entry?
          </h2>

          <p
            id={`cancel-entry-description-${entryId}`}
            className="mt-3 text-sm leading-6 text-artis-slate"
          >
            This removes the family from the active waitlist. The record will
            remain in the database with a cancelled status.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={closeConfirmationDialog}
              className="min-h-12 rounded-[10px] border border-artis-border bg-artis-white px-4 py-3 text-sm font-semibold text-artis-navy transition hover:border-artis-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/25"
            >
              Cancel
            </button>

            <form action={updateWaitlistEntryStatus}>
              <input type="hidden" name="waitlistEntryId" value={entryId} />
              <button
                type="submit"
                name="status"
                value="cancelled"
                className="min-h-12 w-full rounded-[10px] bg-artis-error px-4 py-3 text-sm font-semibold text-artis-white transition hover:bg-artis-error/85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-error/25"
              >
                Confirm
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  cancelRegistrationAction,
  type CancelRegistrationActionErrorCode,
  type CancelRegistrationActionState,
} from "./actions";

type CancelRegistrationControlProps = {
  registrationId: number;
  playerName: string;
  registrationStatus: "scheduled" | "active";
};

const initialActionState: CancelRegistrationActionState = { status: "idle" };

const cancellationErrorMessages: Record<
  CancelRegistrationActionErrorCode,
  string
> = {
  "invalid-registration-id":
    "The registration identifier is invalid. Refresh the page and try again.",
  "registration-not-found":
    "This registration could not be found. Refresh the page before trying again.",
  "registration-not-cancellable":
    "This registration is no longer scheduled or active and cannot be cancelled from this screen.",
  "unable-to-cancel":
    "The registration could not be cancelled because of a server error. No registration status was changed.",
};

function getCancellationEffect(
  registrationStatus: CancelRegistrationControlProps["registrationStatus"],
): string {
  return registrationStatus === "active"
    ? "The player will be removed from the active roster and their place will become available."
    : "The player will lose their scheduled place and that place will become available.";
}

export function CancelRegistrationControl({
  registrationId,
  playerName,
  registrationStatus,
}: CancelRegistrationControlProps) {
  const cancellationDialog = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(
    cancelRegistrationAction,
    initialActionState,
  );
  const registrationWasCancelled = state.status === "success";

  useEffect(() => {
    if (state.status === "success") {
      cancellationDialog.current?.close();
    }
  }, [state]);

  function openCancellationDialog() {
    if (!registrationWasCancelled) {
      cancellationDialog.current?.showModal();
    }
  }

  function closeCancellationDialog() {
    if (!isPending) {
      cancellationDialog.current?.close();
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openCancellationDialog}
        disabled={registrationWasCancelled}
        className="min-h-11 w-full rounded-[10px] border border-artis-error bg-artis-white px-4 py-2.5 text-sm font-semibold text-artis-error transition hover:bg-artis-error/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-error/20 disabled:cursor-not-allowed disabled:border-artis-border disabled:text-artis-slate disabled:opacity-70"
      >
        {registrationWasCancelled
          ? "Registration cancelled"
          : "Cancel registration"}
      </button>

      {state.status === "success" ? (
        <output
          className={`mt-2 block rounded-[8px] px-3 py-2 text-xs font-semibold leading-5 ${
            state.emailStatus === "failed"
              ? "bg-artis-soft-gold text-artis-navy"
              : "bg-artis-success/10 text-artis-success"
          }`}
        >
          {state.emailStatus === "failed" ? (
            <>
              Registration cancelled, but the guardian notification email could
              not be sent. Contact the family manually, then refresh this page.
            </>
          ) : state.result === "already-cancelled" ? (
            "This registration was already cancelled. No duplicate email was sent."
          ) : (
            "Registration cancelled successfully. The guardian notification email was sent."
          )}
        </output>
      ) : null}

      <dialog
        ref={cancellationDialog}
        aria-labelledby={`cancel-registration-title-${registrationId}`}
        aria-describedby={`cancel-registration-description-${registrationId}`}
        onCancel={(event) => {
          if (isPending) {
            event.preventDefault();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeCancellationDialog();
          }
        }}
        className="m-auto w-[calc(100%_-_2rem)] max-w-[500px] overflow-hidden rounded-2xl border border-artis-border bg-artis-white p-0 text-artis-navy shadow-2xl backdrop:bg-artis-deep-navy/70"
      >
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-artis-error">
            Registration cancellation
          </p>

          <h2
            id={`cancel-registration-title-${registrationId}`}
            className="mt-3 text-2xl font-bold tracking-tight"
          >
            Cancel {playerName}’s registration?
          </h2>

          <div
            id={`cancel-registration-description-${registrationId}`}
            className="mt-3 space-y-3 text-sm leading-6 text-artis-slate"
          >
            <p>{getCancellationEffect(registrationStatus)}</p>
            <p>
              The registration and its payment record will remain in the admin
              history. This action does not change the recorded payment.
            </p>
          </div>

          {state.status === "error" ? (
            <p
              className="mt-4 rounded-[10px] bg-artis-error/10 px-4 py-3 text-sm font-medium leading-6 text-artis-error"
              role="alert"
            >
              {cancellationErrorMessages[state.code]}
            </p>
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={closeCancellationDialog}
              disabled={isPending}
              className="min-h-12 rounded-[10px] border border-artis-border bg-artis-white px-4 py-3 text-sm font-semibold text-artis-navy transition hover:border-artis-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Keep registration
            </button>

            <form action={formAction}>
              <input
                type="hidden"
                name="registrationId"
                value={registrationId}
              />
              <button
                type="submit"
                disabled={isPending}
                className="min-h-12 w-full rounded-[10px] bg-artis-error px-4 py-3 text-sm font-semibold text-artis-white transition hover:bg-artis-error/85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-error/25 disabled:cursor-wait disabled:opacity-70"
              >
                {isPending ? "Cancelling…" : "Cancel registration"}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  );
}

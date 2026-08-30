"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  confirmETransferPaymentAction,
  type ConfirmETransferActionErrorCode,
  type ConfirmETransferActionState,
} from "./actions";

type ConfirmETransferControlProps = {
  registrationId: number;
  paymentId: number;
  playerName: string;
  amountLabel: string;
  paymentReference: string | null;
};

const initialActionState: ConfirmETransferActionState = { status: "idle" };

const confirmationErrorMessages: Record<
  ConfirmETransferActionErrorCode,
  string
> = {
  "invalid-identifiers":
    "The registration or payment identifier is invalid. Refresh the page and try again.",
  "payment-not-found":
    "This pending e-transfer payment could not be found. Refresh the page before trying again.",
  "payment-already-resolved":
    "This payment has already been completed, cancelled or otherwise resolved.",
  "registration-not-confirmable":
    "This registration is no longer in a status that allows payment confirmation.",
  "registration-period-invalid":
    "This registration does not have a valid training period and cannot be confirmed.",
  "registration-period-ended":
    "This registration’s training period has already ended and cannot be activated.",
  "training-group-unavailable":
    "The training group is unavailable. Check the registration before confirming payment.",
  "training-group-full":
    "The original reservation expired and the training group is now full. Do not confirm this payment from this screen.",
  "unable-to-confirm":
    "The payment could not be confirmed because of a server error. No payment status was changed.",
};

function formatRegistrationStatus(status: "scheduled" | "active" | "expired") {
  switch (status) {
    case "scheduled":
      return "scheduled";
    case "active":
      return "active";
    case "expired":
      return "expired";
  }
}

export function ConfirmETransferControl({
  registrationId,
  paymentId,
  playerName,
  amountLabel,
  paymentReference,
}: ConfirmETransferControlProps) {
  const confirmationDialog = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(
    confirmETransferPaymentAction,
    initialActionState,
  );
  const paymentWasConfirmed = state.status === "success";

  useEffect(() => {
    if (state.status === "success") {
      confirmationDialog.current?.close();
    }
  }, [state]);

  function openConfirmationDialog() {
    if (!paymentWasConfirmed) {
      confirmationDialog.current?.showModal();
    }
  }

  function closeConfirmationDialog() {
    if (!isPending) {
      confirmationDialog.current?.close();
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={openConfirmationDialog}
        disabled={paymentWasConfirmed}
        className="min-h-11 w-full rounded-[10px] bg-artis-navy px-4 py-2.5 text-sm font-semibold text-artis-white transition hover:bg-artis-deep-navy focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/30 disabled:cursor-not-allowed disabled:bg-artis-slate disabled:opacity-70"
      >
        {paymentWasConfirmed ? "Payment confirmed" : "Confirm e-transfer"}
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
              Payment confirmed and registration is now{" "}
              {formatRegistrationStatus(state.registrationStatus)}, but the
              confirmation email could not be sent. Contact the family manually,
              then refresh this page.
            </>
          ) : (
            <>
              Payment confirmed. Registration is now{" "}
              {formatRegistrationStatus(state.registrationStatus)}.
              {state.emailStatus === "sent"
                ? " The confirmation email was sent."
                : " No duplicate email was sent."}
            </>
          )}
        </output>
      ) : null}

      <dialog
        ref={confirmationDialog}
        aria-labelledby={`confirm-e-transfer-title-${registrationId}`}
        aria-describedby={`confirm-e-transfer-description-${registrationId}`}
        onCancel={(event) => {
          if (isPending) {
            event.preventDefault();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeConfirmationDialog();
          }
        }}
        className="m-auto w-[calc(100%_-_2rem)] max-w-[500px] overflow-hidden rounded-2xl border border-artis-border bg-artis-white p-0 text-artis-navy shadow-2xl backdrop:bg-artis-deep-navy/70"
      >
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-artis-gold">
            Verify payment received
          </p>

          <h2
            id={`confirm-e-transfer-title-${registrationId}`}
            className="mt-3 text-2xl font-bold tracking-tight"
          >
            Confirm {playerName}’s e-transfer?
          </h2>

          <p
            id={`confirm-e-transfer-description-${registrationId}`}
            className="mt-3 text-sm leading-6 text-artis-slate"
          >
            Confirm only after matching this payment with the academy’s bank
            account. This will mark the payment as successful and activate or
            schedule the registration.
          </p>

          <dl className="mt-5 rounded-[10px] bg-artis-off-white p-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="font-medium text-artis-slate">Amount</dt>
              <dd className="font-semibold text-artis-navy">{amountLabel}</dd>
            </div>
            <div className="mt-3 flex items-start justify-between gap-4 border-t border-artis-border pt-3">
              <dt className="font-medium text-artis-slate">Reference</dt>
              <dd className="break-all text-right font-semibold text-artis-navy">
                {paymentReference ?? "Not available"}
              </dd>
            </div>
          </dl>

          {state.status === "error" ? (
            <p
              className="mt-4 rounded-[10px] bg-artis-error/10 px-4 py-3 text-sm font-medium leading-6 text-artis-error"
              role="alert"
            >
              {confirmationErrorMessages[state.code]}
            </p>
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={closeConfirmationDialog}
              disabled={isPending}
              className="min-h-12 rounded-[10px] border border-artis-border bg-artis-white px-4 py-3 text-sm font-semibold text-artis-navy transition hover:border-artis-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <form action={formAction}>
              <input
                type="hidden"
                name="registrationId"
                value={registrationId}
              />
              <input type="hidden" name="paymentId" value={paymentId} />
              <button
                type="submit"
                disabled={isPending}
                className="min-h-12 w-full rounded-[10px] bg-artis-success px-4 py-3 text-sm font-semibold text-artis-white transition hover:bg-artis-success/85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-success/25 disabled:cursor-wait disabled:opacity-70"
              >
                {isPending ? "Confirming…" : "Confirm payment"}
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  );
}

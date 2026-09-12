"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import {
  offerWaitlistSpot,
  sendWaitlistEntryEmail,
  type WaitlistEmailActionState,
  updateWaitlistEntryStatus,
} from "./actions";

type WaitlistEntryActionsProps = {
  entryId: number;
  entryStatus: string;
  childName: string;
};

const initialEmailActionState: WaitlistEmailActionState = {
  status: "idle",
  message: "",
};

export function WaitlistEntryActions({
  entryId,
  entryStatus,
  childName,
}: WaitlistEntryActionsProps) {
  const router = useRouter();

  const confirmationDialog = useRef<HTMLDialogElement>(null);
  const emailDialog = useRef<HTMLDialogElement>(null);
  const offerDialog = useRef<HTMLDialogElement>(null);
  const convertedDialog = useRef<HTMLDialogElement>(null);

  const [emailState, emailAction, emailPending] = useActionState(
    sendWaitlistEntryEmail,
    initialEmailActionState,
  );

  const [offerState, offerAction, offerPending] = useActionState(
    offerWaitlistSpot,
    initialEmailActionState,
  );

  const nextStatus = entryStatus === "waiting" ? "contacted" : "waiting";

  useEffect(() => {
    if (emailState.status === "success") {
      emailDialog.current?.close();
    }
  }, [emailState.status]);

  useEffect(() => {
    if (offerState.status === "success") {
      offerDialog.current?.close();
      router.refresh();
    }
  }, [offerState.status, router]);

  function openConfirmationDialog() {
    confirmationDialog.current?.showModal();
  }

  function closeConfirmationDialog() {
    confirmationDialog.current?.close();
  }

  function openEmailDialog() {
    emailDialog.current?.showModal();
  }

  function closeEmailDialog() {
    if (!emailPending) {
      emailDialog.current?.close();
    }
  }

  function openOfferDialog() {
    offerDialog.current?.showModal();
  }

  function closeOfferDialog() {
    if (!offerPending) {
      offerDialog.current?.close();
    }
  }

  function openConvertedDialog() {
    convertedDialog.current?.showModal();
  }

  function closeConvertedDialog() {
    convertedDialog.current?.close();
  }

  return (
    <div className="flex flex-col gap-3">
      {entryStatus === "waiting" ? (
        <>
          <button
            type="button"
            onClick={openOfferDialog}
            className="min-h-11 w-full rounded-[10px] bg-artis-gold px-4 py-2.5 text-sm font-semibold text-artis-deep-navy transition hover:bg-artis-gold/85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/30"
          >
            Offer spot
          </button>

          {offerState.status !== "idle" ? (
            <output
              aria-live="polite"
              className={`text-sm ${
                offerState.status === "success"
                  ? "text-artis-success"
                  : "text-artis-error"
              }`}
            >
              {offerState.message}
            </output>
          ) : null}
        </>
      ) : null}

      <button
        type="button"
        onClick={openEmailDialog}
        className="min-h-11 w-full rounded-[10px] border border-artis-navy bg-artis-white px-4 py-2.5 text-sm font-semibold text-artis-navy transition hover:bg-artis-navy/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/30"
      >
        Email parent/guardian
      </button>

      {emailState.status !== "idle" ? (
        <output
          aria-live="polite"
          className={`text-sm ${
            emailState.status === "success"
              ? "text-artis-success"
              : "text-artis-error"
          }`}
        >
          {emailState.message}
        </output>
      ) : null}

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

      {entryStatus === "contacted" ? (
        <button
          type="button"
          onClick={openConvertedDialog}
          className="min-h-11 w-full rounded-[10px] bg-artis-success px-4 py-2.5 text-sm font-semibold text-artis-white transition hover:bg-artis-success/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-success/25"
        >
          Mark as converted
        </button>
      ) : null}

      <button
        type="button"
        onClick={openConfirmationDialog}
        className="min-h-11 w-full rounded-[10px] border border-artis-error bg-artis-white px-4 py-2.5 text-sm font-semibold text-artis-error transition hover:bg-artis-error/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-error/20"
      >
        Cancel entry
      </button>

      <dialog
        ref={offerDialog}
        aria-labelledby={`offer-spot-title-${entryId}`}
        aria-describedby={`offer-spot-description-${entryId}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeOfferDialog();
          }
        }}
        className="m-auto w-[calc(100%_-_2rem)] max-w-[520px] overflow-hidden rounded-2xl border border-artis-border bg-artis-white p-0 text-artis-navy shadow-2xl backdrop:bg-artis-deep-navy/70"
      >
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-artis-gold">
            Waitlist spot
          </p>

          <h2
            id={`offer-spot-title-${entryId}`}
            className="mt-3 text-2xl font-bold tracking-tight"
          >
            Offer a spot to {childName}?
          </h2>

          <p
            id={`offer-spot-description-${entryId}`}
            className="mt-3 text-sm leading-6 text-artis-slate"
          >
            ARTIS Soccer Academy will email the parent or guardian letting them
            know that a spot is available. If the email sends successfully, this
            waitlist entry will automatically be marked as contacted.
          </p>

          {offerState.status === "error" ? (
            <output
              aria-live="polite"
              className="mt-4 block text-sm font-medium text-artis-error"
            >
              {offerState.message}
            </output>
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={closeOfferDialog}
              disabled={offerPending}
              className="min-h-12 rounded-[10px] border border-artis-border bg-artis-white px-4 py-3 text-sm font-semibold text-artis-navy transition hover:border-artis-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <form action={offerAction}>
              <input type="hidden" name="waitlistEntryId" value={entryId} />

              <button
                type="submit"
                disabled={offerPending}
                className="min-h-12 w-full rounded-[10px] bg-artis-gold px-4 py-3 text-sm font-semibold text-artis-deep-navy transition hover:bg-artis-gold/85 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {offerPending ? "Sending..." : "Send offer"}
              </button>
            </form>
          </div>
        </div>
      </dialog>

      <dialog
        ref={emailDialog}
        aria-labelledby={`email-entry-title-${entryId}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeEmailDialog();
          }
        }}
        className="m-auto w-[calc(100%_-_2rem)] max-w-[560px] overflow-hidden rounded-2xl border border-artis-border bg-artis-white p-0 text-artis-navy shadow-2xl backdrop:bg-artis-deep-navy/70"
      >
        <form action={emailAction} className="p-6 sm:p-8">
          <input type="hidden" name="waitlistEntryId" value={entryId} />

          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-artis-gold">
            Parent communication
          </p>

          <h2
            id={`email-entry-title-${entryId}`}
            className="mt-3 text-2xl font-bold tracking-tight"
          >
            Email {childName}’s parent or guardian
          </h2>

          <p className="mt-3 text-sm leading-6 text-artis-slate">
            The email will be sent to the guardian address stored with this
            waitlist entry.
          </p>

          <div className="mt-6">
            <label
              htmlFor={`email-subject-${entryId}`}
              className="text-sm font-semibold text-artis-navy"
            >
              Subject
            </label>

            <input
              id={`email-subject-${entryId}`}
              name="subject"
              type="text"
              required
              minLength={2}
              maxLength={150}
              disabled={emailPending}
              className="mt-2 min-h-12 w-full rounded-[10px] border border-artis-border bg-artis-white px-4 py-3 text-sm text-artis-navy outline-none transition focus:border-artis-gold focus:ring-4 focus:ring-artis-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor={`email-message-${entryId}`}
              className="text-sm font-semibold text-artis-navy"
            >
              Message
            </label>

            <textarea
              id={`email-message-${entryId}`}
              name="message"
              required
              minLength={2}
              maxLength={5000}
              rows={8}
              disabled={emailPending}
              className="mt-2 w-full resize-y rounded-[10px] border border-artis-border bg-artis-white px-4 py-3 text-sm leading-6 text-artis-navy outline-none transition focus:border-artis-gold focus:ring-4 focus:ring-artis-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {emailState.status === "error" ? (
            <output
              aria-live="polite"
              className="mt-4 block text-sm font-medium text-artis-error"
            >
              {emailState.message}
            </output>
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={closeEmailDialog}
              disabled={emailPending}
              className="min-h-12 rounded-[10px] border border-artis-border bg-artis-white px-4 py-3 text-sm font-semibold text-artis-navy transition hover:border-artis-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={emailPending}
              className="min-h-12 rounded-[10px] bg-artis-navy px-4 py-3 text-sm font-semibold text-artis-white transition hover:bg-artis-deep-navy focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {emailPending ? "Sending..." : "Send email"}
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={convertedDialog}
        aria-labelledby={`converted-entry-title-${entryId}`}
        aria-describedby={`converted-entry-description-${entryId}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeConvertedDialog();
          }
        }}
        className="m-auto w-[calc(100%_-_2rem)] max-w-[480px] overflow-hidden rounded-2xl border border-artis-border bg-artis-white p-0 text-artis-navy shadow-2xl backdrop:bg-artis-deep-navy/70"
      >
        <div className="p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-artis-success">
            Confirm registration
          </p>

          <h2
            id={`converted-entry-title-${entryId}`}
            className="mt-3 text-2xl font-bold tracking-tight"
          >
            Mark {childName} as converted?
          </h2>

          <p
            id={`converted-entry-description-${entryId}`}
            className="mt-3 text-sm leading-6 text-artis-slate"
          >
            Only mark this waitlist entry as converted after the player has
            completed registration and payment. This action does not create a
            registration or payment record.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={closeConvertedDialog}
              className="min-h-12 rounded-[10px] border border-artis-border bg-artis-white px-4 py-3 text-sm font-semibold text-artis-navy transition hover:border-artis-gold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-gold/25"
            >
              Go back
            </button>

            <form action={updateWaitlistEntryStatus}>
              <input type="hidden" name="waitlistEntryId" value={entryId} />

              <button
                type="submit"
                name="status"
                value="converted"
                className="min-h-12 w-full rounded-[10px] bg-artis-success px-4 py-3 text-sm font-semibold text-artis-white transition hover:bg-artis-success/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-artis-success/25"
              >
                Confirm converted
              </button>
            </form>
          </div>
        </div>
      </dialog>

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

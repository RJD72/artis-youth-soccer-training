"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  requestRenewalVerification,
  type RenewalRequestActionState,
} from "./actions";

const initialActionState: RenewalRequestActionState = { status: "idle" };

const fieldClassName =
  "h-[52px] w-full rounded-[10px] border border-artis-border bg-artis-white px-4 py-3.5 text-[15px] leading-5 text-artis-navy outline-none placeholder:text-artis-slate focus:border-artis-navy focus:ring-2 focus:ring-artis-gold disabled:cursor-not-allowed disabled:bg-artis-off-white disabled:opacity-70";

const errorMessages = {
  "invalid-form": "Please check the information you entered and try again.",
  "unable-to-submit":
    "We could not process the request right now. Please try again shortly.",
} as const;

function FormField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-semibold leading-5">
        {label} *
      </label>
      {hint ? (
        <p id={hintId} className="mt-1 text-xs leading-[18px] text-artis-slate">
          {hint}
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function RenewalRequestForm() {
  const [guardianEmail, setGuardianEmail] = useState("");
  const [playerFullName, setPlayerFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [actionState, formAction, isPending] = useActionState(
    requestRenewalVerification,
    initialActionState,
  );

  const statusMessage =
    actionState.status === "submitted"
      ? "If the information matches our records, a renewal link has been sent to the guardian email address. Please check the inbox and junk folder."
      : actionState.status === "error"
        ? errorMessages[actionState.code]
        : null;
  const statusClassName =
    actionState.status === "submitted"
      ? "border-artis-success text-artis-success"
      : "border-artis-error text-artis-error";

  return (
    <form
      action={formAction}
      aria-describedby={statusMessage ? "renewal-request-status" : undefined}
      className="relative w-full rounded-[12px] border border-artis-border bg-artis-white p-5 xl:p-10"
    >
      <h1 className="text-[36px] font-bold leading-[44px] tracking-[-1px] xl:text-[48px] xl:leading-[58px] xl:tracking-[-1.5px]">
        Renew Your Training
      </h1>

      <p className="mt-3 max-w-[640px] text-base leading-[26px] text-artis-slate xl:text-[17px] xl:leading-[25px]">
        Enter the information used for the player’s original registration. We
        will email the guardian a secure link to continue.
      </p>

      {statusMessage ? (
        <output
          id="renewal-request-status"
          aria-live="polite"
          className={`mt-5 block rounded-[10px] border bg-artis-white px-4 py-3 text-sm leading-6 ${statusClassName}`}
        >
          {statusMessage}
        </output>
      ) : null}

      <div
        aria-hidden="true"
        className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
      >
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          autoComplete="off"
          tabIndex={-1}
        />
      </div>

      <div className="mt-6 space-y-[18px]">
        <FormField id="guardian-email" label="Guardian email address">
          <input
            id="guardian-email"
            name="guardianEmail"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
            disabled={isPending}
            value={guardianEmail}
            onChange={(event) => setGuardianEmail(event.target.value)}
            placeholder="Enter the email used to register"
            className={fieldClassName}
          />
        </FormField>

        <FormField
          id="player-full-name"
          label="Player’s full name"
          hint="Enter the name exactly as it appears on the original registration."
        >
          <input
            id="player-full-name"
            name="playerFullName"
            type="text"
            autoComplete="off"
            minLength={2}
            maxLength={100}
            required
            disabled={isPending}
            value={playerFullName}
            onChange={(event) => setPlayerFullName(event.target.value)}
            aria-describedby="player-full-name-hint"
            placeholder="Enter the player’s full name"
            className={fieldClassName}
          />
        </FormField>

        <FormField id="date-of-birth" label="Player’s date of birth">
          <input
            id="date-of-birth"
            name="dateOfBirth"
            type="date"
            autoComplete="bday"
            required
            disabled={isPending}
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
            className={fieldClassName}
          />
        </FormField>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-white transition-opacity disabled:opacity-60 xl:w-auto"
      >
        {isPending ? "Sending…" : "Email Renewal Link"}
      </button>

      <p className="mt-4 max-w-[640px] text-[13px] leading-5 text-artis-slate">
        For privacy, this page will show the same confirmation whether or not
        the information matches an existing player. Renewal links expire after
        30 minutes.
      </p>

      <Link
        href="/register"
        className="mt-5 inline-flex text-sm font-semibold leading-5 text-artis-navy underline decoration-artis-border underline-offset-4 hover:decoration-artis-navy"
      >
        Back to Registration
      </Link>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";

import {
  submitRenewal,
  type RenewalCheckoutActionErrorCode,
  type RenewalCheckoutActionState,
} from "./actions";

type RenewalProgramPackage = {
  id: number;
  slug: string;
  displayName: string;
  durationMonths: number;
  priceCents: number;
  currency: string;
  taxBehavior: "exclusive" | "inclusive";
};

type RenewalCheckoutFormProps = {
  token: string;
  playerName: string;
  paidThrough: string | null;
  renewsOn: string;
  trainingGroup: {
    slug: string;
    displayName: string;
  };
  programPackages: RenewalProgramPackage[];
};

type ConsentState = {
  authorizedRegistrantConfirmed: boolean;
  informationAccuracyConfirmed: boolean;
  termsAccepted: boolean;
  participationWaiverAccepted: boolean;
  gymRulesAccepted: boolean;
  marketingConsent: boolean;
  photoVideoConsent: boolean;
};

type ConsentName = keyof ConsentState;

type DisplayPricing = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

const initialActionState: RenewalCheckoutActionState = { status: "idle" };

const initialConsentState: ConsentState = {
  authorizedRegistrantConfirmed: false,
  informationAccuracyConfirmed: false,
  termsAccepted: false,
  participationWaiverAccepted: false,
  gymRulesAccepted: false,
  marketingConsent: false,
  photoVideoConsent: false,
};

const renewalErrorMessages: Record<RenewalCheckoutActionErrorCode, string> = {
  "invalid-form":
    "Please choose a program term and complete every required confirmation.",
  "unable-to-submit":
    "We could not create the renewal right now. Please wait a moment and try again.",
  "invalid-token":
    "This renewal link has expired or has already been used. Please request a new link.",
  "invalid-submission":
    "The renewal information could not be validated. Please review the form and try again.",
  "invalid-selection":
    "The selected program term is no longer available. Please choose another option.",
  "payment-pending":
    "This player already has a payment waiting to be completed. Please finish that payment before starting another renewal.",
  "upcoming-registration":
    "This player already has an upcoming registration period. Another renewal cannot be added yet.",
  "registration-history-unavailable":
    "We could not find a completed registration that can be renewed. Please contact ARTIS Soccer Academy.",
  "age-mismatch":
    "The player will not meet this training group’s age requirements when the renewal begins.",
  "legal-documents-unavailable":
    "Renewal is temporarily unavailable while the required policies are being updated.",
  "group-full":
    "This training group has reached capacity for the selected renewal period.",
};

function formatCurrency(priceCents: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceCents / 100);
}

function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(
    new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    ),
  );
}

function formatPackageDuration(durationMonths: number): string {
  if (durationMonths === 12) {
    return "1 year";
  }

  return `${durationMonths} month${durationMonths === 1 ? "" : "s"}`;
}

function calculateDisplayPricing(
  programPackage: RenewalProgramPackage,
): DisplayPricing {
  if (programPackage.taxBehavior === "exclusive") {
    const taxCents = Math.round(programPackage.priceCents * 0.13);

    return {
      subtotalCents: programPackage.priceCents,
      taxCents,
      totalCents: programPackage.priceCents + taxCents,
    };
  }

  const taxCents = Math.round(programPackage.priceCents * (13 / 113));

  return {
    subtotalCents: programPackage.priceCents - taxCents,
    taxCents,
    totalCents: programPackage.priceCents,
  };
}

function CheckboxField({
  id,
  name,
  checked,
  required = false,
  disabled,
  onChange,
  children,
}: {
  id: string;
  name: ConsentName;
  checked: boolean;
  required?: boolean;
  disabled: boolean;
  onChange: (name: ConsentName, checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        value="accepted"
        checked={checked}
        required={required}
        disabled={disabled}
        onChange={(event) => onChange(name, event.currentTarget.checked)}
        className="mt-0.5 size-5 shrink-0 rounded-[5px] border-artis-border accent-artis-navy disabled:cursor-not-allowed"
      />
      <label htmlFor={id} className="text-sm leading-[21px]">
        {children}
      </label>
    </div>
  );
}

function PackageSelection({
  programPackages,
  selectedPackageId,
  disabled,
  onChange,
}: {
  programPackages: RenewalProgramPackage[];
  selectedPackageId: number;
  disabled: boolean;
  onChange: (packageId: number) => void;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-[21px] font-semibold leading-[30px]">
        Choose your renewal term
      </legend>
      <p className="mt-1.5 text-sm leading-5 text-artis-slate">
        Your renewed training begins after the player’s latest paid period.
      </p>

      <div className="mt-[18px] grid gap-3 sm:grid-cols-2">
        {programPackages.map((programPackage) => {
          const selected = programPackage.id === selectedPackageId;

          return (
            <label
              key={programPackage.id}
              className={`flex min-h-[112px] cursor-pointer items-start gap-3 rounded-[10px] border p-4 transition-colors focus-within:ring-2 focus-within:ring-artis-gold disabled:pointer-events-none ${
                selected
                  ? "border-artis-navy bg-artis-navy text-artis-white"
                  : "border-artis-border bg-artis-white hover:border-artis-navy"
              }`}
            >
              <input
                type="radio"
                name="programPackageId"
                value={programPackage.id}
                checked={selected}
                onChange={() => onChange(programPackage.id)}
                required
                className="mt-1 size-5 shrink-0 accent-artis-gold"
              />
              <span>
                <span className="block text-[15px] font-semibold leading-5">
                  {programPackage.displayName}
                </span>
                <span className="mt-1.5 block text-xl font-bold leading-7">
                  {formatCurrency(
                    programPackage.priceCents,
                    programPackage.currency,
                  )}
                </span>
                <span
                  className={`mt-1 block text-xs leading-[18px] ${
                    selected ? "text-artis-white/75" : "text-artis-slate"
                  }`}
                >
                  {formatPackageDuration(programPackage.durationMonths)} ·{" "}
                  {programPackage.taxBehavior === "exclusive"
                    ? "plus HST"
                    : "HST included"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function OrderSummary({
  playerName,
  paidThrough,
  renewsOn,
  trainingGroup,
  programPackage,
}: {
  playerName: string;
  paidThrough: string | null;
  renewsOn: string;
  trainingGroup: RenewalCheckoutFormProps["trainingGroup"];
  programPackage: RenewalProgramPackage;
}) {
  const pricing = calculateDisplayPricing(programPackage);

  return (
    <aside className="rounded-[12px] border border-artis-border bg-artis-white p-6 xl:sticky xl:top-6 xl:p-7">
      <h2 className="text-2xl font-bold leading-[35px]">Order summary</h2>

      <p className="mt-[18px] text-base font-semibold leading-[23px]">
        {trainingGroup.displayName} Soccer Development Program
      </p>

      <dl className="mt-[18px] space-y-3 text-sm leading-5 text-artis-slate">
        <div>
          <dt className="inline">Player: </dt>
          <dd className="inline text-artis-navy">{playerName}</dd>
        </div>
        <div>
          <dt className="inline">Package: </dt>
          <dd className="inline text-artis-navy">
            {programPackage.displayName}
          </dd>
        </div>
        {paidThrough ? (
          <div>
            <dt className="inline">Current training paid through: </dt>
            <dd className="inline text-artis-navy">
              {formatCalendarDate(paidThrough)}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="inline">Renewal begins: </dt>
          <dd className="inline font-semibold text-artis-navy">
            {formatCalendarDate(renewsOn)}
          </dd>
        </div>
      </dl>

      <dl className="mt-[22px] space-y-2 text-base leading-[23px]">
        <div className="flex items-center justify-between gap-4">
          <dt>Subtotal</dt>
          <dd>
            {formatCurrency(pricing.subtotalCents, programPackage.currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt>HST</dt>
          <dd>{formatCurrency(pricing.taxCents, programPackage.currency)}</dd>
        </div>
        <div className="mt-3 flex items-center justify-between gap-4 border-t border-artis-slate pt-3 font-semibold">
          <dt>Total</dt>
          <dd>{formatCurrency(pricing.totalCents, programPackage.currency)}</dd>
        </div>
      </dl>

      <p className="mt-[18px] text-[13px] leading-5 text-artis-slate">
        The database recalculates the final price, dates, eligibility, and
        available capacity before reserving this renewal.
      </p>
    </aside>
  );
}

export default function RenewalCheckoutForm({
  token,
  playerName,
  paidThrough,
  renewsOn,
  trainingGroup,
  programPackages,
}: RenewalCheckoutFormProps) {
  const [selectedPackageId, setSelectedPackageId] = useState(
    programPackages[0]?.id ?? 0,
  );
  const [consents, setConsents] = useState(initialConsentState);
  const [actionState, formAction, isPending] = useActionState(
    submitRenewal,
    initialActionState,
  );
  const selectedPackage = programPackages.find(
    (programPackage) => programPackage.id === selectedPackageId,
  );

  function updateConsent(name: ConsentName, checked: boolean): void {
    setConsents((current) => ({ ...current, [name]: checked }));
  }

  if (!selectedPackage) {
    return (
      <section className="rounded-[12px] border border-artis-border bg-artis-white p-5 xl:p-10">
        <h1 className="text-[38px] font-bold leading-[48px]">Renew Training</h1>
        <p className="mt-3 text-[17px] leading-[25px] text-artis-slate">
          Renewal packages are not currently available. Please try again later.
        </p>
      </section>
    );
  }

  return (
    <form
      action={formAction}
      aria-describedby={
        actionState.status === "error" ? "renewal-checkout-status" : undefined
      }
      className="grid items-start gap-7 xl:grid-cols-[minmax(0,720px)_480px] xl:gap-16"
    >
      <input type="hidden" name="token" value={token} />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[10000px] top-auto size-px overflow-hidden"
      >
        <label htmlFor="renewal-website">Website</label>
        <input
          id="renewal-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <section className="order-2 rounded-[12px] border border-artis-border bg-artis-white p-5 xl:order-1 xl:p-10">
        <h1 className="text-[36px] font-bold leading-[44px] tracking-[-1px] xl:text-[38px] xl:leading-[55px]">
          Renew Training
        </h1>
        <p className="mt-3 text-base leading-6 text-artis-slate xl:text-[17px] xl:leading-[25px]">
          Review the renewal details, choose a program term, and continue to
          payment.
        </p>

        {actionState.status === "error" ? (
          <output
            id="renewal-checkout-status"
            aria-live="polite"
            className="mt-[22px] block rounded-[10px] border border-artis-error bg-[#fbeded] px-4 py-3 text-sm leading-6 text-artis-error"
          >
            <span className="font-semibold">Please review:</span>{" "}
            {renewalErrorMessages[actionState.code]}
          </output>
        ) : null}

        <div className="mt-[22px]">
          <PackageSelection
            programPackages={programPackages}
            selectedPackageId={selectedPackageId}
            disabled={isPending}
            onChange={setSelectedPackageId}
          />
        </div>

        <section className="mt-[22px] border-t border-artis-border pt-[22px]">
          <h2 className="text-[21px] font-semibold leading-[30px]">
            Consent and policies
          </h2>
          <p className="mt-1.5 text-sm leading-5 text-artis-slate">
            Required confirmations must be renewed for this registration period.
            Optional consent choices remain separate.
          </p>

          <div className="mt-[18px] space-y-[18px]">
            <CheckboxField
              id="renewal-authorized"
              name="authorizedRegistrantConfirmed"
              checked={consents.authorizedRegistrantConfirmed}
              required
              disabled={isPending}
              onChange={updateConsent}
            >
              I confirm that I am the player’s parent or legal guardian, or I am
              authorized to renew this player. *
            </CheckboxField>
            <CheckboxField
              id="renewal-information-accuracy"
              name="informationAccuracyConfirmed"
              checked={consents.informationAccuracyConfirmed}
              required
              disabled={isPending}
              onChange={updateConsent}
            >
              I confirm that the player and guardian information already on file
              remains accurate. *
            </CheckboxField>
            <CheckboxField
              id="renewal-terms"
              name="termsAccepted"
              checked={consents.termsAccepted}
              required
              disabled={isPending}
              onChange={updateConsent}
            >
              I agree to the Terms and Conditions. *{" "}
              <Link href="/terms" className="font-semibold underline">
                View Terms and Conditions
              </Link>
            </CheckboxField>
            <CheckboxField
              id="renewal-waiver"
              name="participationWaiverAccepted"
              checked={consents.participationWaiverAccepted}
              required
              disabled={isPending}
              onChange={updateConsent}
            >
              I acknowledge the Participation Waiver. *{" "}
              <Link href="/waiver" className="font-semibold underline">
                View Participation Waiver
              </Link>
            </CheckboxField>
            <CheckboxField
              id="renewal-gym-rules"
              name="gymRulesAccepted"
              checked={consents.gymRulesAccepted}
              required
              disabled={isPending}
              onChange={updateConsent}
            >
              I acknowledge the Gym or Facility Rules. *{" "}
              <Link href="/gym-rules" className="font-semibold underline">
                View Gym Rules
              </Link>
            </CheckboxField>
            <CheckboxField
              id="renewal-marketing"
              name="marketingConsent"
              checked={consents.marketingConsent}
              disabled={isPending}
              onChange={updateConsent}
            >
              <span className="text-artis-slate">
                I would like to receive program announcements and future
                training information. (Optional)
              </span>
            </CheckboxField>
            <CheckboxField
              id="renewal-photo-video"
              name="photoVideoConsent"
              checked={consents.photoVideoConsent}
              disabled={isPending}
              onChange={updateConsent}
            >
              <span className="text-artis-slate">
                I consent to photographs or videos of the player being used for
                promotional purposes. (Optional)
              </span>
            </CheckboxField>
          </div>
        </section>

        <section className="mt-[22px] border-t border-artis-border pt-[22px]">
          <h2 className="text-[21px] font-semibold leading-[30px]">
            Payment method
          </h2>
          <p className="mt-1.5 text-sm leading-5 text-artis-slate">
            Payment information is entered securely on the next screen.
          </p>

          <div className="mt-[18px] flex flex-col items-stretch gap-3 sm:items-start">
            <button
              type="submit"
              name="paymentMethod"
              value="stripe"
              disabled={isPending}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-artis-navy px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-white transition-opacity disabled:opacity-60 sm:w-[300px]"
            >
              {isPending ? "Creating renewal…" : "Continue to Secure Payment"}
            </button>
            <button
              type="submit"
              name="paymentMethod"
              value="e_transfer"
              disabled={isPending}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-artis-gold px-6 py-3.5 text-[15px] font-semibold leading-5 text-artis-navy transition-opacity disabled:opacity-60 sm:w-[250px]"
            >
              {isPending ? "Creating renewal…" : "Pay by E-transfer"}
            </button>
          </div>

          <p className="mt-4 text-[13px] font-medium leading-[19px] text-artis-slate">
            🔒 Card payments are processed securely by Stripe. ARTIS Soccer
            Academy does not receive or store card details.
          </p>

          <Link
            href="/register/renew"
            className="mt-5 inline-flex text-sm font-semibold leading-5 underline decoration-artis-border underline-offset-4 hover:decoration-artis-navy"
          >
            Request a Different Renewal Link
          </Link>
        </section>
      </section>

      <div className="order-1 xl:order-2">
        <OrderSummary
          playerName={playerName}
          paidThrough={paidThrough}
          renewsOn={renewsOn}
          trainingGroup={trainingGroup}
          programPackage={selectedPackage}
        />
      </div>
    </form>
  );
}

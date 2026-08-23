// FIGMA REGISTRATION FORM — JERSEY REVISION — AUGUST 23, 2026
"use client";

import Link from "next/link";
import {
  useActionState,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

import {
  submitRegistration,
  type RegistrationActionErrorCode,
  type RegistrationActionState,
} from "./actions";

type WeeklySessionOption = {
  id: number;
  trainingGroupId: number;
  dayOfWeek: string;
  sessionType: string;
  startTime: string;
  endTime: string;
};

type TrainingGroupOption = {
  id: number;
  slug: string;
  displayName: string;
  minimumAge: number;
  maximumAge: number;
  capacity: number;
  availableSpots: number;
  weeklySchedule: WeeklySessionOption[];
};

type ProgramPackageOption = {
  id: number;
  slug: string;
  displayName: string;
  durationMonths: number;
  priceCents: number;
  currency: string;
  taxBehavior: "exclusive" | "inclusive";
};

type ProgramSelectorProps = {
  trainingGroups: TrainingGroupOption[];
  programPackages: ProgramPackageOption[];
};

type TextFieldProps = {
  id: string;
  label: string;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

type SelectFieldProps = {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
} & Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id" | "className" | "children"
>;

type CheckboxFieldProps = {
  id: string;
  name: string;
  children: ReactNode;
  required?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
};

const initialActionState: RegistrationActionState = { status: "idle" };

const registrationErrorMessages: Record<RegistrationActionErrorCode, string> = {
  "invalid-form":
    "Please review the form and complete every required field correctly.",
  "unable-to-submit":
    "We could not submit the registration. Please wait a moment and try again.",
  "invalid-selection":
    "The selected training group or program term is no longer available.",
  "registration-closed":
    "Registration for this training group is currently closed.",
  "group-full":
    "This training group has just reached capacity. Please return to the training options to join the waitlist.",
  "age-mismatch":
    "The player’s age does not match the selected training group at the program start date.",
  "legal-documents-unavailable":
    "Registration is temporarily unavailable while the required policies are being updated.",
  "already-registered":
    "This player already has a current registration for the selected training group.",
  "guardian-verification-required":
    "An account already exists for this email address. Please contact ARTIS Soccer Academy before continuing.",
  "renewal-required":
    "This player has registered before and must use the returning-player renewal process.",
};

const shortDayNames: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const dayOrder: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const inputClassName =
  "h-[52px] w-full rounded-[10px] border border-artis-border bg-artis-white px-4 text-[15px] text-artis-navy outline-none transition-colors placeholder:text-artis-slate focus:border-artis-navy focus:ring-2 focus:ring-artis-gold/35";

function formatCurrency(priceCents: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(priceCents / 100);
}

function formatPackageDuration(durationMonths: number): string {
  if (durationMonths === 12) {
    return "1 Year";
  }

  return `${durationMonths} Month${durationMonths === 1 ? "" : "s"}`;
}

function sortSessionsByDay(
  sessions: WeeklySessionOption[],
): WeeklySessionOption[] {
  return [...sessions].sort(
    (first, second) =>
      (dayOrder[first.dayOfWeek] ?? 8) - (dayOrder[second.dayOfWeek] ?? 8),
  );
}

function formatScheduleOverview(sessions: WeeklySessionOption[]): string {
  const orderedSessions = sortSessionsByDay(sessions);
  const trainingDays = orderedSessions
    .filter((session) => session.sessionType !== "game_training")
    .map((session) => shortDayNames[session.dayOfWeek] ?? session.dayOfWeek);
  const gameDays = orderedSessions
    .filter((session) => session.sessionType === "game_training")
    .map((session) => shortDayNames[session.dayOfWeek] ?? session.dayOfWeek);
  const parts: string[] = [];

  if (trainingDays.length > 0) {
    parts.push(`${trainingDays.join(" + ")} training`);
  }

  if (gameDays.length > 0) {
    parts.push(`${gameDays.join(" + ")} game / match`);
  }

  return parts.join(" · ");
}

function formatProgramStart(): string {
  const now = new Date();
  const torontoParts = new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  }).formatToParts(now);
  const day = Number(torontoParts.find((part) => part.type === "day")?.value);
  const month = Number(
    torontoParts.find((part) => part.type === "month")?.value,
  );
  const year = Number(torontoParts.find((part) => part.type === "year")?.value);
  const startMonthIndex = day === 1 ? month - 1 : month;

  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, startMonthIndex, 1)));
}

function TextField({
  id,
  label,
  className = "",
  ...inputProps
}: TextFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-[13px] font-semibold">
        {label}
      </label>
      <input id={id} className={inputClassName} {...inputProps} />
    </div>
  );
}

function SelectField({
  id,
  label,
  children,
  className = "",
  ...selectProps
}: SelectFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-[13px] font-semibold">
        {label}
      </label>
      <select id={id} className={inputClassName} {...selectProps}>
        {children}
      </select>
    </div>
  );
}

function CheckboxField({
  id,
  name,
  children,
  required = false,
  checked,
  onChange,
}: CheckboxFieldProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        required={required}
        checked={checked}
        onChange={
          onChange
            ? (event) => onChange(event.currentTarget.checked)
            : undefined
        }
        className="mt-0.5 size-6 shrink-0 rounded-[5px] border-artis-border accent-artis-navy"
      />
      <label htmlFor={id} className="text-sm leading-[21px]">
        {children}
      </label>
    </div>
  );
}

function FormSectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-[26px] font-bold leading-[34px]">{title}</h2>
      <p className="mt-1.5 text-sm leading-[21px] text-artis-slate">
        {description}
      </p>
    </div>
  );
}

function ProgressStep({
  number,
  label,
  status,
}: {
  number: number;
  label: string;
  status: "ACTIVE" | "IN PROGRESS" | "UPCOMING";
}) {
  const upcoming = status === "UPCOMING";

  return (
    <div className="flex items-start gap-3">
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${
          upcoming
            ? "bg-artis-off-white text-artis-slate"
            : "bg-artis-navy text-artis-white"
        }`}
      >
        {number}
      </span>
      <span>
        <span className="block text-[15px] font-semibold leading-[22px]">
          {label}
        </span>
        <span
          className={`block text-[11px] font-semibold leading-4 ${
            upcoming ? "text-artis-slate" : "text-artis-gold"
          }`}
        >
          {status}
        </span>
      </span>
    </div>
  );
}

function RegistrationProgress() {
  return (
    <section className="rounded-[14px] border border-artis-border bg-artis-white p-6">
      <h2 className="text-xl font-bold leading-[29px]">
        Registration progress
      </h2>
      <div className="mt-[18px] space-y-[18px]">
        <ProgressStep number={1} label="Player Information" status="ACTIVE" />
        <ProgressStep
          number={2}
          label="Parent Information"
          status="IN PROGRESS"
        />
        <ProgressStep number={3} label="Payment" status="UPCOMING" />
      </div>
    </section>
  );
}

function SelectedTrainingSummary({
  group,
  programPackage,
}: {
  group: TrainingGroupOption;
  programPackage: ProgramPackageOption;
}) {
  function returnToProgramSelection() {
    document
      .getElementById("program-selection")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="rounded-2xl border border-artis-border bg-artis-white p-6">
      <h2 className="text-[22px] font-bold">Selected training</h2>
      <p className="mt-3.5 w-fit rounded-full bg-artis-soft-gold px-2.5 py-1.5 text-[13px] font-semibold">
        {group.displayName} Soccer Development Program
      </p>
      <div className="mt-3.5 space-y-3.5 text-sm leading-[21px] text-artis-slate">
        <p>Age group: {group.displayName}</p>
        <p>Schedule: {formatScheduleOverview(group.weeklySchedule)}</p>
        <p>Location: Central Huron Secondary School gym</p>
        <p className="text-[17px] font-semibold leading-6 text-artis-navy">
          Package: {programPackage.displayName} ·{" "}
          {formatCurrency(programPackage.priceCents, programPackage.currency)}
          {programPackage.taxBehavior === "exclusive"
            ? " + HST"
            : " HST included"}
        </p>
      </div>
      <button
        type="button"
        onClick={returnToProgramSelection}
        className="mt-4 min-h-12 rounded-[10px] bg-artis-gold px-6 py-3.5 text-[15px] font-semibold"
      >
        Change Program
      </button>
    </section>
  );
}

function PlayerInformationSection() {
  return (
    <section className="rounded-[14px] border border-artis-border bg-artis-white p-6 sm:p-8">
      <FormSectionHeader
        title="Player information"
        description="Tell us about the player. Optional details are used only for registration, safety, and training preparation."
      />

      <div className="mt-[22px] grid gap-[22px] sm:grid-cols-2 sm:gap-x-4">
        <TextField
          id="childFirstName"
          name="childFirstName"
          label="Child’s first name *"
          placeholder="Enter first name"
          autoComplete="given-name"
          maxLength={50}
          required
        />
        <TextField
          id="childLastName"
          name="childLastName"
          label="Child’s last name *"
          placeholder="Enter last name"
          autoComplete="family-name"
          maxLength={50}
          required
        />
        <TextField
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          label="Date of birth *"
          autoComplete="bday"
          required
        />
        <SelectField
          id="currentPlayingLevel"
          name="currentPlayingLevel"
          label="Current age group or playing level *"
          defaultValue=""
          required
        >
          <option value="" disabled>
            Choose an option
          </option>
          <option value="New to organized soccer">
            New to organized soccer
          </option>
          <option value="Recreational">Recreational</option>
          <option value="Development">Development</option>
          <option value="Competitive">Competitive</option>
          <option value="Academy">Academy</option>
          <option value="Other">Other</option>
        </SelectField>
        <TextField
          id="currentTeamOrClub"
          name="currentTeamOrClub"
          label="Current team or club (optional)"
          placeholder="Enter team or club"
          maxLength={100}
        />

        <div className="border-t border-artis-border pt-[22px] sm:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold">
            Jersey information
          </p>
          <p className="mt-2 text-sm leading-6 text-artis-slate">
            One personalized ARTIS Soccer Academy jersey is provided per player
            per year. Size options are pending client confirmation.
          </p>
        </div>

        <SelectField
          id="jerseySize"
          name="jerseySize"
          label="Jersey size (pending confirmation)"
          defaultValue=""
        >
          <option value="" disabled>
            Choose a size
          </option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
          <option value="extra_large">Extra Large</option>
        </SelectField>
        <TextField
          id="preferredName"
          name="preferredName"
          label="Name on jersey (optional until confirmed)"
          placeholder="Enter name for the jersey"
          maxLength={50}
        />

        <p className="rounded-[10px] bg-artis-soft-gold p-4 text-sm leading-6 text-artis-slate sm:col-span-2">
          Returning players who have already received a jersey should continue
          using their existing jersey.
        </p>

        <TextField
          id="medicalInformation"
          name="medicalInformation"
          label="Medical conditions, allergies, injuries, or accessibility needs (optional)"
          placeholder="Enter information only if relevant"
          maxLength={2000}
          className="sm:col-span-2"
        />
      </div>

      <p className="mt-3 text-[13px] font-medium leading-[19px] text-artis-slate">
        Privacy note: Sensitive information should be used only for
        registration, safety, and training preparation.
      </p>

      <TextField
        id="coachInformation"
        name="coachInformation"
        label="Additional information the coach should know (optional)"
        placeholder="Add relevant information"
        maxLength={2000}
        className="mt-[22px]"
      />
    </section>
  );
}

function GuardianInformationSection() {
  return (
    <section className="rounded-[14px] border border-artis-border bg-artis-white p-6 sm:p-8">
      <FormSectionHeader
        title="Parent or guardian information"
        description="Provide contact details for the adult completing this registration."
      />

      <div className="mt-[22px] grid gap-[22px] sm:grid-cols-2 sm:gap-x-4">
        <TextField
          id="guardianFirstName"
          name="guardianFirstName"
          label="Parent or guardian first name *"
          placeholder="Enter first name"
          autoComplete="given-name"
          maxLength={50}
          required
        />
        <TextField
          id="guardianLastName"
          name="guardianLastName"
          label="Parent or guardian last name *"
          placeholder="Enter last name"
          autoComplete="family-name"
          maxLength={50}
          required
        />
        <SelectField
          id="guardianRelationship"
          name="guardianRelationship"
          label="Relationship to player *"
          defaultValue=""
          required
        >
          <option value="" disabled>
            Choose relationship
          </option>
          <option value="Parent">Parent</option>
          <option value="Legal guardian">Legal guardian</option>
          <option value="Grandparent">Grandparent</option>
          <option value="Foster parent">Foster parent</option>
          <option value="Other authorized adult">Other authorized adult</option>
        </SelectField>
        <TextField
          id="email"
          name="email"
          type="email"
          label="Email address *"
          placeholder="name@example.com"
          autoComplete="email"
          maxLength={254}
          required
        />
        <TextField
          id="primaryPhone"
          name="primaryPhone"
          type="tel"
          label="Primary phone number *"
          placeholder="(000) 000-0000"
          autoComplete="tel"
          maxLength={30}
          required
        />
        <TextField
          id="secondaryPhone"
          name="secondaryPhone"
          type="tel"
          label="Secondary phone number (optional)"
          placeholder="(000) 000-0000"
          maxLength={30}
        />
        <SelectField
          id="preferredContactMethod"
          name="preferredContactMethod"
          label="Preferred method of contact *"
          defaultValue="email"
          required
          className="sm:col-span-2"
        >
          <option value="email">Email</option>
          <option value="phone">Phone</option>
          <option value="text">Text message</option>
        </SelectField>
      </div>
    </section>
  );
}

function EmergencyContactSection({
  usesDifferentContact,
  setUsesDifferentContact,
}: {
  usesDifferentContact: boolean;
  setUsesDifferentContact: (value: boolean) => void;
}) {
  return (
    <section className="rounded-[14px] border border-artis-border bg-artis-white p-6 sm:p-8">
      <FormSectionHeader
        title="Emergency contact"
        description="If no different contact is provided, the parent or guardian details above may serve as the emergency contact."
      />

      <div className="mt-[22px]">
        <CheckboxField
          id="emergencyContactDifferent"
          name="emergencyContactDifferent"
          checked={usesDifferentContact}
          onChange={setUsesDifferentContact}
        >
          Emergency contact is different from the registering parent or guardian
        </CheckboxField>
      </div>

      <div className="mt-[22px] grid gap-[22px] sm:grid-cols-2 sm:gap-x-4">
        <TextField
          id="emergencyContactName"
          name="emergencyContactName"
          label="Emergency contact name"
          placeholder="Enter full name"
          autoComplete="name"
          maxLength={100}
          required={usesDifferentContact}
        />
        <SelectField
          id="emergencyContactRelationship"
          name="emergencyContactRelationship"
          label="Relationship to player"
          defaultValue=""
          required={usesDifferentContact}
        >
          <option value="" disabled>
            Choose relationship
          </option>
          <option value="Parent">Parent</option>
          <option value="Legal guardian">Legal guardian</option>
          <option value="Grandparent">Grandparent</option>
          <option value="Relative">Relative</option>
          <option value="Family friend">Family friend</option>
          <option value="Other">Other</option>
        </SelectField>
        <TextField
          id="emergencyContactPhone"
          name="emergencyContactPhone"
          type="tel"
          label="Emergency phone number"
          placeholder="(000) 000-0000"
          autoComplete="tel"
          maxLength={30}
          required={usesDifferentContact}
          className="sm:col-span-2"
        />
      </div>
    </section>
  );
}

function ConsentSection() {
  return (
    <section className="rounded-[14px] border border-artis-border bg-artis-white p-6 sm:p-8">
      <FormSectionHeader
        title="Consent and policies"
        description="Review each statement. Optional choices are separate from the required registration confirmations."
      />

      <div className="mt-[22px] space-y-[22px]">
        <CheckboxField
          id="authorizedRegistrantConfirmed"
          name="authorizedRegistrantConfirmed"
          required
        >
          I confirm that I am the player’s parent or legal guardian, or that I
          am authorized to register this player. *
        </CheckboxField>
        <CheckboxField
          id="informationAccuracyConfirmed"
          name="informationAccuracyConfirmed"
          required
        >
          I confirm that the information provided is accurate. *
        </CheckboxField>
        <CheckboxField id="termsAccepted" name="termsAccepted" required>
          I agree to the Terms and Conditions. *{" "}
          <Link href="/terms" className="font-semibold underline">
            View Terms and Conditions
          </Link>
        </CheckboxField>
        <CheckboxField
          id="participationWaiverAccepted"
          name="participationWaiverAccepted"
          required
        >
          I acknowledge the Participation Waiver. *{" "}
          <Link href="/waiver" className="font-semibold underline">
            View Participation Waiver
          </Link>
        </CheckboxField>
        <CheckboxField id="gymRulesAccepted" name="gymRulesAccepted" required>
          I acknowledge the Gym or Facility Rules. *{" "}
          <Link href="/gym-rules" className="font-semibold underline">
            View Gym Rules
          </Link>
        </CheckboxField>
        <CheckboxField id="marketingConsent" name="marketingConsent">
          <span className="text-artis-slate">
            I would like to receive program announcements and future training
            information. (Optional)
          </span>
        </CheckboxField>
        <CheckboxField id="photoVideoConsent" name="photoVideoConsent">
          <span className="text-artis-slate">
            I consent to photographs or videos of the player being used for
            promotional purposes. (Optional)
          </span>
        </CheckboxField>
      </div>

      <div className="mt-[22px] rounded-[10px] border border-artis-border bg-artis-soft-gold p-5">
        <h3 className="font-semibold leading-[23px]">
          Participation waiver / informed consent
        </h3>
        <p className="mt-2.5 text-sm leading-5 text-artis-slate">
          Final waiver, gym-rules and policy wording pending client and legal
          review.
        </p>
      </div>
    </section>
  );
}

function ProgramSelection({
  trainingGroups,
  programPackages,
  selectedGroupId,
  selectedPackageId,
  setSelectedGroupId,
  setSelectedPackageId,
}: ProgramSelectorProps & {
  selectedGroupId: number;
  selectedPackageId: number;
  setSelectedGroupId: (value: number) => void;
  setSelectedPackageId: (value: number) => void;
}) {
  return (
    <section
      id="program-selection"
      className="scroll-mt-6 overflow-hidden rounded-2xl border border-artis-border bg-artis-white shadow-[0_12px_32px_rgba(11,31,51,0.06)]"
    >
      <div className="border-b border-artis-border bg-artis-off-white px-6 py-5 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold">
          Program selection
        </p>
        <h2 className="mt-2 text-2xl font-bold">Choose a program</h2>
        <p className="mt-2 text-sm leading-6 text-artis-slate">
          Select the player’s age group and the length of the training program.
        </p>
      </div>

      <div className="space-y-8 p-6 sm:p-8">
        <fieldset>
          <legend className="text-lg font-bold">Age group</legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {trainingGroups.map((group) => {
              const selected = group.id === selectedGroupId;

              return (
                <label
                  key={group.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-[10px] border p-4 transition-colors focus-within:ring-2 focus-within:ring-artis-gold ${
                    selected
                      ? "border-artis-navy bg-artis-soft-gold"
                      : "border-artis-border hover:border-artis-navy"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold">
                      {group.displayName}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-artis-slate">
                      {formatScheduleOverview(group.weeklySchedule)}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-artis-slate">
                      {group.availableSpots} of {group.capacity} spots available
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="trainingGroupId"
                    value={group.id}
                    checked={selected}
                    onChange={() => setSelectedGroupId(group.id)}
                    required
                    className="size-5 accent-artis-navy"
                  />
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-bold">Program term</legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {programPackages.map((programPackage) => {
              const selected = programPackage.id === selectedPackageId;

              return (
                <label
                  key={programPackage.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-4 transition-colors focus-within:ring-2 focus-within:ring-artis-gold ${
                    selected
                      ? "border-artis-navy bg-artis-navy text-artis-white"
                      : "border-artis-border hover:border-artis-navy"
                  }`}
                >
                  <input
                    type="radio"
                    name="programPackageId"
                    value={programPackage.id}
                    checked={selected}
                    onChange={() => setSelectedPackageId(programPackage.id)}
                    required
                    className="mt-1 size-5 accent-artis-gold"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      {formatPackageDuration(programPackage.durationMonths)}
                    </span>
                    <span className="mt-1 block text-xl font-bold">
                      {formatCurrency(
                        programPackage.priceCents,
                        programPackage.currency,
                      )}
                    </span>
                    <span
                      className={`mt-1 block text-xs ${
                        selected ? "text-artis-white/75" : "text-artis-slate"
                      }`}
                    >
                      {programPackage.taxBehavior === "exclusive"
                        ? "Plus HST"
                        : "HST included"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3 rounded-[10px] bg-artis-deep-navy p-5 text-artis-white sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-artis-white/80">
            Programs begin on the first day of the month. Registrations made
            after the month has started begin the following month.
          </p>
          <p className="w-fit shrink-0 rounded-full bg-artis-white px-4 py-2 text-sm font-bold text-artis-navy">
            Program start:{" "}
            <span suppressHydrationWarning>{formatProgramStart()}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

export default function ProgramSelector({
  trainingGroups,
  programPackages,
}: ProgramSelectorProps) {
  const [selectedGroupId, setSelectedGroupId] = useState(
    trainingGroups[0]?.id ?? 0,
  );
  const [selectedPackageId, setSelectedPackageId] = useState(
    programPackages[0]?.id ?? 0,
  );
  const [usesDifferentContact, setUsesDifferentContact] = useState(false);
  const [actionState, formAction, isPending] = useActionState(
    submitRegistration,
    initialActionState,
  );
  const selectedGroup = trainingGroups.find(
    (group) => group.id === selectedGroupId,
  );
  const selectedPackage = programPackages.find(
    (programPackage) => programPackage.id === selectedPackageId,
  );

  if (!selectedGroup || !selectedPackage) {
    return (
      <section className="rounded-2xl border border-artis-border bg-artis-white p-6">
        <h2 className="text-xl font-bold">Program selection</h2>
        <p className="mt-2 text-artis-slate">
          Registration options are not currently available.
        </p>
      </section>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <div className="pointer-events-none absolute -left-[10000px] top-auto size-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <ProgramSelection
        trainingGroups={trainingGroups}
        programPackages={programPackages}
        selectedGroupId={selectedGroupId}
        selectedPackageId={selectedPackageId}
        setSelectedGroupId={setSelectedGroupId}
        setSelectedPackageId={setSelectedPackageId}
      />

      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,760px)_420px] xl:gap-12">
        <div className="order-2 space-y-7 xl:order-1">
          <PlayerInformationSection />
          <GuardianInformationSection />
          <EmergencyContactSection
            usesDifferentContact={usesDifferentContact}
            setUsesDifferentContact={setUsesDifferentContact}
          />
          <ConsentSection />

          <section className="rounded-[14px] border border-artis-border bg-artis-white p-6 sm:p-8">
            {actionState.status === "error" ? (
              <output
                aria-live="polite"
                className="mb-5 block rounded-md bg-[#fbeded] px-3 py-2.5 text-[13px] leading-5 text-artis-error"
              >
                <span className="font-semibold">Please review:</span>{" "}
                {registrationErrorMessages[actionState.code]}
              </output>
            ) : null}

            <div className="flex flex-col items-stretch gap-4 sm:items-start">
              <button
                type="submit"
                name="paymentMethod"
                value="stripe"
                disabled={isPending}
                className="min-h-12 rounded-[10px] bg-artis-navy px-6 py-3.5 text-[15px] font-semibold text-artis-white disabled:opacity-60 sm:w-[300px]"
              >
                {isPending
                  ? "Submitting registration…"
                  : "Continue to Secure Payment"}
              </button>
              <button
                type="submit"
                name="paymentMethod"
                value="e_transfer"
                disabled={isPending}
                className="min-h-12 rounded-[10px] bg-artis-gold px-6 py-3.5 text-[15px] font-semibold text-artis-navy disabled:opacity-60 sm:w-[250px]"
              >
                {isPending ? "Submitting registration…" : "Pay by E-transfer"}
              </button>
              <Link
                href="/#training"
                className="text-sm font-semibold leading-5 underline-offset-4 hover:underline"
              >
                Back to Training Options
              </Link>
              <p className="text-[13px] font-medium leading-[19px] text-artis-slate">
                Credit or debit card continues to secure Stripe checkout.
                E-transfer submits the registration and opens payment
                instructions.
              </p>
            </div>
          </section>
        </div>

        <aside className="order-1 space-y-6 xl:order-2 xl:sticky xl:top-6">
          <RegistrationProgress />
          <SelectedTrainingSummary
            group={selectedGroup}
            programPackage={selectedPackage}
          />
          <section className="rounded-[10px] bg-artis-soft-gold p-5">
            <h2 className="font-semibold leading-[23px]">Before payment</h2>
            <p className="mt-2.5 text-sm leading-5 text-artis-slate">
              This screen collects registration information only. Payment
              details are entered on the next secure checkout screen.
            </p>
          </section>
          <p className="flex items-center justify-between rounded-md bg-artis-soft-gold p-4 text-sm">
            <span className="font-semibold">Program start:</span>
            <span suppressHydrationWarning>{formatProgramStart()}</span>
          </p>
        </aside>
      </div>
    </form>
  );
}

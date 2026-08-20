"use client";

import { useState } from "react";

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

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

function formatCurrency(priceCents: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(priceCents / 100);
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, hours, minutes));

  return timeFormatter.format(date);
}

function formatDay(day: string): string {
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}`;
}

function formatSessionType(sessionType: string): string {
  return sessionType === "game_training" ? "Game / match" : "Training";
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

  const selectedGroup = trainingGroups.find(
    (group) => group.id === selectedGroupId,
  );
  const selectedPackage = programPackages.find(
    (programPackage) => programPackage.id === selectedPackageId,
  );

  if (!selectedGroup || !selectedPackage) {
    return (
      <section className="rounded-2xl border border-artis-border bg-artis-white p-5 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold">
          Registration update
        </p>
        <h2 className="mt-3 text-2xl font-bold">No programs are available</h2>
        <p className="mt-3 leading-7 text-artis-slate">
          Please check back after registration options have been added.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-artis-border bg-artis-white p-5 sm:p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold">
          Program selection
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Choose the right training option
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-artis-slate">
          Select the player&apos;s age group and the length of the program. Your
          selection will be included when the registration form is submitted.
        </p>
      </div>

      <fieldset className="mt-8">
        <legend className="text-lg font-bold">Age group</legend>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {trainingGroups.map((group) => {
            const selected = group.id === selectedGroupId;

            return (
              <label
                key={group.id}
                className={`block cursor-pointer rounded-2xl border p-5 transition-colors sm:p-6 ${
                  selected
                    ? "border-artis-navy bg-artis-soft-gold/40"
                    : "border-artis-border bg-artis-off-white hover:border-artis-navy"
                }`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="trainingGroupId"
                    value={group.id}
                    checked={selected}
                    onChange={() => setSelectedGroupId(group.id)}
                    required
                    className="mt-1 size-5 shrink-0 accent-artis-navy"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-start justify-between gap-3">
                      <span>
                        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-artis-gold">
                          Soccer development program
                        </span>
                        <span className="mt-2 block text-xl font-bold">
                          {group.displayName}
                        </span>
                      </span>

                      <span className="rounded-full bg-artis-soft-gold px-3 py-1 text-xs font-semibold">
                        Maximum {group.capacity} players
                      </span>
                    </span>

                    <span className="mt-5 block space-y-3">
                      {group.weeklySchedule.map((session) => (
                        <span
                          key={session.id}
                          className="flex flex-col gap-1 border-t border-artis-border pt-3 text-sm first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="font-semibold">
                            {formatDay(session.dayOfWeek)}
                          </span>
                          <span className="text-artis-slate">
                            {formatSessionType(session.sessionType)} ·{" "}
                            {formatTime(session.startTime)}–
                            {formatTime(session.endTime)}
                          </span>
                        </span>
                      ))}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-10">
        <legend className="text-lg font-bold">Program package</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {programPackages.map((programPackage) => {
            const selected = programPackage.id === selectedPackageId;

            return (
              <label
                key={programPackage.id}
                className={`block cursor-pointer rounded-2xl border p-5 transition-colors ${
                  selected
                    ? "border-artis-navy bg-artis-soft-gold/40"
                    : "border-artis-border hover:border-artis-navy"
                }`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="programPackageId"
                    value={programPackage.id}
                    checked={selected}
                    onChange={() => setSelectedPackageId(programPackage.id)}
                    required
                    className="mt-1 size-5 shrink-0 accent-artis-navy"
                  />

                  <span>
                    <span className="block text-sm font-semibold text-artis-slate">
                      {programPackage.durationMonths} month
                      {programPackage.durationMonths === 1 ? "" : "s"}
                    </span>
                    <span className="mt-2 block text-lg font-bold">
                      {programPackage.displayName}
                    </span>
                    <span className="mt-5 block text-2xl font-bold">
                      {formatCurrency(
                        programPackage.priceCents,
                        programPackage.currency,
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-artis-slate">
                      {programPackage.taxBehavior === "exclusive"
                        ? "Plus HST"
                        : "HST included"}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <output
        aria-live="polite"
        className="mt-8 block rounded-[10px] bg-artis-soft-gold p-5"
      >
        <span className="block font-semibold">Selected training</span>
        <span className="mt-2 block text-sm leading-6 text-artis-slate">
          {selectedGroup.displayName} · {selectedPackage.displayName} ·{" "}
          {formatCurrency(selectedPackage.priceCents, selectedPackage.currency)}
          {selectedPackage.taxBehavior === "exclusive" ? " plus HST" : ""}
        </span>
        <span className="mt-1 block text-sm leading-6 text-artis-slate">
          Central Huron Secondary School · Limited to {selectedGroup.capacity}{" "}
          players
        </span>
      </output>

      <div className="mt-5 rounded-[10px] border border-artis-border p-5">
        <h3 className="font-semibold">Program dates</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-artis-slate">
          Fixed program periods begin on the first of the month and end on the
          final day of the applicable month. Confirmed dates will be shown
          before payment.
        </p>
      </div>
    </section>
  );
}

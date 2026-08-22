// REDESIGNED PROGRAM SELECTOR — AUGUST 22, 2026
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

function formatClockTime(time: string): { value: string; period: string } {
  const [hourValue = 0, minuteValue = 0] = time.split(":").map(Number);
  const period = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue % 12 || 12;
  const minutes =
    minuteValue === 0 ? "" : `:${String(minuteValue).padStart(2, "0")}`;

  return { value: `${hour}${minutes}`, period };
}

function formatTimeRange(startTime: string, endTime: string): string {
  const start = formatClockTime(startTime);
  const end = formatClockTime(endTime);

  if (start.period === end.period) {
    return `${start.value}–${end.value} ${end.period}`;
  }

  return `${start.value} ${start.period}–${end.value} ${end.period}`;
}

function joinDays(days: string[], separator: string): string {
  return days.join(separator);
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
  const scheduleParts: string[] = [];

  if (trainingDays.length > 0) {
    scheduleParts.push(`${joinDays(trainingDays, " + ")} training`);
  }

  if (gameDays.length > 0) {
    scheduleParts.push(`${joinDays(gameDays, " + ")} game / match`);
  }

  return scheduleParts.join(" · ");
}

function formatProgramStart(): string {
  const now = new Date();
  const torontoDateParts = new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  }).formatToParts(now);

  const currentDay = Number(
    torontoDateParts.find((part) => part.type === "day")?.value,
  );
  const currentMonth = Number(
    torontoDateParts.find((part) => part.type === "month")?.value,
  );
  const currentYear = Number(
    torontoDateParts.find((part) => part.type === "year")?.value,
  );
  const startMonthIndex = currentDay === 1 ? currentMonth - 1 : currentMonth;
  const startDate = new Date(Date.UTC(currentYear, startMonthIndex, 1));

  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(startDate);
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
      <section className="rounded-2xl border border-artis-border bg-artis-white p-6">
        <h2 className="text-base font-normal uppercase">Program selection</h2>
        <p className="mt-2 leading-[25px] text-artis-slate">
          Registration options are not currently available.
        </p>
      </section>
    );
  }

  const trainingSessions = sortSessionsByDay(
    selectedGroup.weeklySchedule.filter(
      (session) => session.sessionType !== "game_training",
    ),
  );
  const gameSessions = sortSessionsByDay(
    selectedGroup.weeklySchedule.filter(
      (session) => session.sessionType === "game_training",
    ),
  );
  const firstTrainingSession = trainingSessions[0];
  const firstGameSession = gameSessions[0];
  const trainingDaysShort = trainingSessions.map(
    (session) => shortDayNames[session.dayOfWeek] ?? session.dayOfWeek,
  );
  const gameDaysShort = gameSessions.map(
    (session) => shortDayNames[session.dayOfWeek] ?? session.dayOfWeek,
  );
  const taxLabel =
    selectedPackage.taxBehavior === "exclusive" ? " + HST" : " (HST included)";

  return (
    <section className="overflow-hidden rounded-2xl border border-artis-border bg-artis-white shadow-[0_12px_32px_rgba(11,31,51,0.06)]">
      <div className="border-b border-artis-border bg-artis-off-white px-6 py-5 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold">
          Training options
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">
          Choose a program
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-artis-slate">
          Select the player&apos;s age group and the length of the training
          program.
        </p>
      </div>

      <div className="space-y-8 p-6 sm:p-8">
        <fieldset>
          <legend className="text-lg font-bold">Age group</legend>
          <p className="mt-1 text-sm leading-6 text-artis-slate">
            Choose the group that matches the player&apos;s age.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {trainingGroups.map((group) => {
              const selected = group.id === selectedGroupId;

              return (
                <label
                  key={group.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-[10px] border p-4 transition-colors focus-within:ring-2 focus-within:ring-artis-gold focus-within:ring-offset-2 ${
                    selected
                      ? "border-artis-navy bg-artis-soft-gold"
                      : "border-artis-border bg-artis-white hover:border-artis-navy hover:bg-artis-off-white"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold">
                      {group.displayName}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-artis-slate">
                      {formatScheduleOverview(group.weeklySchedule)}
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="trainingGroupId"
                    value={group.id}
                    checked={selected}
                    onChange={() => setSelectedGroupId(group.id)}
                    required
                    className="size-5 shrink-0 accent-artis-navy"
                  />
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-lg font-bold">Program term</legend>
          <p className="mt-1 text-sm leading-6 text-artis-slate">
            Longer terms reduce the average monthly cost.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {programPackages.map((programPackage) => {
              const selected = programPackage.id === selectedPackageId;

              return (
                <label
                  key={programPackage.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-4 transition-colors focus-within:ring-2 focus-within:ring-artis-gold focus-within:ring-offset-2 ${
                    selected
                      ? "border-artis-navy bg-artis-navy text-artis-white"
                      : "border-artis-border bg-artis-white hover:border-artis-navy hover:bg-artis-off-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="programPackageId"
                    value={programPackage.id}
                    checked={selected}
                    onChange={() => setSelectedPackageId(programPackage.id)}
                    required
                    className="mt-1 size-5 shrink-0 accent-artis-gold"
                  />
                  <span className="min-w-0">
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

        <output
          aria-live="polite"
          className="block rounded-[10px] border border-artis-border bg-artis-soft-gold p-5 sm:p-6"
        >
          <span className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-artis-gold">
                Selected training
              </span>
              <span className="mt-2 block text-xl font-bold">
                {selectedGroup.displayName}
              </span>
            </span>
            <span className="w-fit rounded-full bg-artis-white px-3 py-1.5 text-sm font-semibold">
              {formatPackageDuration(selectedPackage.durationMonths)} ·{" "}
              {formatCurrency(
                selectedPackage.priceCents,
                selectedPackage.currency,
              )}
              {taxLabel}
            </span>
          </span>

          <span className="mt-5 grid gap-4 border-t border-artis-gold/35 pt-5 md:grid-cols-3">
            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-artis-slate">
                Weekly schedule
              </span>
              {firstTrainingSession ? (
                <span className="mt-1 block text-sm font-semibold leading-6">
                  {joinDays(trainingDaysShort, " + ")} ·{" "}
                  {formatTimeRange(
                    firstTrainingSession.startTime,
                    firstTrainingSession.endTime,
                  )}
                </span>
              ) : null}
              {firstGameSession ? (
                <span className="block text-sm font-semibold leading-6">
                  {joinDays(gameDaysShort, " + ")} ·{" "}
                  {formatTimeRange(
                    firstGameSession.startTime,
                    firstGameSession.endTime,
                  )}{" "}
                  Game / Match
                </span>
              ) : null}
            </span>

            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-artis-slate">
                Location
              </span>
              <span className="mt-1 block text-sm font-semibold leading-6">
                Central Huron Secondary School gym
              </span>
            </span>

            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-artis-slate">
                Capacity
              </span>
              <span className="mt-1 block text-sm font-semibold leading-6">
                Limited to {selectedGroup.capacity} players
              </span>
            </span>
          </span>
        </output>

        <div className="border-t border-artis-border pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-artis-gold">
            Player kit
          </p>
          <h3 className="mt-2 text-xl font-bold">Jersey information</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-artis-slate">
            Each player receives one personalized ARTIS Soccer Academy jersey
            per year.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[10px] border border-artis-border bg-artis-off-white p-4">
              <p className="text-sm font-semibold">Jersey size</p>
              <p className="mt-1 text-sm leading-6 text-artis-slate">
                Size options pending client confirmation
              </p>
            </div>
            <div className="rounded-[10px] border border-artis-border bg-artis-off-white p-4">
              <p className="text-sm font-semibold">Name on jersey</p>
              <p className="mt-1 text-sm leading-6 text-artis-slate">
                Enter the player&apos;s preferred name during registration
              </p>
            </div>
          </div>

          <p className="mt-4 rounded-[10px] bg-artis-soft-gold p-4 text-sm leading-6 text-artis-slate">
            Returning players who have already received a jersey should continue
            using their existing jersey.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-[10px] bg-artis-deep-navy p-5 text-artis-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="max-w-3xl">
            <h3 className="font-bold">Program start</h3>
            <p className="mt-1 text-sm leading-6 text-artis-white/75">
              Programs begin on the first day of the month. Registrations made
              after a month has started begin the following month.
            </p>
          </div>
          <p className="w-fit shrink-0 rounded-full bg-artis-white px-4 py-2 text-sm font-bold text-artis-navy">
            <span suppressHydrationWarning>{formatProgramStart()}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

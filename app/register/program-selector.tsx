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

const longDayNames: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
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

  const trainingSessions = selectedGroup.weeklySchedule
    .filter((session) => session.sessionType !== "game_training")
    .sort(
      (first, second) =>
        (dayOrder[first.dayOfWeek] ?? 8) - (dayOrder[second.dayOfWeek] ?? 8),
    );
  const gameSessions = selectedGroup.weeklySchedule
    .filter((session) => session.sessionType === "game_training")
    .sort(
      (first, second) =>
        (dayOrder[first.dayOfWeek] ?? 8) - (dayOrder[second.dayOfWeek] ?? 8),
    );
  const firstTrainingSession = trainingSessions[0];
  const firstGameSession = gameSessions[0];
  const trainingDaysLong = trainingSessions.map(
    (session) => longDayNames[session.dayOfWeek] ?? session.dayOfWeek,
  );
  const trainingDaysShort = trainingSessions.map(
    (session) => shortDayNames[session.dayOfWeek] ?? session.dayOfWeek,
  );
  const gameDaysLong = gameSessions.map(
    (session) => longDayNames[session.dayOfWeek] ?? session.dayOfWeek,
  );
  const gameDaysShort = gameSessions.map(
    (session) => shortDayNames[session.dayOfWeek] ?? session.dayOfWeek,
  );
  const taxLabel =
    selectedPackage.taxBehavior === "exclusive" ? " + HST" : " (HST included)";

  return (
    <section className="rounded-2xl border border-artis-border bg-artis-white p-6 text-base leading-[25px]">
      <h2 className="font-normal uppercase">Program selection</h2>

      <fieldset className="mt-1">
        <legend className="sr-only">Age group</legend>
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6">
          <span aria-hidden="true">Age group:</span>
          {trainingGroups.map((group) => (
            <label
              key={group.id}
              className="flex cursor-pointer items-center gap-1.5"
            >
              <input
                type="radio"
                name="trainingGroupId"
                value={group.id}
                checked={group.id === selectedGroupId}
                onChange={() => setSelectedGroupId(group.id)}
                required
                className="size-4 shrink-0 accent-artis-navy"
              />
              <span>{group.displayName}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-7 sm:mt-1">
        <legend className="sr-only">Term</legend>
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6">
          <span aria-hidden="true" className="mb-1 uppercase sm:mb-0">
            Term:
          </span>
          {programPackages.map((programPackage) => (
            <label
              key={programPackage.id}
              className="flex cursor-pointer items-center gap-1.5"
            >
              <input
                type="radio"
                name="programPackageId"
                value={programPackage.id}
                checked={programPackage.id === selectedPackageId}
                onChange={() => setSelectedPackageId(programPackage.id)}
                required
                className="size-4 shrink-0 accent-artis-navy"
              />
              <span>
                {formatPackageDuration(programPackage.durationMonths)} —{" "}
                {formatCurrency(
                  programPackage.priceCents,
                  programPackage.currency,
                )}
                {programPackage.taxBehavior === "exclusive"
                  ? " + HST"
                  : " (HST included)"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-7 sm:mt-1">
        <p>
          Schedule: {joinDays(trainingDaysLong, " + ")} training
          {gameDaysLong.length > 0
            ? ` · ${joinDays(gameDaysLong, " + ")} game / match`
            : ""}
        </p>

        <output aria-live="polite" className="mt-7 block sm:mt-1">
          <span className="block sm:hidden">Selected example:</span>
          <span className="hidden sm:inline">Selected example: </span>
          <span className="hidden sm:inline">{selectedGroup.displayName}</span>
          {firstTrainingSession ? (
            <>
              <span className="block sm:hidden">
                {joinDays(trainingDaysShort, " + ")} ·{" "}
                {formatTimeRange(
                  firstTrainingSession.startTime,
                  firstTrainingSession.endTime,
                )}
              </span>
              <span className="hidden sm:inline">
                {` · ${joinDays(trainingDaysShort, "/")} ${formatTimeRange(
                  firstTrainingSession.startTime,
                  firstTrainingSession.endTime,
                )}`}
              </span>
            </>
          ) : null}
          {firstGameSession ? (
            <>
              <span className="block sm:hidden">
                {joinDays(gameDaysShort, " + ")} ·{" "}
                {formatTimeRange(
                  firstGameSession.startTime,
                  firstGameSession.endTime,
                )}{" "}
                Game / Match
              </span>
              <span className="hidden sm:inline">
                {` · ${joinDays(gameDaysShort, "/")} ${formatTimeRange(
                  firstGameSession.startTime,
                  firstGameSession.endTime,
                )}`}
              </span>
            </>
          ) : null}
          <span className="sr-only">
            {` · ${selectedPackage.displayName} · ${formatCurrency(
              selectedPackage.priceCents,
              selectedPackage.currency,
            )}${taxLabel}`}
          </span>
        </output>

        <p>Location: Central Huron Secondary School gym</p>
        <p>Capacity: Limited to {selectedGroup.capacity} players.</p>
      </div>

      <div className="mt-7">
        <h3 className="font-normal uppercase">Jersey information</h3>
        <p>Jersey size — [Size options pending client confirmation]</p>
        <p>Preferred name to appear on jersey — Enter name</p>
        <p>
          One personalized ARTIS Soccer Academy jersey is provided per player
          per year. Returning players who have already received a jersey should
          continue using their existing jersey.
        </p>
      </div>

      <div className="mt-7">
        <p>
          Programs begin on the first day of the month. Registrations submitted
          after the month has started begin the following month.
        </p>
        <p>
          Program start:{" "}
          <span suppressHydrationWarning>{formatProgramStart()}</span>
        </p>
      </div>
    </section>
  );
}

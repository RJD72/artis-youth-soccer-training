// These calculations run on the server so a visitor cannot choose their own
// price, tax amount, program dates, or age. The future registration action must
// pass values read from the database—not prices or dates sent by the browser.

import "server-only";

export type TaxBehavior = "exclusive" | "inclusive";

export type RegistrationPricing = {
  packagePriceCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

export type RegistrationPeriod = {
  startsOn: string;
  endsOn: string;
};

const ONTARIO_HST_RATE_PERCENT = 13;
const MAXIMUM_MYSQL_UNSIGNED_INTEGER = 4_294_967_295;

function requireSafePositiveInteger(value: number, name: string): void {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > MAXIMUM_MYSQL_UNSIGNED_INTEGER
  ) {
    throw new TypeError(`${name} must be a safe positive integer.`);
  }
}

function requireValidDate(value: Date, name: string): void {
  if (Number.isNaN(value.getTime())) {
    throw new TypeError(`${name} must be a valid date.`);
  }
}

function formatUtcDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTorontoCalendarDate(value: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw new TypeError("The current Toronto calendar date could not be read.");
  }

  return { year, month, day };
}

function parseIsoCalendarDate(
  value: string,
  name: string,
): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new TypeError(`${name} must use the YYYY-MM-DD format.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new TypeError(`${name} must be a real calendar date.`);
  }

  return { year, month, day };
}

export function calculateRegistrationPricing(
  packagePriceCents: number,
  taxBehavior: TaxBehavior,
): RegistrationPricing {
  requireSafePositiveInteger(packagePriceCents, "Package price");

  if (taxBehavior === "exclusive") {
    const taxCents = Math.round(
      (packagePriceCents * ONTARIO_HST_RATE_PERCENT) / 100,
    );
    const totalCents = packagePriceCents + taxCents;

    requireSafePositiveInteger(totalCents, "Payment total");

    return {
      packagePriceCents,
      subtotalCents: packagePriceCents,
      taxCents,
      totalCents,
    };
  }

  if (taxBehavior === "inclusive") {
    const taxCents = Math.round(
      (packagePriceCents * ONTARIO_HST_RATE_PERCENT) /
        (100 + ONTARIO_HST_RATE_PERCENT),
    );

    return {
      packagePriceCents,
      subtotalCents: packagePriceCents - taxCents,
      taxCents,
      totalCents: packagePriceCents,
    };
  }

  throw new TypeError("The package tax behavior is invalid.");
}

export function calculateRegistrationPeriod(
  durationMonths: number,
  now = new Date(),
): RegistrationPeriod {
  requireSafePositiveInteger(durationMonths, "Program duration");
  requireValidDate(now, "Current date");

  const torontoDate = getTorontoCalendarDate(now);
  const startMonthOffset = torontoDate.day === 1 ? 0 : 1;
  const startsOnDate = new Date(
    Date.UTC(torontoDate.year, torontoDate.month - 1 + startMonthOffset, 1),
  );
  const endsOnDate = new Date(
    Date.UTC(
      startsOnDate.getUTCFullYear(),
      startsOnDate.getUTCMonth() + durationMonths,
      0,
    ),
  );

  return {
    startsOn: formatUtcDate(startsOnDate),
    endsOn: formatUtcDate(endsOnDate),
  };
}

export function calculateAgeOnDate(
  dateOfBirth: string,
  onDate: string,
): number {
  const birthDate = parseIsoCalendarDate(dateOfBirth, "Date of birth");
  const comparisonDate = parseIsoCalendarDate(onDate, "Comparison date");
  let age = comparisonDate.year - birthDate.year;

  const birthdayHasOccurred =
    comparisonDate.month > birthDate.month ||
    (comparisonDate.month === birthDate.month &&
      comparisonDate.day >= birthDate.day);

  if (!birthdayHasOccurred) {
    age -= 1;
  }

  if (age < 0) {
    throw new TypeError("Date of birth cannot be after the comparison date.");
  }

  return age;
}

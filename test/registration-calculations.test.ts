import { describe, expect, it } from "@jest/globals";

import {
  calculateAgeOnDate,
  calculateRegistrationPeriod,
  calculateRegistrationPricing,
} from "@/lib/registration-calculations";

describe("calculateRegistrationPricing", () => {
  it("adds 13% Ontario HST to a tax-exclusive price", () => {
    expect(calculateRegistrationPricing(10_000, "exclusive")).toEqual({
      packagePriceCents: 10_000,
      subtotalCents: 10_000,
      taxCents: 1_300,
      totalCents: 11_300,
    });
  });

  it("rounds tax-exclusive prices to the nearest cent", () => {
    expect(calculateRegistrationPricing(9_999, "exclusive")).toEqual({
      packagePriceCents: 9_999,
      subtotalCents: 9_999,
      taxCents: 1_300,
      totalCents: 11_299,
    });
  });

  it("extracts Ontario HST from a tax-inclusive price", () => {
    expect(calculateRegistrationPricing(11_300, "inclusive")).toEqual({
      packagePriceCents: 11_300,
      subtotalCents: 10_000,
      taxCents: 1_300,
      totalCents: 11_300,
    });
  });

  it.each([0, -1, 1.5, Number.NaN, 4_294_967_296])(
    "rejects the invalid package price %s",
    (price) => {
      expect(() => calculateRegistrationPricing(price, "exclusive")).toThrow(
        "Package price must be a safe positive integer.",
      );
    },
  );

  it("rejects a total that cannot fit in the database", () => {
    expect(() =>
      calculateRegistrationPricing(4_294_967_295, "exclusive"),
    ).toThrow("Payment total must be a safe positive integer.");
  });

  it("rejects an unsupported tax behaviour", () => {
    expect(() =>
      calculateRegistrationPricing(10_000, "none" as "exclusive"),
    ).toThrow("The package tax behavior is invalid.");
  });
});

describe("calculateRegistrationPeriod", () => {
  it("starts immediately when Toronto's calendar date is the first", () => {
    expect(
      calculateRegistrationPeriod(1, new Date("2026-01-01T15:00:00.000Z")),
    ).toEqual({
      startsOn: "2026-01-01",
      endsOn: "2026-01-31",
    });
  });

  it("starts on the following month when registration occurs after the first", () => {
    expect(
      calculateRegistrationPeriod(1, new Date("2026-01-02T15:00:00.000Z")),
    ).toEqual({
      startsOn: "2026-02-01",
      endsOn: "2026-02-28",
    });
  });

  it("calculates a multi-month period", () => {
    expect(
      calculateRegistrationPeriod(3, new Date("2026-01-15T15:00:00.000Z")),
    ).toEqual({
      startsOn: "2026-02-01",
      endsOn: "2026-04-30",
    });
  });

  it("uses Toronto's date near a UTC calendar boundary", () => {
    expect(
      calculateRegistrationPeriod(1, new Date("2026-05-02T03:00:00.000Z")),
    ).toEqual({
      startsOn: "2026-05-01",
      endsOn: "2026-05-31",
    });
  });

  it("handles a leap-year February", () => {
    expect(
      calculateRegistrationPeriod(1, new Date("2028-02-01T15:00:00.000Z")),
    ).toEqual({
      startsOn: "2028-02-01",
      endsOn: "2028-02-29",
    });
  });

  it("handles a period crossing into a new year", () => {
    expect(
      calculateRegistrationPeriod(2, new Date("2026-12-02T15:00:00.000Z")),
    ).toEqual({
      startsOn: "2027-01-01",
      endsOn: "2027-02-28",
    });
  });

  it.each([0, -1, 1.5, Number.NaN, 4_294_967_296])(
    "rejects the invalid program duration %s",
    (durationMonths) => {
      expect(() =>
        calculateRegistrationPeriod(durationMonths, new Date()),
      ).toThrow("Program duration must be a safe positive integer.");
    },
  );

  it("rejects an invalid current date", () => {
    expect(() => calculateRegistrationPeriod(1, new Date("invalid"))).toThrow(
      "Current date must be a valid date.",
    );
  });
});

describe("calculateAgeOnDate", () => {
  it("returns the age when the birthday is today", () => {
    expect(calculateAgeOnDate("2015-06-15", "2026-06-15")).toBe(11);
  });

  it("does not add a year before the birthday", () => {
    expect(calculateAgeOnDate("2015-06-15", "2026-06-14")).toBe(10);
  });

  it("returns the age after the birthday", () => {
    expect(calculateAgeOnDate("2015-06-15", "2026-06-16")).toBe(11);
  });

  it("handles a February 29 birthday", () => {
    expect(calculateAgeOnDate("2012-02-29", "2026-02-28")).toBe(13);
    expect(calculateAgeOnDate("2012-02-29", "2026-03-01")).toBe(14);
  });

  it("returns zero when both dates are the same", () => {
    expect(calculateAgeOnDate("2026-09-07", "2026-09-07")).toBe(0);
  });

  it.each([
    ["2015/06/15", "2026-06-15", "Date of birth"],
    ["2015-06-15", "2026/06/15", "Comparison date"],
  ])(
    "rejects a date using the wrong format",
    (dateOfBirth, onDate, fieldName) => {
      expect(() => calculateAgeOnDate(dateOfBirth, onDate)).toThrow(
        `${fieldName} must use the YYYY-MM-DD format.`,
      );
    },
  );

  it.each([
    ["2015-02-30", "2026-06-15", "Date of birth"],
    ["2015-06-15", "2026-02-30", "Comparison date"],
  ])("rejects a date that does not exist", (dateOfBirth, onDate, fieldName) => {
    expect(() => calculateAgeOnDate(dateOfBirth, onDate)).toThrow(
      `${fieldName} must be a real calendar date.`,
    );
  });

  it("rejects a birth date after the comparison date", () => {
    expect(() => calculateAgeOnDate("2027-01-01", "2026-12-31")).toThrow(
      "Date of birth cannot be after the comparison date.",
    );
  });
});

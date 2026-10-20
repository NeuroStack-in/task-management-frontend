import { describe, expect, it } from "vitest";

import {
  DEFAULT_CALENDAR,
  freeDays,
  isWorkingDay,
  workingDays,
  workingPortions,
  type WorkCalendar,
} from "./working-days";

const withHolidays = (...h: string[]): WorkCalendar => ({ ...DEFAULT_CALENDAR, holidays: new Set(h) });

/** The same cases as the server's `working_day_tests`, so the preview and the charge agree. */
describe("working days (TIME-07)", () => {
  it("a weekend inside the dates costs nothing", () => {
    expect(workingDays("2026-10-09", "2026-10-12", DEFAULT_CALENDAR)).toBe(2); // Fri → Mon
    expect(freeDays("2026-10-09", "2026-10-12", DEFAULT_CALENDAR)).toBe(2);
    expect(workingDays("2026-10-10", "2026-10-11", DEFAULT_CALENDAR)).toBe(0);
  });

  it("a holiday inside the dates costs nothing", () => {
    expect(workingDays("2026-10-12", "2026-10-16", withHolidays("2026-10-14"))).toBe(4);
  });

  it("the org's week decides what a weekend is", () => {
    const sunThu: WorkCalendar = { ...DEFAULT_CALENDAR, workdays: [1, 2, 3, 4, 7] };
    expect(workingDays("2026-10-09", "2026-10-12", sunThu)).toBe(2);
    expect(isWorkingDay("2026-10-11", sunThu)).toBe(true);
    expect(isWorkingDay("2026-10-09", sunThu)).toBe(false);
  });

  it("refuses a backwards or impossible range", () => {
    expect(workingDays("2026-10-12", "2026-10-09", DEFAULT_CALENDAR)).toBe(0);
    expect(workingDays("2026-02-31", "2026-03-02", DEFAULT_CALENDAR)).toBe(0);
  });

  it("splits a year-crossing request by working days", () => {
    expect(workingPortions("2026-12-29", "2027-01-04", 4, withHolidays("2027-01-01"))).toEqual([
      ["2026", 3],
      ["2027", 1],
    ]);
    expect(workingPortions("2026-10-12", "2026-10-12", 0.25, DEFAULT_CALENDAR)).toEqual([
      ["2026", 0.25],
    ]);
  });
});

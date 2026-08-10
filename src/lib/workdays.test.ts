import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKDAYS,
  isWorkday,
  isoWeekday,
  safeWorkdays,
  type IsoWeekday,
} from "./workdays";

// 2026-08-10 is a Monday; the week runs Mon 10th … Sun 16th.
const aug = (day: number) => new Date(2026, 7, day);

describe("isoWeekday", () => {
  it("maps JS Sunday (0) to ISO 7, not 0", () => {
    expect(isoWeekday(aug(16))).toBe(7); // Sunday
    expect(isoWeekday(aug(10))).toBe(1); // Monday
    expect(isoWeekday(aug(15))).toBe(6); // Saturday
  });
});

describe("isWorkday", () => {
  it("honours a Mon–Fri schedule", () => {
    expect(isWorkday(aug(10), DEFAULT_WORKDAYS)).toBe(true); // Mon
    expect(isWorkday(aug(14), DEFAULT_WORKDAYS)).toBe(true); // Fri
    expect(isWorkday(aug(15), DEFAULT_WORKDAYS)).toBe(false); // Sat
    expect(isWorkday(aug(16), DEFAULT_WORKDAYS)).toBe(false); // Sun
  });

  it("honours a Sun–Thu week — the case Mon–Fri hardcoding got wrong", () => {
    const sunThu: IsoWeekday[] = [1, 2, 3, 4, 7];
    expect(isWorkday(aug(16), sunThu)).toBe(true); // Sunday now works
    expect(isWorkday(aug(14), sunThu)).toBe(false); // Friday is now off
  });

  it("honours a six-day week", () => {
    const sixDay: IsoWeekday[] = [1, 2, 3, 4, 5, 6];
    expect(isWorkday(aug(15), sixDay)).toBe(true); // Saturday
    expect(isWorkday(aug(16), sixDay)).toBe(false); // Sunday
  });
});

describe("safeWorkdays", () => {
  it("falls back rather than scheduling nothing", () => {
    // An empty schedule would make every aggregation return an empty range.
    expect(safeWorkdays([])).toEqual(DEFAULT_WORKDAYS);
    expect(safeWorkdays(null)).toEqual(DEFAULT_WORKDAYS);
    expect(safeWorkdays(undefined)).toEqual(DEFAULT_WORKDAYS);
  });

  it("passes a real schedule through", () => {
    expect(safeWorkdays([1, 2, 3, 4, 7])).toEqual([1, 2, 3, 4, 7]);
  });

  it("copies, so a caller cannot mutate the shared default", () => {
    const got = safeWorkdays([]);
    got.push(6);
    expect(DEFAULT_WORKDAYS).toEqual([1, 2, 3, 4, 5]);
  });
});

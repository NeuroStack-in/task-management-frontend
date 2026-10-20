import { describe, expect, it } from "vitest";
import { daysPhrase, formatDays, formatHoursOff, formatHoursShort } from "./days";

describe("formatDays", () => {
  it("keeps whole days whole", () => {
    expect(formatDays(20)).toBe("20");
    expect(formatDays(0)).toBe("0");
  });

  /** WP-479: a 45-minute permission leaves 19.90625 of 20 days. */
  it("rounds permission fractions to two decimals", () => {
    expect(formatDays(19.90625)).toBe("19.91");
    expect(formatDays(0.09375)).toBe("0.09");
    expect(formatDays(2.5)).toBe("2.5");
  });

  it("never prints a negative zero or a non-number", () => {
    expect(formatDays(-0.001)).toBe("0");
    expect(formatDays(Number.NaN)).toBe("—");
  });
});

describe("daysPhrase", () => {
  it("says a fraction as part of a day", () => {
    expect(daysPhrase(0.25)).toBe("0.25 of a day");
  });

  it("pluralises whole and mixed figures", () => {
    expect(daysPhrase(1)).toBe("1 day");
    expect(daysPhrase(3)).toBe("3 days");
    expect(daysPhrase(1.5)).toBe("1.5 days");
  });
});

/** TIME-08: hours off read as hours, never as a stopwatch reading or a fraction of a day. */
describe("formatHoursShort / formatHoursOff", () => {
  it("prints whole hours, minutes, and the two together", () => {
    expect(formatHoursShort(120)).toBe("2 h");
    expect(formatHoursShort(90)).toBe("1 h 30 min");
    expect(formatHoursShort(45)).toBe("45 min");
    expect(formatHoursShort(240)).toBe("4 h");
  });

  it("degrades instead of printing nonsense", () => {
    expect(formatHoursShort(0)).toBe("0 min");
    expect(formatHoursShort(Number.NaN)).toBe("0 min");
  });

  it("lists a request as hours off", () => {
    expect(formatHoursOff(120)).toBe("2 h off");
    expect(formatHoursOff(30)).toBe("30 min off");
  });
});

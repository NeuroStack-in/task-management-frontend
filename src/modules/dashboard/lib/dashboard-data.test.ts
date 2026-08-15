import { describe, expect, it } from "vitest";

import { singleDayOf } from "./dashboard-data";

describe("singleDayOf", () => {
  /**
   * **The bug.** Selecting "Aug 15 – Aug 15" showed "there isn't one for a custom range" — but that
   * is a day, and a daily narrative for it exists. A hand-picked Saturday therefore looked like it
   * had no dashboard at all.
   */
  it("treats a one-day custom range as that day", () => {
    expect(singleDayOf("range", ["2026-08-15"])).toBe("2026-08-15");
  });

  /** A genuine span has no cached narrative and no endpoint that would build one. */
  it("returns null for a multi-day custom range", () => {
    expect(singleDayOf("range", ["2026-08-14", "2026-08-15"])).toBeNull();
  });

  /**
   * The preset modes have their own endpoints (daily / weekly / monthly report), so they must not be
   * re-routed through the single-day path even when they happen to resolve to one day.
   */
  it("leaves the preset ranges alone", () => {
    expect(singleDayOf("today", ["2026-08-15"])).toBeNull();
    expect(singleDayOf("7d", ["2026-08-15"])).toBeNull();
    expect(singleDayOf("30d", ["2026-08-15"])).toBeNull();
  });

  /** An unresolved or empty range must not be mistaken for a day. */
  it("handles missing and empty day sets", () => {
    expect(singleDayOf("range", undefined)).toBeNull();
    expect(singleDayOf("range", [])).toBeNull();
  });
});

import { foldToWeeks, type TrendPoint } from "./dashboard-data";

const day = (iso: string, p: number, n: number): TrendPoint => ({
  label: iso,
  iso,
  productiveH: p,
  neutralH: n,
  distractingH: 0,
  unclassifiedH: 0,
  reported: 1,
});

describe("foldToWeeks", () => {
  /**
   * A month per-day is ~22 slivers with colliding labels — the shape of the month, which is the only
   * thing a month view is read for, disappears into noise.
   */
  it("collapses a month of days into one bar per ISO week", () => {
    // Mon 2026-08-03 … Sun 2026-08-16: exactly two ISO weeks.
    const days = [
      "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07",
      "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14",
    ].map((d) => day(d, 2, 1));
    const weeks = foldToWeeks(days);
    expect(weeks).toHaveLength(2);
    expect(weeks[0].iso).toBe("2026-08-03");
    expect(weeks[1].iso).toBe("2026-08-10");
  });

  /** Hours are SUMMED, so the bar height still means "hours tracked" — averaging would silently
   *  change what the y-axis measures halfway through the range picker. */
  it("sums hours rather than averaging them", () => {
    const weeks = foldToWeeks([day("2026-08-03", 2, 1), day("2026-08-04", 3, 1.5)]);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].productiveH).toBe(5);
    expect(weeks[0].neutralH).toBe(2.5);
  });

  /** Weeks start Monday, matching the weekly AI report and the attendance week. A Sunday belongs to
   *  the week that began the previous Monday, not to the one starting the next day. */
  it("puts Sunday in the week that started on Monday", () => {
    const weeks = foldToWeeks([day("2026-08-09", 1, 0), day("2026-08-03", 1, 0)]);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].iso).toBe("2026-08-03");
  });

  /** Output is chronological regardless of input order — bars must not jump around. */
  it("returns weeks in order", () => {
    const weeks = foldToWeeks([day("2026-08-12", 1, 0), day("2026-08-04", 1, 0)]);
    expect(weeks.map((w) => w.iso)).toEqual(["2026-08-03", "2026-08-10"]);
  });

  it("handles an empty range", () => {
    expect(foldToWeeks([])).toEqual([]);
  });
});

describe("foldToWeeks coverage", () => {
  /**
   * `reported` is a count of PEOPLE, so it cannot be summed the way hours are — the same person
   * reporting Monday and Tuesday is one person, and adding would claim ten reporters in a team of
   * five. It also cannot be the first day's value, which is what a naive spread produces.
   */
  it("takes the week's peak coverage, never the sum or the first day", () => {
    const a: TrendPoint = { ...day("2026-08-03", 1, 0), reported: 2 };
    const b: TrendPoint = { ...day("2026-08-04", 1, 0), reported: 5 };
    const c: TrendPoint = { ...day("2026-08-05", 1, 0), reported: 3 };
    const [week] = foldToWeeks([a, b, c]);
    expect(week.reported).toBe(5);
  });
});

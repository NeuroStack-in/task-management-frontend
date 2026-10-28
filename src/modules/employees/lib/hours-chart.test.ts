import { describe, expect, it } from "vitest";
import { NO_ATTENDANCE, dayLabel, hoursFromActivity, hoursFromTimesheet } from "./hours-chart";

/**
 * AI-63: the profile's "Hours worked" chart said "No work recorded in the last 30 days" for an
 * employee with three 1-hour corrections, because it read the activity rollup, not the timesheet.
 */
describe("hoursFromTimesheet", () => {
  const cutoff = "2026-09-23";

  it("draws corrected and timer hours alike — the QA org's three 1-hour days", () => {
    const days = [
      { date: "2026-10-20", total_secs: 3600 },
      { date: "2026-10-17", total_secs: 3600 },
      { date: "2026-10-19", total_secs: 3600 },
    ];
    const bars = hoursFromTimesheet(days, new Map(), cutoff);
    expect(bars.map((b) => b.date)).toEqual(["2026-10-17", "2026-10-19", "2026-10-20"]);
    expect(bars.every((b) => b.hours === 1)).toBe(true);
    expect(bars.reduce((s, b) => s + b.hours, 0)).toBe(3);
  });

  it("colours a day by the attendance verdict it has, and never invents one", () => {
    const bars = hoursFromTimesheet(
      [
        { date: "2026-10-19", total_secs: 5400 },
        { date: "2026-10-20", total_secs: 3600 },
      ],
      new Map([["2026-10-20", "partial"]]),
      cutoff,
    );
    expect(bars[0]).toMatchObject({ status: NO_ATTENDANCE, hours: 1.5, label: "Oct 19" });
    expect(bars[1].status).toBe("partial");
  });

  it("leaves out empty days and days before the window — absent, not a measured zero", () => {
    const bars = hoursFromTimesheet(
      [
        { date: "2026-10-18", total_secs: 0 },
        { date: "2026-09-01", total_secs: 7200 },
        { date: "2026-10-21", total_secs: 60 },
      ],
      new Map(),
      cutoff,
    );
    expect(bars.map((b) => b.date)).toEqual(["2026-10-21"]);
    // Exact, not rounded to a tenth: one minute is one minute.
    expect(bars[0].hours).toBeCloseTo(1 / 60, 10);
  });
});

describe("hoursFromActivity (the fallback when the timesheet can't be read)", () => {
  it("uses worked minutes once the day closed, else active time", () => {
    const bars = hoursFromActivity(
      [
        { date: "2026-10-20", activeSec: 1800, workedMinutes: 90, attendance: "present" },
        { date: "2026-10-21", activeSec: 1800, workedMinutes: 0, attendance: "" },
      ],
      "2026-09-23",
    );
    expect(bars[0]).toMatchObject({ hours: 1.5, status: "present" });
    expect(bars[1]).toMatchObject({ hours: 0.5, status: "unknown" });
  });
});

describe("dayLabel", () => {
  it("is a compact month-day label", () => {
    expect(dayLabel("2026-08-05")).toBe("Aug 5");
  });
});

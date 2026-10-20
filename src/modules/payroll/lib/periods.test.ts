import { describe, expect, it } from "vitest";

import { lastCompletedPeriod, periodLabel, periodOf, recentPeriods } from "./periods";

describe("pay periods (TIME-20)", () => {
  const oct20 = new Date(2026, 9, 20);

  it("defaults to the last month that has ended", () => {
    expect(lastCompletedPeriod(oct20)).toBe("2026-09");
    // Across a year boundary.
    expect(lastCompletedPeriod(new Date(2027, 0, 3))).toBe("2026-12");
  });

  it("offers this month and the ones before it, newest first, never a future month", () => {
    const list = recentPeriods(oct20, 14);
    expect(list).toHaveLength(14);
    expect(list[0]).toBe("2026-10");
    expect(list[1]).toBe("2026-09");
    expect(list[10]).toBe("2025-12");
    expect(list[13]).toBe("2025-09");
    expect(list.every((p) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p))).toBe(true);
  });

  it("does not skip or repeat a month at the end of a long month", () => {
    // Jan 31 → "one month back" must be December, not a rolled-over date.
    expect(periodOf(new Date(2027, 0, 31), -1)).toBe("2026-12");
    expect(periodOf(new Date(2026, 2, 31), -1)).toBe("2026-02");
  });

  it("labels a period by month name, and leaves junk alone", () => {
    expect(periodLabel("2026-09")).toBe(
      new Date(2026, 8, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    );
    expect(periodLabel("2026-13")).toBe("2026-13");
  });
});

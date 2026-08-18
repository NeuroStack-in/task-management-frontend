import { describe, expect, it } from "vitest";

import { buildHolidayIndex } from "./use-org-holidays";

describe("buildHolidayIndex", () => {
  it("indexes holiday dates into a set and a name lookup", () => {
    const idx = buildHolidayIndex([
      { id: "1", name: "New Year's Day", date: "2026-01-01" },
      { id: "2", name: "Independence Day", date: "2026-07-04" },
    ]);

    expect(idx.dates).toEqual(new Set(["2026-01-01", "2026-07-04"]));
    expect(idx.isHoliday("2026-01-01")).toBe(true);
    expect(idx.isHoliday("2026-07-04")).toBe(true);
    expect(idx.nameFor("2026-07-04")).toBe("Independence Day");
  });

  it("reports non-holiday dates as false with no name", () => {
    const idx = buildHolidayIndex([
      { id: "1", name: "New Year's Day", date: "2026-01-01" },
    ]);

    expect(idx.isHoliday("2026-01-02")).toBe(false);
    expect(idx.nameFor("2026-01-02")).toBeUndefined();
  });

  it("is empty for an empty list", () => {
    const idx = buildHolidayIndex([]);
    expect(idx.dates.size).toBe(0);
    expect(idx.isHoliday("2026-01-01")).toBe(false);
  });

  it("skips rows without a date rather than adding an empty key", () => {
    const idx = buildHolidayIndex([
      { id: "1", name: "Floating holiday", date: "" },
      { id: "2", name: "Labor Day", date: "2026-09-07" },
    ]);

    expect(idx.dates.has("")).toBe(false);
    expect(idx.dates).toEqual(new Set(["2026-09-07"]));
  });

  it("does not crash on duplicate dates (last name wins)", () => {
    const idx = buildHolidayIndex([
      { id: "1", name: "Old name", date: "2026-12-25" },
      { id: "2", name: "Christmas Day", date: "2026-12-25" },
    ]);

    expect(idx.dates.size).toBe(1);
    expect(idx.nameFor("2026-12-25")).toBe("Christmas Day");
  });
});

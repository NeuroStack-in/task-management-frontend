import { describe, expect, it } from "vitest";

import { formatDate, formatDateRange, formatDateTime } from "./format";

/** XC-06: one date notation, never shifted a day by the viewer's time zone. */
describe("formatDate", () => {
  it("reads a YYYY-MM-DD as that calendar day", () => {
    const d = new Date(2026, 9, 16);
    expect(formatDate("2026-10-16")).toBe(
      d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
    );
  });

  it("adds the weekday on request and drops the year on request", () => {
    expect(formatDate("2026-10-16", { weekday: true })).toMatch(/Fri/);
    expect(formatDate("2026-10-16", { year: false })).not.toMatch(/2026/);
  });

  it("never throws on junk", () => {
    expect(formatDate("nope")).toBe("—");
    expect(formatDateTime(Number.NaN)).toBe("—");
    expect(formatDateRange("x", "2026-10-16")).toBe("—");
  });

  it("formats ranges, one day as that day", () => {
    expect(formatDateRange("2026-10-16", "2026-10-16")).toBe(formatDate("2026-10-16"));
    expect(formatDateRange("2026-10-16", "2026-10-20")).toContain("–");
  });
});

import { describe, expect, it } from "vitest";
import { reportsWindow } from "../use-reports-data";
import { packWindow, windowSuffix } from "./report-export";
import type { ReportDef } from "./report-def";

const MON_FRI = [1, 2, 3, 4, 5] as const;

/**
 * MON-05: the library follows the page's date, and every file names its window. A page on 16 Oct
 * used to show cards for 15 Oct and the week of 12 Oct, and "Download all" exported that window.
 */
describe("reportsWindow", () => {
  it("covers the page's own day, and its week up to it", () => {
    // Fri 16 Oct 2026.
    const w = reportsWindow("2026-10-16", MON_FRI, "2026-10-20");
    expect(w.day).toBe("2026-10-16");
    expect(w.from).toBe("2026-10-12");
    expect(w.to).toBe("2026-10-16");
    expect(w.workdays).toBe(5);
    expect(w.dayLabel).not.toContain("so far");
  });

  it("never runs the week past the page's day", () => {
    const w = reportsWindow("2026-10-14", MON_FRI, "2026-10-20");
    expect(w.to).toBe("2026-10-14");
    expect(w.workdays).toBe(3);
  });

  it("marks today's windows as still filling in", () => {
    const w = reportsWindow("2026-10-20", MON_FRI, "2026-10-20");
    expect(w.dayLabel).toContain("(so far)");
    expect(w.weekLabel).toContain("(so far)");
  });

  it("follows the org's own week, not Monday's", () => {
    // A Sun–Thu org, page on Wed 14 Oct: its week began Sun 11 Oct.
    const w = reportsWindow("2026-10-14", [7, 1, 2, 3, 4], "2026-10-20");
    expect(w.from).toBe("2026-10-11");
  });
});

describe("export file names", () => {
  it("carry the day, or the range", () => {
    expect(windowSuffix({ from: "2026-10-16", to: "2026-10-16" })).toBe("-2026-10-16");
    expect(windowSuffix({ from: "2026-10-12", to: "2026-10-16" })).toBe("-2026-10-12_to_2026-10-16");
    expect(windowSuffix(undefined)).toBe("");
  });

  it("name a pack by the span its reports fall within", () => {
    const r = (from: string, to: string): ReportDef => ({
      id: "x",
      name: "X",
      description: "",
      category: "time",
      columns: [],
      rows: [],
      window: { from, to },
    });
    expect(packWindow([r("2026-10-16", "2026-10-16"), r("2026-10-12", "2026-10-16")])).toEqual({
      from: "2026-10-12",
      to: "2026-10-16",
    });
    expect(packWindow([])).toBeUndefined();
  });
});

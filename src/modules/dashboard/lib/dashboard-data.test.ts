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

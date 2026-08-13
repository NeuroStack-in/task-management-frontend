import { describe, expect, it } from "vitest";

import { expectedMinutes } from "./working-hours-manager";

/**
 * This preview must agree with `insights::shared::org::expected_sec_of`, which is what the
 * productivity score actually divides by (`backend/docs/PRODUCTIVITY.md` §1.2). The two are
 * separate implementations in different languages, so nothing but these cases keeps them in step —
 * and a silent divergence means an admin reads "8h" on this screen while everyone is scored against
 * something else.
 */
describe("expectedMinutes — parity with the backend's expected day", () => {
  const day = (work_start: string, work_end: string, break_minutes: number) => ({
    work_start,
    work_end,
    break_minutes,
  });

  it("the product default 09:00–18:00 less a 60m break is eight hours", () => {
    // The constant the scorer used before it read this setting. If this moves, every default
    // org's utilization moves with it.
    expect(expectedMinutes(day("09:00", "18:00", 60))).toBe(480);
  });

  it("a declared short day is a short day", () => {
    // The fairness case: a 6h contract is measured against six hours, not eight.
    expect(expectedMinutes(day("10:00", "16:00", 0))).toBe(360);
  });

  it("the break is subtracted from the span", () => {
    expect(expectedMinutes(day("09:00", "17:30", 30))).toBe(480);
  });

  it("an inverted, zero-length or unparseable span is null, never negative", () => {
    // `null` signals the server will fall back to its 8h default, which is what the card says.
    expect(expectedMinutes(day("18:00", "09:00", 0))).toBeNull();
    expect(expectedMinutes(day("09:00", "09:00", 0))).toBeNull();
    expect(expectedMinutes(day("bad", "18:00", 0))).toBeNull();
    expect(expectedMinutes(day("25:00", "26:00", 0))).toBeNull();
  });

  it("a break longer than the day floors at an hour instead of going negative", () => {
    expect(expectedMinutes(day("09:00", "10:00", 600))).toBe(60);
  });

  it("a blank or negative break is treated as none rather than extending the day", () => {
    expect(expectedMinutes(day("09:00", "17:00", 0))).toBe(480);
    expect(expectedMinutes(day("09:00", "17:00", -60))).toBe(480);
    expect(expectedMinutes(day("09:00", "17:00", NaN))).toBe(480);
  });
});

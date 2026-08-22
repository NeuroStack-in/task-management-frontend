import { describe, expect, it } from "vitest";

import { formatGenerated } from "./reports-experimental";

/**
 * The executive summary rendered **"Generated 30/04/58610, 21:32:13"**.
 *
 * `generated_at` is epoch **milliseconds** — the backend stamps it with `now_ms()`, which is
 * `as_millis()` — and this surface multiplied it by 1000 as though it were seconds. A date thirty
 * thousand years out is exactly what that mix-up looks like, and the dashboard's copy of the same
 * line never had the bug, so two surfaces disagreed about one field.
 */
describe("formatGenerated", () => {
  const AUG_22_2026 = Date.UTC(2026, 7, 22, 12, 0, 0);

  it("reads the value as milliseconds", () => {
    const out = formatGenerated(AUG_22_2026);
    expect(out).not.toBeNull();
    // The year is the whole point: seconds-interpretation lands in the year 58610.
    expect(out).toContain("2026");
    expect(out).not.toContain("58610");
  });

  /**
   * `0` is the DTO's stand-in for "never stamped" (`generated_at ?? 0`), and `new Date(0)` is a
   * perfectly real-looking 1 Jan 1970. Null makes the caller drop the line instead of dating a
   * report to the epoch.
   */
  it("returns null for an absent timestamp rather than 1970", () => {
    expect(formatGenerated(0)).toBeNull();
  });

  it("returns null for a value that cannot be a date", () => {
    expect(formatGenerated(Number.NaN)).toBeNull();
    expect(formatGenerated(Number.POSITIVE_INFINITY)).toBeNull();
  });

  /** Guards the regression directly: the old code did exactly this. */
  it("a seconds-scaled value would be visibly wrong", () => {
    const asIfSeconds = formatGenerated(AUG_22_2026 * 1000);
    expect(asIfSeconds).not.toContain("2026");
  });
});

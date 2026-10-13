import { describe, expect, it } from "vitest";

import { requestDays } from "./request-leave-dialog";

/**
 * WP-072: the preview must show what the balance loses — inclusive calendar days, as the server
 * stores and debits them — and must not depend on the viewer's time zone.
 */
describe("requestDays", () => {
  it("counts a weekend-spanning range the way the server debits it", () => {
    expect(requestDays("2026-10-09", "2026-10-12")).toBe(4); // Fri → Mon
  });

  it("counts a single day, weekend or not", () => {
    expect(requestDays("2026-10-10", "2026-10-10")).toBe(1); // a Saturday
    expect(requestDays("2026-10-12", "2026-10-12")).toBe(1);
  });

  it("returns 0 for a backwards or incomplete range", () => {
    expect(requestDays("2026-10-12", "2026-10-09")).toBe(0);
    expect(requestDays("", "2026-10-09")).toBe(0);
    expect(requestDays("2026-10-09", "nope")).toBe(0);
  });

  it("crosses a month boundary", () => {
    expect(requestDays("2026-10-30", "2026-11-02")).toBe(4);
  });
});

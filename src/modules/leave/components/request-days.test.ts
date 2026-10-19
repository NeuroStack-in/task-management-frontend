import { describe, expect, it } from "vitest";

import { requestDays, yearPortions } from "./request-leave-dialog";

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

/** TIME-07: the balance line checks each year's share, the way the server's soft check does. */
describe("yearPortions", () => {
  it("keeps a request inside one year whole, fraction included", () => {
    expect(yearPortions("2026-10-12", "2026-10-15", 4)).toEqual([["2026", 4]]);
    expect(yearPortions("2026-10-12", "2026-10-12", 0.25)).toEqual([["2026", 0.25]]);
  });

  it("splits a year-crossing request by calendar days", () => {
    expect(yearPortions("2026-12-29", "2027-01-02", 5)).toEqual([
      ["2026", 3],
      ["2027", 2],
    ]);
  });

  it("returns nothing for a backwards or malformed range", () => {
    expect(yearPortions("2027-01-02", "2026-12-29", 5)).toEqual([]);
    expect(yearPortions("", "2026-12-29", 1)).toEqual([]);
  });
});

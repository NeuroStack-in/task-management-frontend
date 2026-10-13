import { describe, expect, it } from "vitest";
import { formatDays } from "./days";

describe("formatDays", () => {
  it("keeps whole days whole", () => {
    expect(formatDays(20)).toBe("20");
    expect(formatDays(0)).toBe("0");
  });

  /** WP-479: a 45-minute permission leaves 19.90625 of 20 days. */
  it("rounds permission fractions to two decimals", () => {
    expect(formatDays(19.90625)).toBe("19.91");
    expect(formatDays(0.09375)).toBe("0.09");
    expect(formatDays(2.5)).toBe("2.5");
  });

  it("never prints a negative zero or a non-number", () => {
    expect(formatDays(-0.001)).toBe("0");
    expect(formatDays(Number.NaN)).toBe("—");
  });
});

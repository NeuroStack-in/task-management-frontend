import { describe, expect, it } from "vitest";
import {
  GLOBAL_DEFAULT_WEIGHTS,
  isValidPercentSum,
  percentsSum,
  toFractions,
  toPercents,
  type PercentWeights,
} from "./productivity-weights";

describe("productivity weight conversion", () => {
  it("turns the global-default fractions into whole percentages", () => {
    expect(toPercents(GLOBAL_DEFAULT_WEIGHTS)).toEqual({
      u: 25,
      q: 40,
      f: 15,
      r: 20,
    });
  });

  it("turns percentages back into fractions summing to 1", () => {
    const f = toFractions({ u: 25, q: 40, f: 15, r: 20 });
    expect(f).toEqual({ u: 0.25, q: 0.4, f: 0.15, r: 0.2 });
    expect(f.u + f.q + f.f + f.r).toBeCloseTo(1, 10);
  });

  it("round-trips percent → fraction → percent", () => {
    const start: PercentWeights = { u: 30, q: 30, f: 20, r: 20 };
    expect(toPercents(toFractions(start))).toEqual(start);
  });

  it("keeps displayed percentages summing to exactly 100 for ugly thirds", () => {
    // 1/3 + 1/3 + 1/3 + 0 would naively floor to 33/33/33/0 = 99.
    const p = toPercents({ u: 1 / 3, q: 1 / 3, f: 1 / 3, r: 0 });
    expect(percentsSum(p)).toBe(100);
    expect(p).toEqual({ u: 34, q: 33, f: 33, r: 0 });
  });

  it("handles all-zero weights without inventing a total", () => {
    expect(toPercents({ u: 0, q: 0, f: 0, r: 0 })).toEqual({
      u: 0,
      q: 0,
      f: 0,
      r: 0,
    });
  });
});

describe("sum-to-100 validation", () => {
  it("accepts a set that totals 100", () => {
    expect(isValidPercentSum({ u: 25, q: 40, f: 15, r: 20 })).toBe(true);
    expect(isValidPercentSum({ u: 100, q: 0, f: 0, r: 0 })).toBe(true);
  });

  it("rejects a set that does not total 100", () => {
    expect(isValidPercentSum({ u: 25, q: 25, f: 25, r: 20 })).toBe(false); // 95
    expect(isValidPercentSum({ u: 30, q: 40, f: 15, r: 20 })).toBe(false); // 105
    expect(percentsSum({ u: 30, q: 40, f: 15, r: 20 })).toBe(105);
  });
});

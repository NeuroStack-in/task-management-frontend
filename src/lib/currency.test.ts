import { describe, expect, it } from "vitest";
import { formatCurrency } from "./currency";

describe("formatCurrency", () => {
  it("formats an amount in the given currency", () => {
    expect(formatCurrency(1234.5, "USD")).toMatch(/1,?234\.5/);
  });

  // A field the server withheld arrives as undefined — it must read "—", never "US$NaN" (TIME-01).
  it("prints a dash for a missing or non-finite amount", () => {
    expect(formatCurrency(undefined as unknown as number)).toBe("—");
    expect(formatCurrency(Number.NaN, "INR")).toBe("—");
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

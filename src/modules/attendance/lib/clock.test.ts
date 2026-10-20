import { describe, expect, it } from "vitest";

import { formatTimeOfDay, formatWallClock } from "./clock";

/** What the viewer's own locale says for this time — the helpers must agree with it, whatever it is. */
const local = (h: number, m: number) =>
  new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

describe("formatWallClock", () => {
  it("prints a stored HH:MM in the viewer's clock, not a forced 12- or 24-hour one", () => {
    expect(formatWallClock("14:30")).toBe(local(14, 30));
    expect(formatWallClock("09:05")).toBe(local(9, 5));
    expect(formatWallClock("9:05")).toBe(local(9, 5));
  });

  it("returns anything it can't read as given, and nothing for nothing", () => {
    expect(formatWallClock("25:00")).toBe("25:00");
    expect(formatWallClock("soon")).toBe("soon");
    expect(formatWallClock("")).toBe("");
    expect(formatWallClock(undefined)).toBe("");
  });
});

describe("formatTimeOfDay", () => {
  it("formats epoch ms the same way as a wall clock for the same local time", () => {
    const ms = new Date(2026, 9, 20, 16, 45).getTime();
    expect(formatTimeOfDay(ms)).toBe(local(16, 45));
    expect(formatTimeOfDay(new Date(ms))).toBe(local(16, 45));
  });

  it("is empty for a missing or invalid value", () => {
    expect(formatTimeOfDay(undefined)).toBe("");
    expect(formatTimeOfDay(null)).toBe("");
    expect(formatTimeOfDay(Number.NaN)).toBe("");
  });
});

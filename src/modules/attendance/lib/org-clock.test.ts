import { describe, expect, it } from "vitest";
import { beforeLateThreshold, fixedOffsetMinutes, orgClockAt } from "./org-clock";

// 2026-10-20 03:15 UTC.
const T = Date.UTC(2026, 9, 20, 3, 15);

describe("fixedOffsetMinutes", () => {
  it("reads both pickers' fixed-offset labels, either minus", () => {
    expect(fixedOffsetMinutes("(GMT+05:30) India Standard")).toBe(330);
    expect(fixedOffsetMinutes("(GMT−08:00) Pacific Time")).toBe(-480);
    expect(fixedOffsetMinutes("(GMT-05:00) Eastern Time")).toBe(-300);
    expect(fixedOffsetMinutes("(GMT+00:00) London / GMT")).toBe(0);
  });

  it("is not fooled by an IANA name", () => {
    expect(fixedOffsetMinutes("Asia/Kolkata")).toBeNull();
  });
});

describe("orgClockAt (TIME-11)", () => {
  it("uses a fixed offset", () => {
    expect(orgClockAt("(GMT+05:30) India Standard", T)).toEqual({
      date: "2026-10-20",
      hhmm: "08:45",
      zoned: true,
    });
    // West of UTC it is still the previous evening.
    expect(orgClockAt("(GMT−08:00) Pacific Time", T)).toEqual({
      date: "2026-10-19",
      hhmm: "19:15",
      zoned: true,
    });
  });

  it("uses an IANA zone, daylight saving included", () => {
    expect(orgClockAt("Asia/Kolkata", T)).toEqual({
      date: "2026-10-20",
      hhmm: "08:45",
      zoned: true,
    });
    // New York is on EDT (UTC−4) on 20 October.
    expect(orgClockAt("America/New_York", T)).toEqual({
      date: "2026-10-19",
      hhmm: "23:15",
      zoned: true,
    });
  });

  it("falls back to the viewer's clock, and says so", () => {
    expect(orgClockAt("", T).zoned).toBe(false);
    expect(orgClockAt("Not/AZone", T).zoned).toBe(false);
    expect(orgClockAt(undefined, T).zoned).toBe(false);
  });
});

describe("beforeLateThreshold", () => {
  it("is 'not in yet' until the late threshold, inclusive", () => {
    expect(
      beforeLateThreshold({ date: "2026-10-20", hhmm: "08:45" }, "2026-10-20", "09:30"),
    ).toBe(true);
    expect(
      beforeLateThreshold({ date: "2026-10-20", hhmm: "09:30" }, "2026-10-20", "09:30"),
    ).toBe(true);
    expect(
      beforeLateThreshold({ date: "2026-10-20", hhmm: "09:31" }, "2026-10-20", "09:30"),
    ).toBe(false);
  });

  it("treats a day the org has finished as over and one it hasn't reached as not started", () => {
    expect(
      beforeLateThreshold({ date: "2026-10-21", hhmm: "01:00" }, "2026-10-20", "09:30"),
    ).toBe(false);
    expect(
      beforeLateThreshold({ date: "2026-10-19", hhmm: "23:00" }, "2026-10-20", "09:30"),
    ).toBe(true);
  });
});

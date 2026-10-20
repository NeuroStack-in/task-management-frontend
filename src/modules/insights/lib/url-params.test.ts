import { describe, expect, it } from "vitest";

import { nextSearch, validDateParam, validDeptParam, withCarriedParams } from "./url-params";

describe("validDateParam", () => {
  const today = "2026-10-20";
  it("takes a real past or present day", () => {
    expect(validDateParam("2026-10-14", today)).toBe(true);
    expect(validDateParam(today, today)).toBe(true);
  });
  it("refuses the future, garbage, and days that don't exist", () => {
    expect(validDateParam("2026-10-21", today)).toBe(false);
    expect(validDateParam("14/10/2026", today)).toBe(false);
    expect(validDateParam("2026-02-31", today)).toBe(false);
    expect(validDateParam(null, today)).toBe(false);
    expect(validDateParam("", today)).toBe(false);
  });
});

describe("validDeptParam", () => {
  it("treats the 'all' sentinel and empty as no filter", () => {
    expect(validDeptParam("all")).toBe(false);
    expect(validDeptParam("")).toBe(false);
    expect(validDeptParam(null)).toBe(false);
    expect(validDeptParam("dept-01K")).toBe(true);
  });
});

describe("withCarriedParams (UX audit MON-13)", () => {
  it("carries the day, the department and the employee to another tab", () => {
    const cur = new URLSearchParams("date=2026-10-14&dept=dept-1&emp=u-1&show=review");
    expect(withCarriedParams("/insights/locations", cur)).toBe(
      "/insights/locations?emp=u-1&date=2026-10-14&dept=dept-1",
    );
  });
  it("leaves page-only parameters behind, and a bare URL bare", () => {
    expect(withCarriedParams("/insights/activity", new URLSearchParams("show=review"))).toBe(
      "/insights/activity",
    );
    expect(withCarriedParams("/insights/activity", null)).toBe("/insights/activity");
  });
  it("doesn't overwrite what the target already says", () => {
    const cur = new URLSearchParams("date=2026-10-14");
    expect(withCarriedParams("/insights/screenshots?date=2026-10-01", cur)).toBe(
      "/insights/screenshots?date=2026-10-01",
    );
  });
});

describe("nextSearch", () => {
  it("sets and removes keys, keeping the rest", () => {
    expect(nextSearch("?emp=u-1&date=2026-10-14", { emp: null })).toBe("?date=2026-10-14");
    expect(nextSearch("", { date: "2026-10-14" })).toBe("?date=2026-10-14");
    expect(nextSearch("?date=2026-10-14", { date: null })).toBe("");
  });
});

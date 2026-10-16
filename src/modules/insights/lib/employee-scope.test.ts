import { describe, expect, it } from "vitest";
import { withEmp } from "./employee-scope";

describe("withEmp", () => {
  it("adds the employee scope to a tab link", () => {
    expect(withEmp("/insights/activity", "u-1")).toBe("/insights/activity?emp=u-1");
  });

  it("joins an existing query string", () => {
    expect(withEmp("/insights/screenshots?date=2026-10-16", "u-1")).toBe(
      "/insights/screenshots?date=2026-10-16&emp=u-1",
    );
  });

  it("encodes the id and leaves the link alone without a scope", () => {
    expect(withEmp("/insights", "a b/c")).toBe("/insights?emp=a%20b%2Fc");
    expect(withEmp("/insights/activity", null)).toBe("/insights/activity");
    expect(withEmp("/insights/activity", "")).toBe("/insights/activity");
  });
});

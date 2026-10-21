import { describe, expect, it } from "vitest";
import { requestUnavailableReason } from "./request-availability";

const base = {
  loading: false,
  failed: false,
  requestableTypes: 0,
  typesFailed: false,
  canManageTypes: false,
};

describe("requestUnavailableReason (UX audit TIME-23)", () => {
  it("says nothing when a type can be requested", () => {
    expect(requestUnavailableReason({ ...base, requestableTypes: 2 })).toBeNull();
  });

  it("says nothing while loading or under the page's own error", () => {
    expect(requestUnavailableReason({ ...base, loading: true })).toBeNull();
    expect(requestUnavailableReason({ ...base, failed: true })).toBeNull();
  });

  it("sends an employee to their admin when none are set up", () => {
    expect(requestUnavailableReason(base)).toBe("No leave types are set up yet. Ask your admin.");
  });

  it("does not tell someone who manages leave types to ask an admin", () => {
    const said = requestUnavailableReason({ ...base, canManageTypes: true });
    expect(said).toBe("No leave types are set up yet.");
    expect(said).not.toMatch(/admin/i);
  });

  it("never claims none are set up when the catalog read failed", () => {
    for (const canManageTypes of [false, true]) {
      const said = requestUnavailableReason({ ...base, typesFailed: true, canManageTypes });
      expect(said).toMatch(/couldn't be loaded/);
      expect(said).not.toMatch(/set up yet/);
    }
  });
});

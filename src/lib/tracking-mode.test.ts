import { describe, expect, it } from "vitest";

import {
  isKnownTrackingMode,
  TRACKING_MODE_META,
  TRACKING_MODES,
  trackingModeOf,
} from "./tracking-mode";
import { MODE_HIDDEN_FEATURES, MODE_HIDDEN_ROUTES } from "@/constants/features";

describe("trackingModeOf", () => {
  it("passes through the three known modes", () => {
    for (const m of TRACKING_MODES) expect(trackingModeOf(m)).toBe(m);
  });

  it("degrades absent/unknown to project (never blanks a project org)", () => {
    expect(trackingModeOf(undefined)).toBe("project");
    expect(trackingModeOf(null)).toBe("project");
    expect(trackingModeOf("")).toBe("project");
    expect(trackingModeOf("kiosk")).toBe("project");
  });

  it("isKnownTrackingMode distinguishes real values from noise", () => {
    expect(isKnownTrackingMode("machine")).toBe(true);
    expect(isKnownTrackingMode("kiosk")).toBe(false);
    expect(isKnownTrackingMode(undefined)).toBe(false);
  });

  it("has meta for every mode", () => {
    for (const m of TRACKING_MODES) expect(TRACKING_MODE_META[m].label).toBeTruthy();
  });
});

describe("MODE_HIDDEN", () => {
  it("project and both hide nothing", () => {
    expect(MODE_HIDDEN_ROUTES.project).toHaveLength(0);
    expect(MODE_HIDDEN_ROUTES.both).toHaveLength(0);
    expect(MODE_HIDDEN_FEATURES.project).toHaveLength(0);
  });

  it("machine hides projects/leave/approvals/payroll routes", () => {
    expect(MODE_HIDDEN_ROUTES.machine).toContain("/projects");
    expect(MODE_HIDDEN_ROUTES.machine).toContain("/payroll");
    // …but never /time-tracking (logon time lives there).
    expect(MODE_HIDDEN_ROUTES.machine).not.toContain("/time-tracking");
  });

  it("derives features from routes, dropping the key-less ones (payroll)", () => {
    // projects + leave have keys; /payroll and /approvals(->leave) fold in, payroll contributes none.
    expect(MODE_HIDDEN_FEATURES.machine).toContain("projects");
    expect(MODE_HIDDEN_FEATURES.machine).toContain("leave");
    expect(MODE_HIDDEN_FEATURES.machine).not.toContain("time.tracking");
  });
});

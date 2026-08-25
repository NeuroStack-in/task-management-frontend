import { describe, expect, it } from "vitest";

import { canAccessPath } from "./rbac";
import { permissionsFromBitset } from "./permission-bits";
import type { Role } from "@/types/rbac";

/**
 * **Analytics is oversight-only.** It reads other people's activity, screenshots, locations and AI
 * summaries, so an individual contributor has no business on any of it.
 *
 * This exists because getting it wrong is invisible: the sidebar hid Analytics from an Employee
 * while `/insights/ai-reports` opened perfectly well by URL. Two separate causes, both silent —
 *
 *  1. the tab required `reports:view`, which `wp-contracts` grants to the Employee **baseline**
 *     (`ReportsRead`), so it was never an oversight gate at all; and
 *  2. `permissionForPath` only reads a nav entry's single `permission`, so the hub — which gates on
 *     `anyPermissions` — resolved to `null`, and `canAccess(role, null)` is `true`.
 *
 * The second one also let through `/insights/anomalies` and `/insights/reports`, which have no tab
 * of their own and fall back to the hub. A test that only checked the four tabs would have passed
 * while three routes stayed open, so this walks **every** route under the hub.
 */

/** Bit indexes from `wp-contracts/src/permissions.rs`. */
const B = {
  ActivityReadSelf: 0,
  ActivityReadTeam: 1,
  ActivityReadOrg: 2,
  ScreenshotsRead: 3,
  TimeReadSelf: 30,
  AttendanceReadSelf: 33,
  ProjectsRead: 20,
  LeaveRequest: 40,
  ReportsRead: 60,
  AiInsightsRead: 62,
  AiAssistantUse: 65,
  HelpView: 90,
  NotificationsRead: 100,
  TimeTrackSelf: 110,
} as const;

function roleOf(name: string, bits: number[]): Role {
  const mask = bits.reduce(
    (acc, b) => acc | (BigInt(1) << BigInt(b)),
    BigInt(0),
  );
  return {
    id: name,
    name,
    description: "",
    system: true,
    scope: "self",
    permissions: permissionsFromBitset(mask.toString()) ?? [],
  } as Role;
}

/** The Employee baseline, mirroring `wp_contracts::roles::Role::employee()`. */
const employee = roleOf("role-employee", [
  B.ActivityReadSelf,
  B.TimeReadSelf,
  B.AttendanceReadSelf,
  B.ProjectsRead,
  B.LeaveRequest,
  B.ReportsRead,
  B.AiAssistantUse,
  B.HelpView,
  B.NotificationsRead,
  B.TimeTrackSelf,
]);

/** A manager: team oversight over activity + screenshots + AI insights. */
const manager = roleOf("role-manager", [
  B.ActivityReadSelf,
  B.ActivityReadTeam,
  B.ScreenshotsRead,
  B.AiInsightsRead,
  B.ReportsRead,
]);

/** Owner — the wildcard. */
const owner = { ...employee, id: "role-owner", permissions: ["*"] } as Role;

/** Every route that exists under the hub, not just the ones with a tab entry. */
const ANALYTICS_ROUTES = [
  "/insights",
  "/insights/activity",
  "/insights/screenshots",
  "/insights/locations",
  "/insights/ai-reports",
  "/insights/anomalies",
  "/insights/reports",
];

describe("Analytics is closed to an individual contributor", () => {
  it.each(ANALYTICS_ROUTES)("employee cannot open %s", (path) => {
    expect(canAccessPath(employee, path)).toBe(false);
  });

  /** `ReportsRead` is in the Employee baseline — holding it must not open Analytics. */
  it("holding reports:view is not enough on its own", () => {
    expect(employee.permissions).toContain("reports:view");
    expect(canAccessPath(employee, "/insights")).toBe(false);
    expect(canAccessPath(employee, "/insights/ai-reports")).toBe(false);
  });

  /** The gate must not be a blanket "no" — oversight roles still get in. */
  it("a manager and the owner still reach Analytics", () => {
    for (const r of [manager, owner]) {
      expect(canAccessPath(r, "/insights")).toBe(true);
      expect(canAccessPath(r, "/insights/activity")).toBe(true);
    }
  });

  /** What an Employee legitimately has must be untouched by this change. */
  it.each(["/dashboard", "/time-tracking", "/projects", "/leave", "/help"])(
    "employee keeps %s",
    (path) => {
      expect(canAccessPath(employee, path)).toBe(true);
    },
  );
});

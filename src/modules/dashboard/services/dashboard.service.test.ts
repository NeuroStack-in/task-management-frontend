/**
 * The widget permission mirror.
 *
 * The server checks one exact bit per catalog entry (`AuthContext::can(required_perm)`); the
 * frontend ids are coarser (`activity:view` / `attendance:view` are lit by the Team and Org bits
 * alike). Pre-filtering a layout save on the id let a team-level manager include the `org_*`
 * widgets, and the whole PUT 403'd (QA audit 2026-10-08, WP-194).
 */
import { describe, expect, it } from "vitest";

import type { PermissionId } from "@/types/rbac";
import {
  encodeLayout,
  holdsWidgetPermission,
  widgetDataPermission,
} from "./dashboard.service";
import { DEFAULT_WIDGETS } from "@/stores/dashboard.store";

/** A `perm` claim holding exactly these bits. */
const claim = (...bits: number[]) =>
  bits.reduce((acc, b) => acc | (BigInt(1) << BigInt(b)), BigInt(0)).toString();

/** A coarse-id `can` that says yes to everything listed. */
const canOnly =
  (...ids: PermissionId[]) =>
  (p: PermissionId | null) =>
    p === null || ids.includes(p);

describe("holdsWidgetPermission", () => {
  // A team-level manager: ActivityReadTeam (1) + AttendanceReadTeam (34), no Org bits. The coarse
  // ids say yes to both org widgets.
  const teamLead = { isOwner: false, perm: claim(1, 34) };
  const can = canOnly("activity:view", "attendance:view");

  it("refuses the org widgets to a holder of only the team bits", () => {
    expect(holdsWidgetPermission("org_attendance", teamLead, can)).toBe(false);
    expect(holdsWidgetPermission("org_attendance.live_timers", teamLead, can)).toBe(false);
    expect(holdsWidgetPermission("org_activity.heatmap", teamLead, can)).toBe(false);
  });

  it("allows the team widget the same role holds the bit for", () => {
    expect(holdsWidgetPermission("team_activity", teamLead, can)).toBe(true);
  });

  it("allows everything in the catalog to the owner, whose claim is nearly empty", () => {
    const owner = { isOwner: true, perm: claim() };
    for (const w of DEFAULT_WIDGETS) {
      expect(holdsWidgetPermission(w.type, owner, () => false)).toBe(true);
    }
  });

  it("falls back to the coarse id for a session minted before the claim existed", () => {
    const old = { isOwner: false, perm: undefined };
    expect(holdsWidgetPermission("org_attendance", old, can)).toBe(true);
    expect(holdsWidgetPermission("billing_summary", old, can)).toBe(false);
  });

  it("drops the placements the server would refuse from a save", () => {
    const allow = (w: (typeof DEFAULT_WIDGETS)[number]) => holdsWidgetPermission(w.type, teamLead, can);
    const ids = encodeLayout(DEFAULT_WIDGETS, allow).map((p) => p.widget_id);
    expect(ids).toContain("team_activity");
    expect(ids).not.toContain("org_activity");
    expect(ids).not.toContain("org_attendance");
  });
});

describe("billing_summary", () => {
  /**
   * WP-110: "Billing overview" has its own catalog entry gated on `BillingRead` (bit 52), so a
   * billing-only Admin can place it and its data needs nothing extra.
   */
  it("is gated on billing access alone", () => {
    const billingOnly = { isOwner: false, perm: claim(52) };
    expect(holdsWidgetPermission("billing_summary", billingOnly, () => false)).toBe(true);
    expect(widgetDataPermission("billing_summary")).toBeNull();
    expect(widgetDataPermission("org_attendance")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { PERMISSION_HELP, isSensitive, permissionDiff } from "./permission-help";

/**
 * The ids the server offers in the role editor (`wp-contracts::permissions::CATALOG` minus the
 * unenforced `ownership:manage`, `help:view`, `notifications:manage`), as of 2026-10-20. A new bit
 * should get a line in `permission-help.ts` — this fails until it does.
 */
const OFFERED = [
  "activity:read:self",
  "activity:read:team",
  "activity:read:org",
  "activity:apps:person",
  "screenshots:read",
  "monitoring:manage",
  "activity:export",
  "employees:read",
  "employees:manage",
  "org:manage",
  "org:settings",
  "projects:read",
  "projects:create",
  "projects:manage",
  "time:read:self",
  "time:read:team",
  "time:read:org",
  "attendance:read:self",
  "attendance:read:team",
  "attendance:read:org",
  "attendance:manage",
  "leave:request",
  "leave:approve",
  "leave:manage",
  "payroll:read",
  "payroll:manage",
  "billing:read",
  "billing:manage",
  "reports:read",
  "reports:export",
  "ai_insights:read",
  "anomalies:read",
  "ai_pdf:export",
  "ai_assistant:use",
  "roles:manage",
  "security:read",
  "security:manage",
  "entitlements:manage",
  "agents:manage",
  "support:create",
  "notifications:read",
  "integrations:view",
  "integrations:manage",
  "time:track:self",
];

describe("permission help (UX audit PEOPLE-06)", () => {
  it("describes every permission the editor offers, in one short line", () => {
    for (const id of OFFERED) {
      const help = PERMISSION_HELP[id];
      expect(help, id).toBeDefined();
      expect(help.description.length, id).toBeLessThanOrEqual(100);
    }
    // And nothing that isn't offered.
    expect(Object.keys(PERMISSION_HELP).sort()).toEqual([...OFFERED].sort());
  });

  it("marks the dangerous ones — roles, screenshots, payroll, deleting people", () => {
    for (const id of [
      "roles:manage",
      "screenshots:read",
      "payroll:read",
      "payroll:manage",
      "employees:manage",
      "projects:manage",
      "activity:apps:person",
      "time:track:self",
    ]) {
      expect(isSensitive(id), id).toBe(true);
    }
    for (const id of [
      "attendance:read:self",
      "leave:request",
      "help:view",
      "unknown:id",
    ]) {
      expect(isSensitive(id), id).toBe(false);
    }
  });

  it("diffs a save into what it grants and what it takes away", () => {
    expect(permissionDiff(["a", "b"], ["b", "c"])).toEqual({
      added: ["c"],
      removed: ["a"],
    });
    expect(permissionDiff([], ["x"])).toEqual({ added: ["x"], removed: [] });
  });
});

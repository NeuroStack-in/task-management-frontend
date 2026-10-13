import { describe, expect, it } from "vitest";

import { AUDIT_CATEGORIES, auditActionLabel, resolveAuditTarget } from "./categories";

const people = new Map([["u-priya", "Priya Shah"]]);
const devices = new Map([["agent-7", "LAPTOP-7 · agent"]]);

/** WP-382 / WP-520: rows printed raw codes and ids, and most categories had no label. */
describe("audit wording", () => {
  it("knows every category the server writes", () => {
    expect(AUDIT_CATEGORIES.map((c) => c.key).sort()).toEqual(
      ["attendance", "billing", "leave", "org", "payroll", "security", "settings"],
    );
  });

  it("puts action codes into words, and keeps an unknown code as it is", () => {
    expect(auditActionLabel("mfa.reset", "u-priya")).toBe("Reset a member's authenticator");
    expect(auditActionLabel("something.new", null)).toBe("something.new");
  });

  it("tells a page toggle from a feature toggle by its key", () => {
    expect(auditActionLabel("feature_disabled", "/payroll")).toBe("Hid a page");
    expect(auditActionLabel("feature_disabled", "monitoring.activity")).toBe("Turned a feature off");
  });

  it("resolves people, devices, compound and config targets", () => {
    expect(resolveAuditTarget("u-priya", people, devices)).toBe("Priya Shah");
    expect(resolveAuditTarget("agent-7", people, devices)).toBe("LAPTOP-7 · agent");
    expect(resolveAuditTarget("u-priya/2026-10-01 -> excused", people, devices)).toBe(
      "Priya Shah · 2026-10-01 -> excused",
    );
    expect(resolveAuditTarget("CONFIG#TRACK", people, devices)).toBe("Monitoring settings");
    expect(resolveAuditTarget("job-123", people, devices)).toBe("job-123");
    expect(resolveAuditTarget(null, people, devices)).toBeNull();
  });
});

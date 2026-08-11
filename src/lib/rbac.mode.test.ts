import { describe, expect, it } from "vitest";
import { FolderKanban } from "lucide-react";

import { isNavItemVisible } from "./rbac";
import { isPathModeHidden } from "@/constants/features";
import type { NavItem } from "@/constants/navigation";
import type { Role } from "@/types/rbac";

/** A wildcard role: sees everything RBAC would allow, so tests isolate the mode gate. */
const OWNER: Role = {
  id: "role-owner",
  name: "Owner",
  description: "",
  scope: "org",
  system: true,
  permissions: ["*"],
};

const projectsItem: NavItem = {
  label: "Projects",
  href: "/projects",
  icon: FolderKanban,
  permission: "projects:view",
};
const payrollItem: NavItem = {
  label: "Payroll",
  href: "/payroll",
  icon: FolderKanban,
  permission: "payroll:view",
};
const dashItem: NavItem = {
  label: "Dashboard",
  href: "/dashboard",
  icon: FolderKanban,
  permission: null,
};

const hidden = (mode: "project" | "machine" | "both") => (href: string) =>
  isPathModeHidden(href, mode);

describe("mode route gating", () => {
  it("machine mode hides Projects and Payroll from the nav, keeps Dashboard", () => {
    const h = hidden("machine");
    expect(isNavItemVisible(OWNER, projectsItem, undefined, h)).toBe(false);
    // Payroll has no feature key, so it can ONLY be hidden by the href-based mode gate.
    expect(isNavItemVisible(OWNER, payrollItem, undefined, h)).toBe(false);
    expect(isNavItemVisible(OWNER, dashItem, undefined, h)).toBe(true);
  });

  it("project mode hides nothing", () => {
    const h = hidden("project");
    expect(isNavItemVisible(OWNER, projectsItem, undefined, h)).toBe(true);
    expect(isNavItemVisible(OWNER, payrollItem, undefined, h)).toBe(true);
  });

  it("isPathModeHidden matches nested paths", () => {
    expect(isPathModeHidden("/projects/abc-123", "machine")).toBe(true);
    expect(isPathModeHidden("/time-tracking", "machine")).toBe(false);
  });
});

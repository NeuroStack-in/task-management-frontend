import type { Role } from "@/types/rbac";
import { WILDCARD } from "./permissions";

/**
 * Built-in system roles (PRD §5). The Organization Owner holds the wildcard.
 * Other roles hold explicit permission id lists. Custom roles are created at
 * runtime and stored alongside these.
 */
export const SYSTEM_ROLES: Role[] = [
  {
    id: "role-owner",
    name: "Organization Owner",
    description: "Full, unrestricted access to the entire platform.",
    system: true,
    scope: "org",
    permissions: [WILDCARD],
  },
  {
    id: "role-admin",
    name: "Admin",
    description: "Organization administration across most modules.",
    system: true,
    scope: "org",
    permissions: [
      "dashboard:view",
      "dashboard:edit",
      "time-tracking:view",
      "time-tracking:manage",
      "tasks:view",
      "tasks:create",
      "tasks:edit",
      "tasks:delete",
      "tasks:assign",
      "projects:view",
      "projects:create",
      "projects:manage",
      "employees:view",
      "employees:manage",
      "attendance:view",
      "attendance:manage",
      // No payroll ids: `wp-contracts::roles::admin()` grants neither PayrollRead nor PayrollManage
      // ("payroll stays a deliberately narrow grant"). Listing them here rendered a Payroll menu
      // that 403s on click. An org that wants an admin on payroll grants it a custom role.
      "activity:view",
      "screenshots:view",
      "locations:view",
      "reports:view",
      "reports:export",
      // Mirrors `wp-contracts::roles::admin()` granting AppUsageReadPerson (bit 6).
      "activity:apps:person",
      "approvals:view",
      "approvals:approve",
      "leave:approve",
      "leave:manage",
      "ai:view",
      "ai:use",
      "anomalies:view",
      "notifications:view",
      "integrations:view",
      "integrations:manage",
      "billing:view",
      "agents:view",
      "agents:manage",
      "roles:view",
      "roles:manage",
      "security:view",
      "security:manage",
      "audit-logs:view",
      "settings:view",
      "settings:manage",
      "entitlements:manage",
      "help:view",
      "leave:view",
      "leave:request",
    ],
  },
  {
    id: "role-employee",
    name: "Employee",
    description: "Personal workspace: time tracking, tasks, and reports.",
    system: true,
    scope: "self",
    permissions: [
      "dashboard:view",
      "time-tracking:view",
      "time-tracking:self",
      "tasks:view",
      // No `tasks:create` / `tasks:edit`: those ride bits 21/22 (ProjectsCreate/ProjectsManage),
      // and `wp-contracts::roles::employee()` holds only ProjectsRead. Task authority inside a
      // project comes from the per-project role (LLD §5), not from org RBAC.
      "projects:view",
      "attendance:view",
      // ReportsRead **is** granted server-side; omitting it hid the Reports page from every
      // Employee who was entitled to open it.
      "reports:view",
      "notifications:view",
      "help:view",
      // **No `ai:use`** (2026-08-26): the assistant is an oversight surface and Employees do
      // not get the chatbot. Mirrors `wp-contracts::roles::employee`, which no longer grants
      // bit 65 — see the rationale there, including why the Help Center (not the assistant) is
      // where an employee's product questions belong.
      "leave:view",
      "leave:request",
    ],
  },
];

export const DEFAULT_ROLE_ID = "role-owner";

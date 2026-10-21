import type {
  Permission,
  PermissionAction,
  PermissionCategory,
  PermissionId,
} from "@/types/rbac";

/** Wildcard permission id granting full access. */
export const WILDCARD = "*" as const;

/**
 * Contributor-only capabilities. These belong to individual contributors who do
 * their own work in the tool (e.g. logging their own time, requesting their own
 * leave) — NOT to oversight roles (Owner/Admin/HR/Manager). The wildcard "*"
 * does NOT auto-grant these; a role must list them explicitly. See rbac.ts
 * `canAccess`. (Oversight roles still approve leave via `leave:approve`.)
 */
export const CONTRIBUTOR_ONLY_PERMISSIONS: PermissionId[] = [
  "time-tracking:self",
  "leave:view",
  "leave:request",
];

const p = (
  module: string,
  action: PermissionAction,
  label: string,
): Permission => ({
  id: `${module}:${action}`,
  module,
  action,
  label,
});

/**
 * Full permission catalog, grouped by module.
 * Every gated nav section has at least a `view` permission (used by the sidebar
 * generator and route guards). Action permissions exist for modules that need
 * finer control (see PRD §6).
 */
export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    module: "dashboard",
    label: "Dashboard",
    // No `dashboard:edit`: no server bit produces it and no gate reads it (QA audit 2026-10-08,
    // WP-511). Every member arranges their own dashboard.
    permissions: [p("dashboard", "view", "View dashboard")],
  },
  {
    module: "time-tracking",
    label: "Time tracking",
    permissions: [
      p("time-tracking", "view", "View time tracking"),
      // Mirrors `Permission::TimeTrackSelf` (bit 110) in wp-contracts. It decides whether
      // the agent shows this user a timer at all — it is NOT a write-permission on time
      // entries. Time is agent-derived and immutable (LLD §4: no manual entries, no
      // corrections), so nobody may edit an entry and no such permission exists.
      p("time-tracking", "self", "Track own time (run a timer)"),
      p("time-tracking", "manage", "Manage time tracking (team oversight)"),
    ],
  },
  {
    module: "tasks",
    label: "Tasks",
    permissions: [
      p("tasks", "view", "View tasks"),
      p("tasks", "create", "Create task"),
      p("tasks", "edit", "Edit task"),
      p("tasks", "delete", "Delete task"),
      p("tasks", "assign", "Assign task"),
    ],
  },
  {
    module: "projects",
    label: "Projects",
    permissions: [
      p("projects", "view", "View projects"),
      p("projects", "create", "Create project"),
      p("projects", "manage", "Manage project"),
    ],
  },
  {
    module: "employees",
    label: "Employees",
    permissions: [
      p("employees", "view", "View employees"),
      p("employees", "manage", "Manage employees"),
      // `OrgManage` (bit 12) — department and team CRUD, apart from `settings:manage` (bit 13).
      p("departments", "manage", "Manage departments & teams"),
    ],
  },
  {
    module: "attendance",
    label: "Attendance",
    permissions: [
      p("attendance", "view", "View attendance"),
      // Team/org oversight read (bits 34/35) — the roster view, like `time-tracking:manage`.
      p("attendance", "manage", "Oversee team attendance"),
      // `AttendanceManage` (bit 36) — recompute and day overrides, the write path.
      p("attendance", "edit", "Edit attendance (recompute & day overrides)"),
    ],
  },
  {
    module: "payroll",
    label: "Payroll",
    permissions: [
      p("payroll", "view", "View payroll"),
      p("payroll", "manage", "Run payroll"),
      p("payroll", "export", "Download payslips"),
    ],
  },
  {
    module: "activity",
    label: "Activity monitoring",
    permissions: [
      p("activity", "view", "View activity"),
      p("screenshots", "view", "View screenshots"),
      p("locations", "view", "View employee locations"),
      // Both are read by live gates (Monitoring settings, office perimeter, Capture now; the
      // per-person app panel) but were missing here (QA audit 2026-10-08, WP-511).
      p("monitoring", "manage", "Manage monitoring settings"),
      {
        id: "activity:apps:person",
        module: "activity",
        action: "view",
        label: "See which apps a person used",
      },
    ],
  },
  {
    module: "reports",
    label: "Reports",
    permissions: [
      p("reports", "view", "View reports"),
      p("reports", "export", "Download reports"),
    ],
  },
  {
    module: "approvals",
    label: "Approvals",
    permissions: [
      p("approvals", "view", "View approvals"),
      p("approvals", "approve", "Approve requests"),
    ],
  },
  {
    module: "leave",
    label: "Leave",
    permissions: [
      p("leave", "view", "View leave requests"),
      p("leave", "request", "Submit leave request"),
      p("leave", "approve", "Approve leave requests"),
      // Mirrors `Permission::LeaveManage` (bit 42) in wp-contracts: leave-type config + allowances.
      p("leave", "manage", "Manage leave types & allowances"),
    ],
  },
  {
    module: "ai",
    label: "AI",
    permissions: [
      // Two bits on the server (62 and 65), so two ids here. Kept apart because "read the AI
      // summaries" and "use the chat assistant" are genuinely different grants: Employees now hold
      // the second without the first.
      p("ai", "view", "View AI insights & summaries"),
      p("ai", "use", "Use the AI assistant"),
    ],
  },
  {
    module: "anomalies",
    label: "Alerts",
    permissions: [p("anomalies", "view", "View alerts")],
  },
  {
    module: "notifications",
    label: "Notifications",
    permissions: [p("notifications", "view", "View notifications")],
  },
  {
    module: "integrations",
    label: "Integrations",
    permissions: [
      p("integrations", "view", "View integrations"),
      p("integrations", "manage", "Manage integrations"),
    ],
  },
  {
    module: "billing",
    label: "Billing",
    permissions: [
      p("billing", "view", "View billing"),
      p("billing", "manage", "Manage subscription"),
    ],
  },
  {
    module: "agents",
    label: "Device agents",
    permissions: [
      p("agents", "view", "View device agents"),
      p("agents", "manage", "Manage device agents"),
    ],
  },
  {
    module: "roles",
    label: "Roles & permissions",
    permissions: [
      p("roles", "view", "View roles"),
      p("roles", "manage", "Manage roles"),
    ],
  },
  {
    module: "security",
    label: "Security",
    permissions: [
      p("security", "view", "View security"),
      p("security", "manage", "Manage security"),
    ],
  },
  {
    module: "audit-logs",
    label: "Audit logs",
    permissions: [p("audit-logs", "view", "View audit logs")],
  },
  {
    module: "settings",
    label: "Settings",
    permissions: [
      p("settings", "view", "View settings"),
      p("settings", "manage", "Manage organization settings"),
      // `entitlements:manage` is its own bit (wp-contracts 73), not part of settings:manage —
      // filed under Settings because that is where the backend files it and where the tab lives.
      {
        id: "entitlements:manage",
        module: "settings",
        action: "manage",
        label: "Manage feature toggles",
      },
    ],
  },
  {
    module: "help",
    label: "Help center",
    permissions: [p("help", "view", "View help center")],
  },
];

/** Flat list of every permission. */
export const ALL_PERMISSIONS: Permission[] = PERMISSION_CATEGORIES.flatMap(
  (c) => c.permissions,
);

/** Lookup map id -> Permission. */
export const PERMISSION_MAP: Record<string, Permission> = Object.fromEntries(
  ALL_PERMISSIONS.map((perm) => [perm.id, perm]),
);

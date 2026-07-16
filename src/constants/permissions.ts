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
    permissions: [
      p("dashboard", "view", "View Dashboard"),
      p("dashboard", "edit", "Customize Dashboard"),
    ],
  },
  {
    module: "time-tracking",
    label: "Time Tracking",
    permissions: [
      p("time-tracking", "view", "View Time Tracking"),
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
      p("tasks", "view", "View Tasks"),
      p("tasks", "create", "Create Task"),
      p("tasks", "edit", "Edit Task"),
      p("tasks", "delete", "Delete Task"),
      p("tasks", "assign", "Assign Task"),
    ],
  },
  {
    module: "projects",
    label: "Projects",
    permissions: [
      p("projects", "view", "View Projects"),
      p("projects", "create", "Create Project"),
      p("projects", "manage", "Manage Project"),
    ],
  },
  {
    module: "employees",
    label: "Employees",
    permissions: [
      p("employees", "view", "View Employees"),
      p("employees", "manage", "Manage Employees"),
    ],
  },
  {
    module: "attendance",
    label: "Attendance",
    permissions: [
      p("attendance", "view", "View Attendance"),
      p("attendance", "manage", "Manage Attendance"),
    ],
  },
  {
    module: "payroll",
    label: "Payroll",
    permissions: [
      p("payroll", "view", "View Payroll"),
      p("payroll", "manage", "Run Payroll"),
      p("payroll", "export", "Download Payslips"),
    ],
  },
  {
    module: "activity",
    label: "Activity Monitoring",
    permissions: [
      p("activity", "view", "View Activity"),
      p("screenshots", "view", "View Screenshots"),
      p("locations", "view", "View Employee Locations"),
    ],
  },
  {
    module: "reports",
    label: "Reports",
    permissions: [
      p("reports", "view", "View Reports"),
      p("reports", "export", "Download Reports"),
    ],
  },
  {
    module: "approvals",
    label: "Approvals",
    permissions: [
      p("approvals", "view", "View Approvals"),
      p("approvals", "approve", "Approve Requests"),
    ],
  },
  {
    module: "leave",
    label: "Leave",
    permissions: [
      p("leave", "view", "View Leave Requests"),
      p("leave", "request", "Submit Leave Request"),
      p("leave", "approve", "Approve Leave Requests"),
    ],
  },
  {
    module: "ai",
    label: "Assistant",
    permissions: [p("ai", "view", "Use the assistant")],
  },
  {
    module: "anomalies",
    label: "Alerts",
    permissions: [p("anomalies", "view", "View alerts")],
  },
  {
    module: "communication",
    label: "Communication",
    permissions: [p("communication", "view", "View Inbox")],
  },
  {
    module: "notifications",
    label: "Notifications",
    permissions: [p("notifications", "view", "View Notifications")],
  },
  {
    module: "integrations",
    label: "Integrations",
    permissions: [
      p("integrations", "view", "View Integrations"),
      p("integrations", "manage", "Manage Integrations"),
    ],
  },
  {
    module: "billing",
    label: "Billing",
    permissions: [
      p("billing", "view", "View Billing"),
      p("billing", "manage", "Manage Subscription"),
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
    label: "Roles & Permissions",
    permissions: [
      p("roles", "view", "View Roles"),
      p("roles", "manage", "Manage Roles"),
    ],
  },
  {
    module: "security",
    label: "Security",
    permissions: [
      p("security", "view", "View Security"),
      p("security", "manage", "Manage Security"),
    ],
  },
  {
    module: "audit-logs",
    label: "Audit Logs",
    permissions: [p("audit-logs", "view", "View Audit Logs")],
  },
  {
    module: "settings",
    label: "Settings",
    permissions: [
      p("settings", "view", "View Settings"),
      p("settings", "manage", "Manage Organization Settings"),
    ],
  },
  {
    module: "help",
    label: "Help Center",
    permissions: [p("help", "view", "View Help Center")],
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

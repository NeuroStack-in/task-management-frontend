import type {
  Permission,
  PermissionAction,
  PermissionCategory,
} from "@/types/rbac";

/** Wildcard permission id granting full access. */
export const WILDCARD = "*" as const;

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
      p("time-tracking", "edit", "Edit Time Entries"),
      p("time-tracking", "approve", "Approve Timesheets"),
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
      p("payroll", "export", "Export Payslips"),
    ],
  },
  {
    module: "activity",
    label: "Activity Monitoring",
    permissions: [
      p("activity", "view", "View Activity"),
      p("screenshots", "view", "View Screenshots"),
    ],
  },
  {
    module: "reports",
    label: "Reports",
    permissions: [
      p("reports", "view", "View Reports"),
      p("reports", "export", "Export Reports"),
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
    module: "ai",
    label: "AI Insights",
    permissions: [p("ai", "view", "Use AI Assistant")],
  },
  {
    module: "anomalies",
    label: "Anomaly Detection",
    permissions: [p("anomalies", "view", "View Anomalies")],
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
    module: "remote-support",
    label: "Remote Support",
    permissions: [
      p("remote-support", "view", "View Remote Support"),
      p("remote-support", "approve", "Approve Sessions"),
    ],
  },
  {
    module: "agents",
    label: "Desktop Agents",
    permissions: [
      p("agents", "view", "View Agents"),
      p("agents", "manage", "Manage Agents"),
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

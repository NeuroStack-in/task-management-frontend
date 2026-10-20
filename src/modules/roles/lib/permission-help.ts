/**
 * Plain-English help for the role editor: a one-line description of every permission the server
 * offers, and which ones are sensitive (UX audit PEOPLE-06).
 *
 * The editor showed a short label and the raw wire id (`employees:manage`) and nothing else, so an HR
 * admin had to guess what "Manage employees" let someone do — that it includes permanently deleting
 * people, say — and nothing set "View screenshots" or "Manage roles & permissions" apart from "View
 * own attendance".
 *
 * ## Keyed by the server's wire ids, not `constants/permissions.ts`
 *
 * The editor renders `GET /v1/permissions` — `Permission::CATALOG` in `wp-contracts`, ids like
 * `activity:read:org`. `constants/permissions.ts` is the frontend's coarser page-gate vocabulary
 * (`activity:view`), so it is not where these belong. Every line below was checked against the
 * handler that enforces the bit (2026-10-20); a few bits gate no server route at all and only show
 * or hide a page or a button here, and their lines say exactly that rather than promising a
 * restriction that doesn't exist. An id missing from this map simply renders without help.
 *
 * Keep this in step with `wp-contracts/src/permissions.rs` when a bit is added or its handler moves.
 */

export type SensitivityKind =
  | "personal"
  | "money"
  | "access"
  | "deletes"
  | "org-wide"
  | "monitored";

export interface Sensitivity {
  kind: SensitivityKind;
  /** Why, in a few words — shown on the tag and in the save confirmation. */
  reason: string;
}

export interface PermissionHelp {
  description: string;
  sensitive?: Sensitivity;
}

export const SENSITIVITY_LABEL: Record<SensitivityKind, string> = {
  personal: "Personal data",
  money: "Money",
  access: "Access control",
  deletes: "Deletes data",
  "org-wide": "Org-wide",
  monitored: "Monitors them",
};

export const PERMISSION_HELP: Record<string, PermissionHelp> = {
  // ── Activity & Monitoring ──
  "activity:read:self": {
    description: "See their own productivity scores, hours, and app and website usage.",
  },
  "activity:read:team": {
    description:
      "See where people in their department are: the location map and daily trails.",
    sensitive: { kind: "personal", reason: "Sees people's locations" },
  },
  "activity:read:org": {
    description:
      "See any employee's productivity scores and hours, and org-wide app and website usage.",
    sensitive: { kind: "personal", reason: "Sees anyone's activity" },
  },
  "activity:apps:person": {
    description:
      "See exactly which apps and websites a named employee used, and for how long.",
    sensitive: { kind: "personal", reason: "Sees one person's app history" },
  },
  "screenshots:read": {
    description:
      "View every employee's screenshots and their AI analysis, and confirm or dismiss AI flags.",
    sensitive: { kind: "personal", reason: "Sees everyone's screenshots" },
  },
  "monitoring:manage": {
    description:
      "Set the screenshot schedule, blur, retention and app rules. Shorter retention deletes screenshots.",
    sensitive: { kind: "deletes", reason: "Cutting retention deletes screenshots" },
  },
  "activity:export": {
    description:
      "Show export buttons on activity pages. Exports hold only data this role can already see.",
  },

  // ── Employees ──
  "employees:read": {
    description:
      "View the employee directory, profiles, pending invites, departments and teams.",
  },
  "employees:manage": {
    description:
      "Invite, add, edit, deactivate and permanently delete employees, and pick an invitee's role.",
    sensitive: { kind: "deletes", reason: "Can permanently delete employees" },
  },
  "org:manage": {
    description:
      "Create, rename and delete departments and teams, and change who is in each team.",
  },

  // ── Projects ──
  "projects:read": {
    description:
      "View every project and its tasks, read-only. Needs an organization-wide data scope.",
  },
  "projects:create": {
    description:
      "Create projects and pick their manager and members from the staff list.",
  },
  "projects:manage": {
    description:
      "Act as manager on every project: edit it, change its members, and delete it or its tasks.",
    sensitive: { kind: "deletes", reason: "Can delete any project" },
  },

  // ── Time Tracking ──
  "time:read:self": {
    description: "Show the Time Tracking page for their own timesheet.",
  },
  "time:read:team": {
    description: "View the timesheets of people in their own department.",
  },
  "time:read:org": {
    description: "View any employee's timesheet. Needs an organization-wide data scope.",
  },
  "time:track:self": {
    description:
      "Record this person's time, activity and screenshots, and let them request time corrections.",
    sensitive: { kind: "monitored", reason: "Everyone with this role is monitored" },
  },

  // ── Attendance ──
  "attendance:read:self": {
    description: "View their own attendance calendar.",
  },
  "attendance:read:team": {
    description: "View daily attendance and history for people in their own department.",
  },
  "attendance:read:org": {
    description: "View attendance for everyone. Needs an organization-wide data scope.",
  },
  "attendance:manage": {
    description:
      "Excuse days, re-run attendance, and approve or reject anyone's time corrections.",
    sensitive: { kind: "money", reason: "Changes hours that feed payroll" },
  },

  // ── Leave ──
  "leave:request": {
    description: "Request leave, with attachments, and cancel their own requests.",
  },
  "leave:approve": {
    description:
      "Approve or reject anyone's leave, open their attachments, and get request alerts.",
    sensitive: { kind: "personal", reason: "Attachments can be medical notes" },
  },
  "leave:manage": {
    description:
      "Set leave types and allowances, see and adjust everyone's balances, and file leave for staff.",
  },

  // ── Payroll & Billing ──
  "payroll:read": {
    description:
      "See everyone's pay: payroll runs, rates, salaries, deductions and payslip totals.",
    sensitive: { kind: "money", reason: "Sees everyone's pay" },
  },
  "payroll:manage": {
    description: "Set pay rates and deductions, and generate and finalize payroll runs.",
    sensitive: { kind: "money", reason: "Sets pay rates and finalizes payroll" },
  },
  "billing:read": {
    description: "View the organization's subscription plan and billing overview.",
  },
  "billing:manage": {
    description: "Change the organization's subscription plan.",
    sensitive: { kind: "money", reason: "Changes the plan you pay for" },
  },

  // ── Reports, Insights, Assistant ──
  "reports:read": {
    description:
      "Show the Reports section. What a report contains follows this role's other permissions.",
  },
  "reports:export": {
    description:
      "Show export buttons on reports. Exports hold only data this role can already see.",
  },
  "ai_pdf:export": {
    description:
      "Generate AI-written organization reports as PDFs. They name top and bottom performers.",
  },
  "ai_insights:read": {
    description:
      "Read AI recaps of their own work — and, with team or org access, AI summaries of staff.",
  },
  "anomalies:read": {
    description:
      "See the “needs attention” list of flagged staff. Also needs AI insights and team activity.",
  },
  "ai_assistant:use": {
    description:
      "Chat with the AI assistant. It answers only with data this role can already see.",
  },

  // ── Administration ──
  "roles:manage": {
    description:
      "Create and edit roles and change people's roles, up to their own level of access.",
    sensitive: { kind: "access", reason: "Changes what other people can do" },
  },
  "security:read": {
    description:
      "Show the Security Center page. Its events, audit log and MFA resets need “Manage security”.",
  },
  "security:manage": {
    description:
      "View the audit log and security events, and reset employees' MFA devices.",
    sensitive: { kind: "access", reason: "Can reset anyone's MFA" },
  },
  "org:settings": {
    description:
      "Edit the company profile, branding, offices, holidays, policies, work hours and score weights.",
    sensitive: { kind: "org-wide", reason: "Changes work hours and scores for everyone" },
  },
  "entitlements:manage": {
    description:
      "Turn features such as screenshots, activity and AI — and whole pages — on or off for everyone.",
    sensitive: { kind: "org-wide", reason: "Switches features for everyone" },
  },

  // ── Device agents, Help, Notifications, Integrations ──
  "agents:manage": {
    description:
      "Manage device agents: see devices, enroll, release or revoke laptops, and see the uninstall code.",
  },
  "support:create": {
    description: "Open, reply to and close their own tickets with WorkPulse support.",
  },
  "notifications:read": {
    description: "Show the Notifications page in the sidebar.",
  },
  "integrations:view": {
    description:
      "See which third-party apps, such as Slack, the organization has connected.",
  },
  "integrations:manage": {
    description:
      "Connect, configure and disconnect organization-wide integrations such as Slack.",
    sensitive: { kind: "org-wide", reason: "Links your Slack workspace" },
  },
};

export function helpFor(id: string): PermissionHelp | undefined {
  return PERMISSION_HELP[id];
}

export function isSensitive(id: string): boolean {
  return Boolean(PERMISSION_HELP[id]?.sensitive);
}

/**
 * What a save changes, against the role as it was: the ids granted and taken away. Both sides are
 * the closed sets (`implies` included), so a prerequisite the server adds counts as a grant.
 */
export function permissionDiff(
  before: Iterable<string>,
  after: Iterable<string>,
): { added: string[]; removed: string[] } {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: [...a].filter((id) => !b.has(id)),
    removed: [...b].filter((id) => !a.has(id)),
  };
}

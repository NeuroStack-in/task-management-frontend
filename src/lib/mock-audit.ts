/**
 * Static dummy data for the Audit Logs page.
 * Deterministic — no Math.random() / Date.now(). Phase 1 is frontend-only.
 */

import type { LucideIcon } from "lucide-react"
import {
  Activity,
  CheckCheck,
  CreditCard,
  FileBarChart,
  FolderKanban,
  KeyRound,
  LogIn,
  SlidersHorizontal,
  Timer,
  Users,
} from "lucide-react"

export type AuditCategory =
  | "auth"
  | "roles"
  | "settings"
  | "monitoring"
  | "projects"
  | "time"
  | "employees"
  | "billing"
  | "reports"
  | "approvals"

export interface AuditCategoryDef {
  key: AuditCategory
  label: string
  icon: LucideIcon
}

export const AUDIT_CATEGORIES: AuditCategoryDef[] = [
  { key: "auth", label: "Authentication", icon: LogIn },
  { key: "roles", label: "Roles & Permissions", icon: KeyRound },
  { key: "settings", label: "Settings", icon: SlidersHorizontal },
  { key: "monitoring", label: "Monitoring", icon: Activity },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "time", label: "Time Tracking", icon: Timer },
  { key: "employees", label: "Employees", icon: Users },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "reports", label: "Reports", icon: FileBarChart },
  { key: "approvals", label: "Approvals", icon: CheckCheck },
]

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> =
  Object.fromEntries(AUDIT_CATEGORIES.map((c) => [c.key, c.label])) as Record<
    AuditCategory,
    string
  >

export type AuditStatus = "success" | "warning" | "failed"

export interface AuditEvent {
  id: string
  timestamp: string // "2026-06-25 14:32"
  actorName: string
  actorEmail: string
  action: string
  category: AuditCategory
  target: string
  ip: string
  device: string
  status: AuditStatus
}

export const AUDIT_EVENTS: AuditEvent[] = [
  { id: "log-1001", timestamp: "2026-06-25 14:32", actorName: "Alex Morgan", actorEmail: "owner@acme.test", action: "Signed in with SSO", category: "auth", target: "WorkPulse web", ip: "203.0.113.24", device: "Chrome on macOS", status: "success" },
  { id: "log-1002", timestamp: "2026-06-25 13:10", actorName: "Priya Nair", actorEmail: "priya.nair@acme.test", action: "Created project", category: "projects", target: "Apollo Redesign", ip: "198.51.100.31", device: "Edge on Windows", status: "success" },
  { id: "log-1003", timestamp: "2026-06-25 11:48", actorName: "Daniel Kim", actorEmail: "daniel.kim@acme.test", action: "Edited time entry", category: "time", target: "Tue · 4.5h → 5.0h", ip: "203.0.113.51", device: "Safari on macOS", status: "success" },
  { id: "log-1004", timestamp: "2026-06-25 10:22", actorName: "Alex Morgan", actorEmail: "owner@acme.test", action: "Updated role permissions", category: "roles", target: "Manager role", ip: "203.0.113.24", device: "Chrome on macOS", status: "success" },
  { id: "log-1005", timestamp: "2026-06-25 09:15", actorName: "Sara Lopez", actorEmail: "sara.lopez@acme.test", action: "Approved timesheet", category: "approvals", target: "Tom Becker · week 25", ip: "192.0.2.140", device: "Chrome on Windows", status: "success" },
  { id: "log-1006", timestamp: "2026-06-24 17:54", actorName: "Maya Patel", actorEmail: "maya.patel@acme.test", action: "Exported report (CSV)", category: "reports", target: "Productivity · June", ip: "198.51.100.5", device: "Firefox on Linux", status: "success" },
  { id: "log-1007", timestamp: "2026-06-24 16:30", actorName: "Alex Morgan", actorEmail: "owner@acme.test", action: "Changed monitoring settings", category: "settings", target: "Screenshot interval 5 → 10 min", ip: "203.0.113.24", device: "Chrome on macOS", status: "success" },
  { id: "log-1008", timestamp: "2026-06-24 15:02", actorName: "Tom Becker", actorEmail: "tom.becker@acme.test", action: "Failed sign-in — wrong password", category: "auth", target: "WorkPulse web", ip: "198.51.100.77", device: "Chrome on Windows", status: "failed" },
  { id: "log-1009", timestamp: "2026-06-24 12:40", actorName: "Priya Nair", actorEmail: "priya.nair@acme.test", action: "Invited employee", category: "employees", target: "rosa.diaz@acme.test", ip: "198.51.100.31", device: "Edge on Windows", status: "success" },
  { id: "log-1010", timestamp: "2026-06-24 11:09", actorName: "Daniel Kim", actorEmail: "daniel.kim@acme.test", action: "Archived project", category: "projects", target: "Legacy Migration", ip: "203.0.113.51", device: "Safari on macOS", status: "success" },
  { id: "log-1011", timestamp: "2026-06-23 18:21", actorName: "Alex Morgan", actorEmail: "owner@acme.test", action: "Updated payment method", category: "billing", target: "Visa ···· 4242", ip: "203.0.113.24", device: "Chrome on macOS", status: "success" },
  { id: "log-1012", timestamp: "2026-06-23 16:30", actorName: "Alex Morgan", actorEmail: "owner@acme.test", action: "Enabled MFA requirement org-wide", category: "settings", target: "Organization", ip: "203.0.113.24", device: "Chrome on macOS", status: "success" },
  { id: "log-1013", timestamp: "2026-06-23 14:11", actorName: "Sara Lopez", actorEmail: "sara.lopez@acme.test", action: "Deactivated employee", category: "employees", target: "j.wright@acme.test", ip: "192.0.2.140", device: "Chrome on Windows", status: "warning" },
  { id: "log-1014", timestamp: "2026-06-23 10:05", actorName: "Maya Patel", actorEmail: "maya.patel@acme.test", action: "Submitted timesheet", category: "time", target: "Week 25", ip: "198.51.100.5", device: "Safari on iPhone", status: "success" },
  { id: "log-1015", timestamp: "2026-06-22 17:39", actorName: "Daniel Kim", actorEmail: "daniel.kim@acme.test", action: "Rejected time-off request", category: "approvals", target: "Tom Becker · Jul 3–5", ip: "203.0.113.51", device: "Safari on macOS", status: "warning" },
  { id: "log-1016", timestamp: "2026-06-22 15:18", actorName: "Alex Morgan", actorEmail: "owner@acme.test", action: "Created custom role", category: "roles", target: "Auditor", ip: "203.0.113.24", device: "Chrome on macOS", status: "success" },
  { id: "log-1017", timestamp: "2026-06-22 13:47", actorName: "Priya Nair", actorEmail: "priya.nair@acme.test", action: "Scheduled report", category: "reports", target: "Weekly team summary", ip: "198.51.100.31", device: "Edge on Windows", status: "success" },
  { id: "log-1018", timestamp: "2026-06-22 09:33", actorName: "System", actorEmail: "system@acme.test", action: "Device agent went offline", category: "monitoring", target: "daniel-kim-mbp", ip: "203.0.113.51", device: "WorkPulse Device Agent", status: "warning" },
  { id: "log-1019", timestamp: "2026-06-21 16:40", actorName: "Alex Morgan", actorEmail: "owner@acme.test", action: "Upgraded subscription plan", category: "billing", target: "Business → Enterprise", ip: "203.0.113.24", device: "Chrome on macOS", status: "success" },
  { id: "log-1020", timestamp: "2026-06-21 14:05", actorName: "Sara Lopez", actorEmail: "sara.lopez@acme.test", action: "Updated employee department", category: "employees", target: "Tom Becker → Engineering", ip: "192.0.2.140", device: "Chrome on Windows", status: "success" },
  { id: "log-1021", timestamp: "2026-06-21 10:12", actorName: "Tom Becker", actorEmail: "tom.becker@acme.test", action: "Started timer", category: "time", target: "Apollo Redesign · Frontend", ip: "198.51.100.77", device: "WorkPulse Device Agent", status: "success" },
  { id: "log-1022", timestamp: "2026-06-20 15:22", actorName: "Maya Patel", actorEmail: "maya.patel@acme.test", action: "Changed allow-list rules", category: "settings", target: "Added figma.com", ip: "198.51.100.5", device: "Firefox on Linux", status: "success" },
  { id: "log-1023", timestamp: "2026-06-20 11:48", actorName: "Daniel Kim", actorEmail: "daniel.kim@acme.test", action: "Deleted project", category: "projects", target: "Internal Hackathon", ip: "203.0.113.51", device: "Safari on macOS", status: "warning" },
  { id: "log-1024", timestamp: "2026-06-19 17:03", actorName: "Alex Morgan", actorEmail: "owner@acme.test", action: "Cloned role", category: "roles", target: "Manager → Regional Manager", ip: "203.0.113.24", device: "Chrome on macOS", status: "success" },
  { id: "log-1025", timestamp: "2026-06-19 13:30", actorName: "Priya Nair", actorEmail: "priya.nair@acme.test", action: "Approved time-off request", category: "approvals", target: "Maya Patel · Jun 26", ip: "198.51.100.31", device: "Edge on Windows", status: "success" },
  { id: "log-1026", timestamp: "2026-06-19 09:50", actorName: "System", actorEmail: "system@acme.test", action: "Failed scheduled report delivery", category: "reports", target: "Monthly exec summary", ip: "—", device: "WorkPulse Scheduler", status: "failed" },
  { id: "log-1027", timestamp: "2026-06-18 16:14", actorName: "Sara Lopez", actorEmail: "sara.lopez@acme.test", action: "Reset employee password", category: "employees", target: "tom.becker@acme.test", ip: "192.0.2.140", device: "Chrome on Windows", status: "success" },
  { id: "log-1028", timestamp: "2026-06-18 12:20", actorName: "Alex Morgan", actorEmail: "owner@acme.test", action: "Updated working hours", category: "settings", target: "09:00–17:00 → 08:30–17:30", ip: "203.0.113.24", device: "Chrome on macOS", status: "success" },
  { id: "log-1029", timestamp: "2026-06-17 15:00", actorName: "Daniel Kim", actorEmail: "daniel.kim@acme.test", action: "Downloaded invoice", category: "billing", target: "INV-2026-0042", ip: "203.0.113.51", device: "Safari on macOS", status: "success" },
  { id: "log-1030", timestamp: "2026-06-16 10:30", actorName: "Maya Patel", actorEmail: "maya.patel@acme.test", action: "Signed in", category: "auth", target: "WorkPulse web", ip: "198.51.100.5", device: "Firefox on Linux", status: "success" },
]

/** Reference "today" for timeframe filtering (demo date). */
export const AUDIT_TODAY = "2026-06-25"

export const AUDIT_TIMEFRAMES: { value: string; label: string; cutoff: string }[] =
  [
    { value: "all", label: "All time", cutoff: "0000-00-00" },
    { value: "24h", label: "Last 24 hours", cutoff: "2026-06-24" },
    { value: "7d", label: "Last 7 days", cutoff: "2026-06-18" },
    { value: "30d", label: "Last 30 days", cutoff: "2026-05-26" },
  ]

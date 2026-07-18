/**
 * Audit event categories — presentational metadata (label + icon) for the
 * Audit Logs page filters and rows.
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

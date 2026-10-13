/**
 * Audit events — presentational metadata (label + icon) for the Audit Logs page and the Security
 * events feed, and the wording for the server's action codes and targets.
 *
 * Mirrors what the server actually writes (`audit::write` / `audit::item` across `backend/crates`):
 * seven categories — `security`, `settings`, `org`, `leave`, `attendance`, and (since the pay, deduction
 * and plan changes are audited — WP-425) `payroll` and `billing`. This used to list ten
 * invented ones and share only `settings` with the server, so most rows showed a raw key with a
 * generic icon (QA audit 2026-10-08, WP-382). An unknown key still degrades to a title-cased label,
 * an unknown action to its code.
 */
import type { LucideIcon } from "lucide-react"
import {
  Building2,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
} from "lucide-react"
import { TRACKING_MODE_META, isKnownTrackingMode, trackingModeOf } from "@/lib/tracking-mode"

export type AuditCategory =
  | "security"
  | "settings"
  | "org"
  | "leave"
  | "attendance"
  | "payroll"
  | "billing"

export interface AuditCategoryDef {
  key: AuditCategory
  label: string
  icon: LucideIcon
}

export const AUDIT_CATEGORIES: AuditCategoryDef[] = [
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "settings", label: "Settings", icon: SlidersHorizontal },
  { key: "org", label: "Organization", icon: Building2 },
  { key: "leave", label: "Leave", icon: DoorOpen },
  { key: "attendance", label: "Attendance", icon: CalendarCheck },
  { key: "payroll", label: "Payroll", icon: Wallet },
  { key: "billing", label: "Billing", icon: CreditCard },
]

/** The server's action codes, in words. Rows printed the raw code (WP-520). */
const ACTION_LABELS: Record<string, string> = {
  "mfa.reset": "Reset a member's authenticator",
  "monitoring.capture_now": "Requested a screenshot (Capture now)",
  "monitoring.capture_now.captured": "Captured a requested screenshot",
  "monitoring.capture_now.declined": "Declined a screenshot request",
  "monitoring.uninstall_passcode.rotated": "Rotated the agent uninstall passcode",
  "device.enrolled": "Enrolled a device",
  "device.released": "Released a device",
  "device.revoked": "Revoked a device",
  "device.revoked_on_leave": "Revoked a departing member's device",
  "enrollment_code.minted": "Created an enrolment code",
  "enrollment_code.revoked": "Revoked an enrolment code",
  "ownership.transfer": "Transferred ownership",
  owner_granted: "Made someone an owner",
  owner_revoked: "Removed an owner",
  "org.close": "Started closing the organization",
  "org.export": "Requested an organization data export",
  "org.tracking_mode_changed": "Changed the tracking mode",
  "fleet.update_policy": "Updated the monitoring settings",
  "fleet.update_capture_gate": "Updated capture authorisation",
  "app_url_rules.update": "Updated the tracking rules",
  "dept_app_url_rules.update": "Updated a department's tracking rules",
  "geofence.update": "Updated the office perimeter",
  "leave.balance_adjusted": "Adjusted a leave balance",
  "attendance.day_override": "Overrode an attendance day",
  "payroll.comp_changed": "Changed someone's pay",
  "payroll.deductions_changed": "Changed the payroll deductions",
  "billing.plan_changed": "Changed the subscription plan",
  "integrations.connected": "Connected an integration",
  "fleet.uninstall_passcode.viewed": "Viewed the agent uninstall passcode",
}

/** An action code in words. A page toggle rides the feature-toggle actions; its key is a route. */
export function auditActionLabel(action: string, target: string | null): string {
  if (action === "feature_enabled" || action === "feature_disabled") {
    const page = Boolean(target && (target.startsWith("/") || target.startsWith("page:")))
    if (action === "feature_enabled") return page ? "Showed a page" : "Turned a feature on"
    return page ? "Hid a page" : "Turned a feature off"
  }
  return ACTION_LABELS[action] ?? action
}

/** Config items the server records as a target. */
const CONFIG_TARGETS: Record<string, string> = {
  "CONFIG#TRACK": "Monitoring settings",
  "CONFIG#CAPTURE_GATE": "Capture authorisation",
}

/**
 * A target, readable: a person's or a device's id becomes its name, a `<user>/…` compound target
 * leads with the person's name, a config key becomes words, a tracking-mode change reads `A → B`.
 * Anything else is returned as stored — still traceable, never invented.
 */
export function resolveAuditTarget(
  target: string | null,
  people: ReadonlyMap<string, string>,
  devices: ReadonlyMap<string, string>,
): string | null {
  if (!target) return null
  if (CONFIG_TARGETS[target]) return CONFIG_TARGETS[target]
  const whole = people.get(target) ?? devices.get(target)
  if (whole) return whole
  const slash = target.indexOf("/")
  if (slash > 0) {
    const name = people.get(target.slice(0, slash))
    if (name) return `${name} · ${target.slice(slash + 1)}`
  }
  const mode = /^tracking_mode:([a-z]+)->([a-z]+)$/.exec(target)
  if (mode && isKnownTrackingMode(mode[1]) && isKnownTrackingMode(mode[2])) {
    const label = (m: string) => TRACKING_MODE_META[trackingModeOf(m)].label
    return `${label(mode[1])} → ${label(mode[2])}`
  }
  return target
}

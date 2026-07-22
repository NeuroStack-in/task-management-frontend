/**
 * Mirror of `wp-contracts/src/permissions.rs` — bit index → the FRONTEND permission ids that bit
 * lights up. This is what turns the JWT's `perm` claim (a u128 bitset as a decimal string) into a
 * usable UI gate for **server-created custom roles**, which the local roles store has never heard
 * of. The three system roles keep resolving from `constants/roles.ts` — this file is the fallback.
 *
 * Two vocabularies exist on purpose: the server's wire ids are scope-split (`activity:read:org`,
 * `time:track:self`) while the UI gates on coarser page-level ids (`activity:view`,
 * `time-tracking:self`). One bit can therefore light several frontend ids (a `manage` bit implies
 * its page's `view`), and a few frontend ids have NO server bit (`dashboard:view`, `tasks:*` ride
 * `projects:*` — the server has no task-level bits). The mapping below is UX-only approximation:
 * the server's bitset remains the real boundary, so an over-grant here surfaces as an honest 403,
 * never as data access.
 *
 * Keep in step with the enum in wp-contracts: bit indexes are stable by contract (renumbering is
 * forbidden there), so entries here only ever get ADDED.
 */
import type { PermissionId } from "@/types/rbac";

/** Frontend ids every authenticated member gets regardless of bits (no server-side bit exists). */
const BASELINE: PermissionId[] = ["dashboard:view"];

/** bit index (wp-contracts discriminant) → frontend permission ids it grants. */
const BIT_TO_FRONTEND: Record<number, PermissionId[]> = {
  // ── activity / monitoring · 0–9 ──
  0: [], // ActivityReadSelf — personal activity renders inside own dashboard; no page gate
  1: ["activity:view"], // ActivityReadTeam
  2: ["activity:view", "locations:view"], // ActivityReadOrg (locations board is org oversight)
  3: ["screenshots:view"], // ScreenshotsRead
  4: ["settings:view"], // MonitoringManage — monitoring settings live under Settings
  5: ["reports:export"], // ActivityExport
  // ── employees / org structure · 10–19 ──
  10: ["employees:view"], // EmployeesRead
  11: ["employees:view", "employees:manage"], // EmployeesManage
  12: ["settings:view", "settings:manage"], // OrgManage (dept/team CRUD lives in Settings→Org)
  13: ["settings:view", "settings:manage"], // OrgSettingsManage
  // ── projects · 20–29 (frontend task ids ride the project bits — no server task bits) ──
  20: ["projects:view", "tasks:view"], // ProjectsRead
  21: ["projects:create", "tasks:create"], // ProjectsCreate
  22: ["projects:manage", "tasks:edit", "tasks:delete", "tasks:assign"], // ProjectsManage
  // ── time / attendance · 30–39 ──
  30: ["time-tracking:view"], // TimeReadSelf
  31: ["time-tracking:view", "time-tracking:manage"], // TimeReadTeam (manage = team oversight)
  32: ["time-tracking:view", "time-tracking:manage"], // TimeReadOrg
  33: ["attendance:view"], // AttendanceReadSelf
  34: ["attendance:view", "attendance:manage"], // AttendanceReadTeam
  35: ["attendance:view", "attendance:manage"], // AttendanceReadOrg
  // ── leave / approvals · 40–49 ──
  40: ["leave:view", "leave:request"], // LeaveRequest
  41: ["leave:view", "leave:approve", "approvals:view", "approvals:approve"], // LeaveApprove
  42: ["leave:view", "leave:manage"], // LeaveManage
  // ── payroll / billing · 50–59 ──
  50: ["payroll:view"], // PayrollRead
  51: ["payroll:view", "payroll:manage", "payroll:export"], // PayrollManage
  52: ["billing:view"], // BillingRead
  53: ["billing:view", "billing:manage"], // BillingManage
  // ── insights / reports · 60–69 ──
  60: ["reports:view"], // ReportsRead
  61: ["reports:view", "reports:export"], // ReportsExport
  62: ["ai:view"], // AiInsightsRead (the frontend has a single `ai` id)
  63: ["anomalies:view"], // AnomaliesRead
  64: ["reports:export"], // AiPdfExport
  65: ["ai:view"], // AiAssistantUse
  // ── administration · 70–79 ──
  70: ["roles:view", "roles:manage"], // RolesManage
  71: ["security:view"], // SecurityRead
  72: ["security:view", "security:manage", "audit-logs:view"], // SecurityManage (covers audit, LLD §17)
  73: ["settings:view"], // EntitlementsManage — Features tab lives under Settings
  75: ["settings:view"], // OwnershipManage — page itself is is_owner-gated server-side
  // ── fleet / help / notifications ──
  80: ["agents:view", "agents:manage"], // AgentsManage
  90: ["help:view"], // HelpView
  91: ["help:view"], // SupportCreate
  100: ["notifications:view", "communication:view"], // NotificationsRead
  101: ["notifications:view"], // NotificationsManage
  // ── contributor-only · 110–119 ──
  110: ["time-tracking:view", "time-tracking:self"], // TimeTrackSelf
};

/**
 * Decode the `perm` claim into frontend permission ids (deduped, plus the baseline). Returns
 * `null` for an absent/garbage claim so callers can fall back to the local role lookup.
 */
export function permissionsFromBitset(perm: string | undefined): PermissionId[] | null {
  if (!perm || !/^\d+$/.test(perm)) return null;
  let bits: bigint;
  try {
    bits = BigInt(perm);
  } catch {
    return null;
  }
  const out = new Set<PermissionId>(BASELINE);
  for (const [bit, ids] of Object.entries(BIT_TO_FRONTEND)) {
    if ((bits >> BigInt(bit)) & BigInt(1)) {
      for (const id of ids) out.add(id);
    }
  }
  return [...out];
}

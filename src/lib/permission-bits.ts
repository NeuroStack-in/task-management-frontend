/**
 * Mirror of `wp-contracts/src/permissions.rs` — bit index → the FRONTEND permission ids that bit
 * lights up. This is what turns the JWT's `perm` claim (a u128 bitset as a decimal string) into the
 * UI gate for **every** role (`resolveRole`), system and custom alike: Admin and Employee are
 * editable per org, so only the claim knows what they hold. The lists in `constants/roles.ts` are
 * the fallback for a session minted before the claim existed.
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
export const BASELINE: PermissionId[] = ["dashboard:view"];

/** bit index (wp-contracts discriminant) → frontend permission ids it grants. */
const BIT_TO_FRONTEND: Record<number, PermissionId[]> = {
  // ── activity / monitoring · 0–9 ──
  0: [], // ActivityReadSelf — personal activity renders inside own dashboard; no page gate
  // ActivityReadTeam — the Locations board serves a department-scoped reader (the server requires
  // this bit and widens on the Org one). The Activity tab reads the org-wide route, which needs the
  // Org bit, so lighting `activity:view` here showed a tab that always 403'd, while the Locations
  // board it can load stayed hidden (QA audit 2026-10-08, WP-094).
  1: ["locations:view"],
  2: ["activity:view", "locations:view"], // ActivityReadOrg — implies the team read server-side
  3: ["screenshots:view"], // ScreenshotsRead
  4: ["settings:view", "monitoring:manage"], // MonitoringManage — monitoring settings live under Settings; the office-perimeter (geofence) editor gates on `monitoring:manage`
  5: ["reports:export"], // ActivityExport
  // AppUsageReadPerson — reading WHICH apps one named person used. Its own bit, and its own
  // frontend id, because it is deliberately grantable apart from `activity:view`: the
  // aggregate oversight and the individual application history are different privileges.
  6: ["activity:apps:person"],
  // ── employees / org structure · 10–19 ──
  10: ["employees:view"], // EmployeesRead
  11: ["employees:view", "employees:manage"], // EmployeesManage
  // OrgManage — department/team CRUD only. It used to light `settings:manage` like bit 13, so a role
  // holding one of the two saw the other's editors live and every save 403'd: the server tells
  // department writes (`OrgManage`) apart from working hours, holidays, policies, branding and the
  // org profile (`OrgSettingsManage`) (QA audit 2026-10-08, WP-324).
  12: ["settings:view", "departments:manage"],
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
  // `attendance:manage` is the team/org oversight READ (the roster view), like `time-tracking:manage`.
  34: ["attendance:view", "attendance:manage"], // AttendanceReadTeam
  35: ["attendance:view", "attendance:manage"], // AttendanceReadOrg
  // AttendanceManage — the WRITE path (recompute, day overrides). Its own id: it used to light
  // `attendance:manage` too, so "View team attendance" was offered the Recompute control and every
  // press 403'd (QA audit 2026-10-08, WP-324).
  36: ["attendance:view", "attendance:edit"], // AttendanceManage
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
  62: ["ai:view"], // AiInsightsRead — AI summaries, the attention list
  63: ["anomalies:view"], // AnomaliesRead
  64: ["reports:export"], // AiPdfExport
  // AiAssistantUse. **Its own id, not `ai:view`.** The two bits mean different things on the
  // server — "may read AI-generated insights" vs "may talk to the assistant" — and collapsing them
  // here meant granting an Employee the chat assistant would also have opened every AI-summary
  // surface to them. Admins hold both bits and so still get both ids; nothing they see changes.
  65: ["ai:use"],
  // ── administration · 70–79 ──
  70: ["roles:view", "roles:manage"], // RolesManage
  71: ["security:view"], // SecurityRead
  72: ["security:view", "security:manage", "audit-logs:view"], // SecurityManage (covers audit, LLD §17)
  // EntitlementsManage. The Features tab lives under Settings, but `settings:view` alone is what
  // the tab READS with — the toggles gate on `entitlements:manage`, so mapping only the former
  // left every Admin holding this bit staring at switches the server would have accepted.
  73: ["settings:view", "entitlements:manage"],
  // OwnershipManage — no frontend id. Every ownership route is gated on `is_owner`, never on this bit
  // (owners get the wildcard anyway), so it grants nothing; mapping it to `settings:view` handed a
  // deputy the Organization, Features, Monitoring and Tracking-rules pages instead (QA audit
  // 2026-10-08, WP-325).
  75: [],
  // ── fleet / help / notifications ──
  80: ["agents:view", "agents:manage"], // AgentsManage
  90: ["help:view"], // HelpView
  91: ["help:view"], // SupportCreate
  // `communication:view` was mapped here too, for the Inbox nav entry. The Inbox route is gone
  // (never built — it rendered ComingSoon), so the id no longer exists in the catalog. The server
  // bit is untouched: this file mirrors bits onto frontend ids, it does not define them.
  100: ["notifications:view"], // NotificationsRead
  101: ["notifications:view"], // NotificationsManage
  // ── contributor-only · 110–119 ──
  110: ["time-tracking:view", "time-tracking:self"], // TimeTrackSelf
  // ── integrations · 120–121 ──
  //
  // Both were missing, which hid the Integrations section from every server-created custom role that
  // held them — the server said yes and the sidebar had no entry to show. Bits 74 (AuditRead,
  // vestigial), 81 (RemoteSupportApprove, CUT) and 82 (SupportRespond, platform-internal) stay
  // deliberately unmapped: they are absent from the server's own `CATALOG` too.
  120: ["integrations:view"], // IntegrationsRead
  121: ["integrations:view", "integrations:manage"], // IntegrationsManage
};

/**
 * Whether the `perm` claim carries one server bit. Needed where two bits share a frontend id —
 * `TimeReadTeam` (31) and `TimeReadOrg` (32) both light `time-tracking:manage`, but only the second
 * reaches beyond the caller's own department. `null` for an absent/garbage claim (no verdict).
 */
export function hasPermissionBit(perm: string | undefined, bit: number): boolean | null {
  if (!perm || !/^\d+$/.test(perm)) return null;
  try {
    return ((BigInt(perm) >> BigInt(bit)) & BigInt(1)) === BigInt(1);
  } catch {
    return null;
  }
}

/** `TimeReadOrg` — read anyone's tracked time, not only your own department's. */
export const TIME_READ_ORG_BIT = 32;

/** `ActivityReadOrg` — the AI executive report requires it (it names the org's top and bottom performers). */
export const ACTIVITY_READ_ORG_BIT = 2;

/** `AiPdfExport` — the AI executive report. It shares `reports:export` with two other bits, so the id cannot tell. */
export const AI_PDF_EXPORT_BIT = 64;

/**
 * Server wire id (`Permission::id` in wp-contracts) → bit index — the role editor's vocabulary.
 * Only the `CATALOG` permissions: those are the only ids the editor offers and `by_id` accepts.
 */
export const SERVER_ID_BITS: Readonly<Record<string, number>> = {
  "activity:read:self": 0,
  "activity:read:team": 1,
  "activity:read:org": 2,
  "screenshots:read": 3,
  "monitoring:manage": 4,
  "activity:export": 5,
  "activity:apps:person": 6,
  "employees:read": 10,
  "employees:manage": 11,
  "org:manage": 12,
  "org:settings": 13,
  "projects:read": 20,
  "projects:create": 21,
  "projects:manage": 22,
  "time:read:self": 30,
  "time:read:team": 31,
  "time:read:org": 32,
  "attendance:read:self": 33,
  "attendance:read:team": 34,
  "attendance:read:org": 35,
  "attendance:manage": 36,
  "leave:request": 40,
  "leave:approve": 41,
  "leave:manage": 42,
  "payroll:read": 50,
  "payroll:manage": 51,
  "billing:read": 52,
  "billing:manage": 53,
  "reports:read": 60,
  "reports:export": 61,
  "ai_insights:read": 62,
  "anomalies:read": 63,
  "ai_pdf:export": 64,
  "ai_assistant:use": 65,
  "roles:manage": 70,
  "security:read": 71,
  "security:manage": 72,
  "entitlements:manage": 73,
  "ownership:manage": 75,
  "agents:manage": 80,
  "help:view": 90,
  "support:create": 91,
  "notifications:read": 100,
  "notifications:manage": 101,
  "time:track:self": 110,
  "integrations:view": 120,
  "integrations:manage": 121,
};

/**
 * The server wire ids the `perm` claim carries (catalog ids only). `null` for an absent/garbage
 * claim. Callers that compare against what the server will accept must still close this set over the
 * catalog's `implies`, as `AuthContext` does (`PermSet::with_implied`).
 */
export function serverIdsFromBitset(perm: string | undefined): Set<string> | null {
  if (!perm || !/^\d+$/.test(perm)) return null;
  let bits: bigint;
  try {
    bits = BigInt(perm);
  } catch {
    return null;
  }
  const out = new Set<string>();
  for (const [id, bit] of Object.entries(SERVER_ID_BITS)) {
    if ((bits >> BigInt(bit)) & BigInt(1)) out.add(id);
  }
  return out;
}

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

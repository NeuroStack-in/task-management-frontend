/**
 * Backend permission wire ids → this app's permission ids.
 *
 * ## Why this file exists
 *
 * The two sides evolved separate vocabularies. The server's authorization truth is a `u128` bitset
 * whose wire ids look like `activity:read:self` / `time:track:self` / `org:settings`; this app gates
 * its nav and routes on ids like `activity:view` / `time-tracking:self` / `settings:view`. Until
 * now nothing bridged them, so `useCurrentRole` could only resolve a role it already knew about
 * locally — meaning a **custom role created on the server was invisible to the UI gate**, and the
 * member holding it saw an empty sidebar.
 *
 * This map is that bridge. It is deliberately explicit rather than algorithmic: the relationship is
 * not a rename pattern, it is a set of judgements (one server id can imply several app ids, and a
 * few app ids have no server equivalent at all).
 *
 * ## Rules for editing
 *
 * - **New permissions should use the server's id verbatim** (`org:manage`, `leave:manage` already
 *   do). Only add an entry here when an id genuinely cannot be aligned.
 * - A server id may map to **several** app ids — `activity:read:org` unlocks both the activity view
 *   and the reports view, because that is what the bit actually authorizes.
 * - **Never map an app id that the server does not gate.** `locations:view` and `integrations:*`
 *   have no server bit because those features have no backend; granting them from a server role
 *   would be inventing authority.
 *
 * ## What this is NOT
 *
 * It is not a security boundary. The server enforces the bitset and is the real gate
 * (`lib/api.ts`); this only decides what the UI offers. A mapping mistake shows or hides a menu
 * item — it cannot grant access to data.
 */
import type { PermissionId } from "@/types/rbac";

/** One server wire id → the app ids it should unlock. */
const WIRE_TO_APP: Record<string, PermissionId[]> = {
  // ── activity / monitoring ──
  "activity:read:self": ["activity:view"],
  "activity:read:team": ["activity:view"],
  "activity:read:org": ["activity:view", "reports:view"],
  "screenshots:read": ["screenshots:view"],
  "monitoring:manage": ["settings:view", "settings:manage"],
  "activity:export": ["reports:export"],

  // ── employees ──
  "employees:read": ["employees:view"],
  "employees:manage": ["employees:view", "employees:manage"],
  "org:manage": ["org:manage"],

  // ── projects (also covers tasks: the app splits them, the server does not) ──
  "projects:read": ["projects:view", "tasks:view"],
  "projects:create": ["projects:create", "tasks:create"],
  "projects:manage": [
    "projects:manage",
    "tasks:edit",
    "tasks:delete",
    "tasks:assign",
  ],

  // ── time ──
  "time:read:self": ["time-tracking:view", "dashboard:view"],
  "time:read:team": ["time-tracking:view", "time-tracking:manage"],
  "time:read:org": ["time-tracking:view", "time-tracking:manage"],
  "time:track:self": ["time-tracking:self"],

  // ── attendance ──
  "attendance:read:self": ["attendance:view"],
  "attendance:read:team": ["attendance:view", "attendance:manage"],
  "attendance:read:org": ["attendance:view", "attendance:manage"],

  // ── leave & approvals ──
  "leave:request": ["leave:view", "leave:request"],
  "leave:approve": ["leave:view", "leave:approve", "approvals:view", "approvals:approve"],
  "leave:manage": ["leave:view", "leave:manage"],

  // ── money ──
  "payroll:read": ["payroll:view"],
  "payroll:manage": ["payroll:view", "payroll:manage", "payroll:export"],
  "billing:read": ["billing:view"],
  "billing:manage": ["billing:view", "billing:manage"],

  // ── reporting & AI ──
  "reports:read": ["reports:view"],
  "reports:export": ["reports:export"],
  "ai_pdf:export": ["reports:export"],
  "ai_insights:read": ["reports:view"],
  "anomalies:read": ["reports:view"],
  "ai_assistant:use": [],

  // ── admin ──
  "roles:manage": ["roles:view", "roles:manage"],
  "security:read": ["security:view"],
  "security:manage": ["security:view", "security:manage"],
  "audit:read": ["security:view"],
  "org:settings": ["settings:view", "settings:manage"],
  "entitlements:manage": ["settings:view", "settings:manage"],
  "ownership:manage": ["settings:view", "settings:manage"],
  "agents:manage": ["agents:view", "agents:manage"],

  // ── help & notifications ──
  "help:view": [],
  "support:create": [],
  "notifications:read": [],
  "notifications:manage": [],
};

/**
 * App ids every authenticated member holds regardless of role. These gate surfaces the server does
 * not bit-gate at all — `/v1/notifications` and `/v1/support/tickets` are self-scoped, and the
 * dashboard is a composition of things already gated individually.
 */
const BASELINE: PermissionId[] = [
  "dashboard:view",
  "leave:view",
  "leave:request",
];

/**
 * Project a server role's wire ids onto this app's permission ids.
 *
 * `isOwner` short-circuits to the wildcard, matching `canAccess`: the Owner's bitset is near-empty
 * on the server because ownership is a *flag* outside the capability space, so mapping its (few)
 * bits would produce an almost-empty sidebar for the one role that can do everything.
 */
export function mapWirePermissions(
  wireIds: string[],
  isOwner: boolean,
): PermissionId[] {
  if (isOwner) return ["*"];
  const out = new Set<PermissionId>(BASELINE);
  for (const id of wireIds) {
    for (const appId of WIRE_TO_APP[id] ?? []) out.add(appId);
  }
  return [...out];
}

/** Server wire ids this map doesn't know — surfaced in dev so drift is visible, never silent. */
export function unmappedWireIds(wireIds: string[]): string[] {
  return wireIds.filter((id) => !(id in WIRE_TO_APP));
}

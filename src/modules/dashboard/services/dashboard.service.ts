/**
 * Dashboard layout persistence — the real backend (`identity` context, LLD §3).
 *
 * Routes (self-scoped; no route-level permission — any authenticated user reads/writes **their own**
 * layout, and the server perm-filters per widget):
 *   - `GET /v1/me/dashboard-layouts` — both layouts (`{ personal, oversight? }`); `oversight` is
 *     present only when the caller holds an oversight-class bit. There is **no** GET-by-type route.
 *   - `PUT /v1/me/dashboard-layouts/{type}` — whole-document, version-conditioned write.
 *     `{type}` accepts exactly `personal` | `oversight` (`dashboard_layout::dto::scope_for_kind`);
 *     anything else is 404. A stale `version` is a **409** `version_conflict`.
 *
 * DTOs mirror `backend/crates/identity/src/features/dashboard_layout/dto.rs`:
 * `WidgetPlacement { widget_id, order, config }` · `LayoutView { widgets, version }` ·
 * `DashboardLayouts { personal, oversight? }` · `SaveLayoutRequest { widgets, version }`.
 *
 * **The id seam — converged.** Frontend widget types now mirror the fixed 13-widget catalog in
 * `crates/wp-contracts/src/widgets.rs`: a type is either a catalog `widget_id` verbatim
 * (`org_attendance`) or `<catalog_id>.<variant>` (`org_activity.heatmap`) where the frontend has
 * several distinct visualizations of one catalog entry. Placements store the catalog id directly in
 * `widget_id` and the variant + visibility in the opaque `config` (`{ variant?, visible }`), so the
 * server validates and perm-filters real catalog ids. Duplicate `widget_id`s across variants are
 * fine — the server doesn't require uniqueness. Each catalog entry's `required_perm` is mirrored in
 * `CATALOG_REQUIRED_PERMISSION` below and used to pre-filter what a user can see/save, so one
 * unpermitted widget can't 403 the whole layout PUT.
 */
import { apiFetch } from "@/lib/api";
import type { PermissionId } from "@/types/rbac";
import type { FeatureKey } from "@/stores/features.store";
import {
  DEFAULT_WIDGETS,
  LEGACY_WIDGET_TYPE,
  catalogIdOf,
  variantOf,
  type DashboardWidget,
  type WidgetType,
} from "@/stores/dashboard.store";

/** `{type}` path values the server accepts (`scope_for_kind`). */
export type DashboardLayoutType = "personal" | "oversight";

/** Mirrors `dashboard_layout::dto::WidgetPlacement`. `config` is an opaque per-widget JSON map. */
export interface ApiWidgetPlacement {
  widget_id: string;
  order: number;
  config: Record<string, unknown>;
}

/** Mirrors `dashboard_layout::dto::LayoutView` — one dashboard + its optimistic-lock version. */
export interface ApiLayoutView {
  widgets: ApiWidgetPlacement[];
  version: number;
}

/** Mirrors `dashboard_layout::dto::DashboardLayouts` (the GET response). */
export interface ApiDashboardLayouts {
  personal: ApiLayoutView;
  /** Only present when the caller holds an oversight-class permission bit. */
  oversight?: ApiLayoutView;
}

/** Mirrors `dashboard_layout::dto::SaveLayoutRequest` (the PUT body). */
export interface SaveLayoutRequest {
  widgets: ApiWidgetPlacement[];
  /** The version the client last read — the server 409s (`version_conflict`) on mismatch. */
  version: number;
}

/** `GET /v1/me/dashboard-layouts` — both layouts, read-time perm-filtered. */
export function getDashboardLayouts(): Promise<ApiDashboardLayouts> {
  return apiFetch<ApiDashboardLayouts>("/v1/me/dashboard-layouts");
}

/**
 * One dashboard's stored layout, or `null` when the server has none for this caller (the server
 * returns an empty version-0 layout when nothing is stored; `oversight` is absent entirely without
 * an oversight bit). There is no per-type GET route, so this reads the combined document.
 */
export async function getDashboardLayout(
  type: DashboardLayoutType,
): Promise<ApiLayoutView | null> {
  const layouts = await getDashboardLayouts();
  return (type === "personal" ? layouts.personal : layouts.oversight) ?? null;
}

/** `PUT /v1/me/dashboard-layouts/{type}` — whole-document save; echoes the new `{widgets, version}`. */
export function putDashboardLayout(
  type: DashboardLayoutType,
  body: SaveLayoutRequest,
): Promise<ApiLayoutView> {
  return apiFetch<ApiLayoutView>(
    `/v1/me/dashboard-layouts/${encodeURIComponent(type)}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

// ── Catalog permission mirror ────────────────────────────────────────────────────────────────────

/**
 * `wp-contracts::widgets::WIDGETS` oversight entries → the frontend id of each entry's
 * `required_perm` (the frontend mirrors `wp-contracts`). Drives the UI pre-filter: a user only
 * sees/saves widgets whose catalog permission they hold, matching the server's per-widget gate.
 */
export const CATALOG_REQUIRED_PERMISSION: Record<string, PermissionId> = {
  team_activity: "activity:view", // ActivityReadTeam
  org_activity: "activity:view", // ActivityReadOrg
  team_attendance: "attendance:view", // AttendanceReadTeam
  org_attendance: "attendance:view", // AttendanceReadOrg
  payroll_summary: "payroll:view", // PayrollRead
  reports: "reports:view", // ReportsRead
  attention_list: "ai:view", // AiInsightsRead
};

/** The frontend permission gating a widget, from its catalog entry's `required_perm`. */
export function widgetPermission(type: WidgetType): PermissionId | null {
  return CATALOG_REQUIRED_PERMISSION[catalogIdOf(type)] ?? null;
}

/**
 * The org **feature** a widget belongs to (MANAGED-AGENT.md §8) — the sibling of `widgetPermission`,
 * so a widget whose feature the org switched off (or whose tracking mode hides it) disappears the
 * same way its route would. Three widgets don't inherit their catalog's feature and are overridden.
 * `payroll_summary` is deliberately absent (no feature key exists for payroll).
 */
const WIDGET_FEATURE_OVERRIDE: Partial<Record<WidgetType, FeatureKey>> = {
  "reports.upcoming_tasks": "projects", // it lists tasks, not reports
  "attention_list.ai_summary": "ai.insights",
};
const CATALOG_FEATURE: Record<string, FeatureKey> = {
  org_activity: "monitoring.activity",
  team_activity: "monitoring.activity",
  org_attendance: "attendance",
  reports: "reports.basic",
  // payroll_summary: intentionally omitted — /payroll has no catalog key.
};
export function widgetFeature(type: WidgetType): FeatureKey | null {
  return (
    WIDGET_FEATURE_OVERRIDE[type] ?? CATALOG_FEATURE[catalogIdOf(type)] ?? null
  );
}

// ── Frontend widget ⇄ catalog placement mapping ──────────────────────────────────────────────────

const KNOWN_TYPES = new Set<string>(DEFAULT_WIDGETS.map((w) => w.type));

/**
 * Encode the store's widget list as server placements (order = position, variant + visibility in
 * `config`). `allow` pre-filters widgets the caller may not hold (`widgetPermission`) — the server
 * 403s a placement whose `required_perm` the caller lacks, and one such widget would fail the
 * whole PUT.
 */
export function encodeLayout(
  widgets: DashboardWidget[],
  allow: (w: DashboardWidget) => boolean = () => true,
): ApiWidgetPlacement[] {
  return [...widgets]
    .filter(allow)
    .sort((a, b) => a.position - b.position)
    .map((w, i) => {
      const variant = variantOf(w.type);
      return {
        widget_id: catalogIdOf(w.type),
        order: i,
        config: variant
          ? { variant, visible: w.visible }
          : { visible: w.visible },
      };
    });
}

/** Resolve a stored placement to a frontend widget type, or `null` when unrecognizable. */
function typeOfPlacement(p: ApiWidgetPlacement): WidgetType | null {
  // Legacy fallback — REMOVABLE once pre-migration layouts have aged out (saved before the
  // 2026-07 id convergence): the old encoder wrote the closest catalog id in `widget_id` and the
  // real frontend id in `config.wp_widget`. When `wp_widget` is present, it identifies the widget.
  const legacy = p.config?.wp_widget;
  if (typeof legacy === "string") {
    const mapped = LEGACY_WIDGET_TYPE[legacy] ?? legacy;
    return KNOWN_TYPES.has(mapped) ? (mapped as WidgetType) : null;
  }
  // Current shape: `widget_id` is the catalog id; a many-to-one entry carries `config.variant`.
  const variant = p.config?.variant;
  const type =
    typeof variant === "string" ? `${p.widget_id}.${variant}` : p.widget_id;
  return KNOWN_TYPES.has(type) ? (type as WidgetType) : null;
}

/**
 * Decode server placements back into the store's widget list. Widgets missing from the server
 * document — perm-filtered by the server, or added to the app since the layout was saved — are
 * appended **hidden**, so nothing ever crashes or disappears from the Customize list. Returns
 * `null` when nothing usable is stored (caller keeps local state).
 */
export function decodeLayout(
  placements: ApiWidgetPlacement[],
): DashboardWidget[] | null {
  const seen = new Set<string>();
  const decoded: DashboardWidget[] = [];

  for (const p of [...placements].sort((a, b) => a.order - b.order)) {
    const type = typeOfPlacement(p);
    if (!type || seen.has(type)) continue;
    const def = DEFAULT_WIDGETS.find((w) => w.type === type);
    if (!def) continue;
    seen.add(type);
    decoded.push({
      ...def,
      position: decoded.length,
      visible: p.config?.visible !== false,
    });
  }
  if (decoded.length === 0) return null;

  for (const def of DEFAULT_WIDGETS) {
    if (seen.has(def.type)) continue;
    decoded.push({ ...def, position: decoded.length, visible: false });
  }
  return decoded;
}

/**
 * Per-user dashboard layout — the real backend (`identity` context, LLD §3).
 *
 * - `GET /v1/me/dashboard-layouts` → `{personal, oversight?}`. Self-scoped: any authenticated user
 *   reads their own. `oversight` is **omitted entirely** unless the caller holds an oversight-class
 *   permission, so `undefined` means "this user has no oversight dashboard", not "it's empty".
 * - `PUT /v1/me/dashboard-layouts/{type}` (`type` ∈ `personal` | `oversight`) → whole-document,
 *   **version-conditioned** write. You send the `version` you last read; the server stores
 *   `version + 1` under a conditional put and returns `409 version_conflict` if the stored version
 *   moved underneath you (another tab/device saved first). A 409 must never be retried blindly — the
 *   caller reloads the server's copy and tells the user, rather than clobbering the other write.
 *
 * The server validates every `widget_id` against a **code-defined catalog** ({@link BACKEND_WIDGETS},
 * mirrored from `wp_contracts::widgets::WIDGETS`) and rejects anything unknown (`400`), belonging to
 * the other dashboard (`400`), or not permitted to the caller (`403`). Geometry/config only lives
 * here — widget *data* comes from each widget's own context.
 *
 * Reads are permission-filtered at read time: a widget whose permission the user lost is hidden from
 * the response but **left in the stored item**, so restoring the permission restores the widget.
 * That means a round-trip of GET → PUT by a partially-permissioned user would silently drop the
 * hidden widgets — save only from a layout the user actually edited.
 */
import { apiFetch, ApiError } from "@/lib/api";

/** The two dashboards the backend knows about (`dto::scope_for_kind`). */
export type DashboardKind = "personal" | "oversight";

/**
 * Mirror of the backend's 13-widget catalog (`wp_contracts::widgets::WIDGETS`). A `widget_id` the
 * server doesn't know is a 400, so this is the exhaustive set of ids a layout may contain.
 */
export const BACKEND_WIDGETS = {
  personal: [
    "my_activity",
    "my_timesheet",
    "my_attendance",
    "my_tasks",
    "my_leave",
    "notifications",
  ],
  oversight: [
    "team_activity",
    "org_activity",
    "team_attendance",
    "org_attendance",
    "payroll_summary",
    "reports",
    "attention_list",
  ],
} as const satisfies Record<DashboardKind, readonly string[]>;

/** True if `id` is a widget the backend will accept for `kind`. */
export function isKnownWidget(kind: DashboardKind, id: string): boolean {
  return (BACKEND_WIDGETS[kind] as readonly string[]).includes(id);
}

/** Mirrors `dto::WidgetPlacement`. `config` is an opaque per-widget map the server never inspects. */
export interface ApiWidgetPlacement {
  widget_id: string;
  order: number;
  config: unknown;
}

/** Mirrors `dto::LayoutView`. `version` is 0 for a dashboard that has never been saved. */
export interface ApiLayoutView {
  widgets: ApiWidgetPlacement[];
  version: number;
}

/** Mirrors `dto::DashboardLayouts`. `oversight` absent ⇒ the caller holds no oversight bit. */
export interface ApiDashboardLayouts {
  personal: ApiLayoutView;
  oversight?: ApiLayoutView;
}

/** Mirrors `dto::SaveLayoutRequest`. */
export interface ApiSaveLayoutRequest {
  widgets: ApiWidgetPlacement[];
  /** The version last read. Server stores `version + 1`; a mismatch is a 409. */
  version: number;
}

/** Server-side caps (`dto::MAX_WIDGETS`). */
export const MAX_WIDGETS = 100;

export async function getDashboardLayouts(
  signal?: AbortSignal,
): Promise<ApiDashboardLayouts> {
  return apiFetch<ApiDashboardLayouts>("/v1/me/dashboard-layouts", { signal });
}

/**
 * Save one dashboard whole-document. Throws `ApiError`; check {@link isVersionConflict} on the error
 * to distinguish "someone else saved first" from a real failure.
 */
export async function saveDashboardLayout(
  kind: DashboardKind,
  req: ApiSaveLayoutRequest,
): Promise<ApiLayoutView> {
  return apiFetch<ApiLayoutView>(
    `/v1/me/dashboard-layouts/${encodeURIComponent(kind)}`,
    { method: "PUT", body: JSON.stringify(req) },
  );
}

/** A 409 from the version guard — the stored layout moved under us. */
export function isVersionConflict(e: unknown): boolean {
  return e instanceof ApiError && e.status === 409;
}

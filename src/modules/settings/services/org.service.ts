/**
 * Organization meta + lifecycle — the real backend (`identity` context, LLD §14).
 *
 * These are the owner/admin-authed org routes:
 *   - `PATCH /v1/org` edits the four editable meta fields (name, timezone, website, emp_id_prefix)
 *     under an optimistic lock (`version`). **There is deliberately no `GET /v1/org`** — org meta is
 *     write-only from the app today (a read endpoint hasn't landed), so callers can only observe the
 *     server's state via the `OrgView` a successful write returns. Reflect that; don't invent it.
 *   - The lifecycle routes (`transfer-ownership`, `close`, `reopen`, `export`) are **owner-only**
 *     (403 otherwise) and each requires the caller to re-type the workspace **slug** as `confirm`.
 */
import { apiFetch } from "@/lib/api";

/** What `PATCH /v1/org` returns — the org's current server-side meta. `version` drives the next save. */
export interface OrgView {
  name: string;
  slug: string;
  plan: string;
  status: string;
  timezone?: string;
  website?: string;
  emp_id_prefix?: string;
  /** Free-text industry label (e.g. "Software"). Optional org meta. */
  industry?: string;
  /** Company-size bucket (e.g. "11-50"). Optional org meta. */
  size?: string;
  version: number;
}

/**
 * Body for `PATCH /v1/org`. At least one meta field must be present — an empty body 400s
 * ("nothing to update"). `version` is the optimistic-lock token from the last `OrgView`; omit it on
 * the very first save (before any `OrgView` is known).
 */
export interface UpdateOrgRequest {
  name?: string;
  timezone?: string;
  website?: string;
  emp_id_prefix?: string;
  industry?: string;
  size?: string;
  version?: number;
  /** Optionally mark one onboarding-wizard step (LLD §2): step ∈ org_setup|invite_team|tracking|
   * personalize, state ∈ pending|done|skipped. A pure onboarding update needs no meta field. */
  onboarding?: { step: string; state: string };
}

export function updateOrg(body: UpdateOrgRequest): Promise<OrgView> {
  return apiFetch<OrgView>("/v1/org", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** `GET /v1/org` — the org's current meta. Any authenticated member may read it (shown in Settings,
 * used to prefill the org forms). Throws `ApiError` 404 only before the org exists. */
export function getOrg(): Promise<OrgView> {
  return apiFetch<OrgView>("/v1/org");
}

/**
 * Body for `POST /v1/org/transfer-ownership` (owner-only). `confirm` is the typed workspace slug;
 * `take_role` is the role the departing owner keeps (null/omit ⇒ server default, typically Admin).
 */
export interface TransferOwnershipRequest {
  new_owner_id: string;
  take_role?: string | null;
  /** The typed workspace **slug** — the server validates it. */
  confirm: string;
}

export interface TransferOwnershipResult {
  new_owner_id: string;
  /** True when the former owner no longer belongs to the org after the transfer. */
  transferor_left: boolean;
}

export function transferOwnership(
  body: TransferOwnershipRequest,
): Promise<TransferOwnershipResult> {
  return apiFetch<TransferOwnershipResult>("/v1/org/transfer-ownership", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `POST /v1/org/close` (owner-only). Returns the new status and an optional purge deadline. */
export interface CloseOrgResult {
  status: string;
  /** Epoch (seconds) after which the closed org's data is permanently purged, if applicable. */
  purge_after?: number;
}

export function closeOrg(confirm: string): Promise<CloseOrgResult> {
  return apiFetch<CloseOrgResult>("/v1/org/close", {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}

/** `POST /v1/org/reopen` (owner-only) — reverses a close before the purge deadline. */
export interface ReopenOrgResult {
  status: string;
}

export function reopenOrg(confirm: string): Promise<ReopenOrgResult> {
  return apiFetch<ReopenOrgResult>("/v1/org/reopen", {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}

/** `POST /v1/org/export` (owner-only) — enqueues an async export job. */
export interface ExportOrgResult {
  job_id: string;
  status: string;
}

export function exportOrg(confirm: string): Promise<ExportOrgResult> {
  return apiFetch<ExportOrgResult>("/v1/org/export", {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}

// ── Branding (singleton) — `GET`/`PATCH /v1/org/branding` ─────────────────────────────────────────
// The org's visual identity: a logo URL and two brand colors. A single row per org (not a
// collection), so there is one GET and one PATCH — no id. All fields optional; PATCH only what changed.

export interface OrgBranding {
  logo_url?: string;
  /** Hex color (e.g. `#4f46e5`). */
  primary_color?: string;
  /** Hex color (e.g. `#a855f7`). */
  accent_color?: string;
}

/** `GET /v1/org/branding` — the org's branding. Any member may read it. */
export function getBranding(): Promise<OrgBranding> {
  return apiFetch<OrgBranding>("/v1/org/branding");
}

/** `PATCH /v1/org/branding` — update branding fields. Needs `settings:manage` (server `OrgSettingsManage`). */
export function updateBranding(body: OrgBranding): Promise<OrgBranding> {
  return apiFetch<OrgBranding>("/v1/org/branding", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// ── Locations (collection) — `/v1/org/locations` ──────────────────────────────────────────────────

export interface OrgLocation {
  id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
}

/** Body for creating/updating a location (id is path-only, never in the body). */
export interface LocationInput {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
}

/** `GET /v1/org/locations` → the org's locations. */
export function listLocations(): Promise<OrgLocation[]> {
  return apiFetch<{ locations: OrgLocation[] }>("/v1/org/locations").then(
    (r) => r.locations,
  );
}

/** `POST /v1/org/locations` — create a location (`name` required). Needs `settings:manage`. */
export function createLocation(
  body: LocationInput & { name: string },
): Promise<OrgLocation> {
  return apiFetch<OrgLocation>("/v1/org/locations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `PATCH /v1/org/locations/{id}` — edit a location. Needs `settings:manage`. */
export function updateLocation(
  id: string,
  body: LocationInput,
): Promise<OrgLocation> {
  return apiFetch<OrgLocation>(`/v1/org/locations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** `DELETE /v1/org/locations/{id}`. Needs `settings:manage`. */
export async function deleteLocation(id: string): Promise<void> {
  await apiFetch(`/v1/org/locations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── Holidays (collection) — `/v1/org/holidays` ────────────────────────────────────────────────────

export interface OrgHoliday {
  id: string;
  name: string;
  /** `YYYY-MM-DD`. */
  date: string;
}

export interface HolidayInput {
  name?: string;
  /** `YYYY-MM-DD`. */
  date?: string;
}

/** `GET /v1/org/holidays` → the org's holiday calendar. */
export function listHolidays(): Promise<OrgHoliday[]> {
  return apiFetch<{ holidays: OrgHoliday[] }>("/v1/org/holidays").then(
    (r) => r.holidays,
  );
}

/** `POST /v1/org/holidays` — add a holiday (`name` + `date` required). Needs `settings:manage`. */
export function createHoliday(body: {
  name: string;
  date: string;
}): Promise<OrgHoliday> {
  return apiFetch<OrgHoliday>("/v1/org/holidays", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `PATCH /v1/org/holidays/{id}`. Needs `settings:manage`. */
export function updateHoliday(
  id: string,
  body: HolidayInput,
): Promise<OrgHoliday> {
  return apiFetch<OrgHoliday>(`/v1/org/holidays/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** `DELETE /v1/org/holidays/{id}`. Needs `settings:manage`. */
export async function deleteHoliday(id: string): Promise<void> {
  await apiFetch(`/v1/org/holidays/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── Policies (collection) — `/v1/org/policies` ────────────────────────────────────────────────────

export interface OrgPolicy {
  id: string;
  title: string;
  body?: string;
  url?: string;
}

export interface PolicyInput {
  title?: string;
  body?: string;
  url?: string;
}

/** `GET /v1/org/policies` → the org's policy documents. */
export function listPolicies(): Promise<OrgPolicy[]> {
  return apiFetch<{ policies: OrgPolicy[] }>("/v1/org/policies").then(
    (r) => r.policies,
  );
}

/** `POST /v1/org/policies` — add a policy (`title` required). Needs `settings:manage`. */
export function createPolicy(
  body: PolicyInput & { title: string },
): Promise<OrgPolicy> {
  return apiFetch<OrgPolicy>("/v1/org/policies", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `PATCH /v1/org/policies/{id}`. Needs `settings:manage`. */
export function updatePolicy(
  id: string,
  body: PolicyInput,
): Promise<OrgPolicy> {
  return apiFetch<OrgPolicy>(`/v1/org/policies/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** `DELETE /v1/org/policies/{id}`. Needs `settings:manage`. */
export async function deletePolicy(id: string): Promise<void> {
  await apiFetch(`/v1/org/policies/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/**
 * Organization meta + lifecycle — the real backend (`identity` context, LLD §14).
 *
 * These are the owner/admin-authed org routes:
 *   - `GET /v1/org` reads the org's current meta; `PATCH /v1/org` edits the meta fields (name,
 *     timezone, website, emp_id_prefix, industry, size) under an optimistic lock (`version`).
 *     *(This header once claimed "there is deliberately no GET /v1/org" — the read landed; the
 *     stale claim survived it. Trust the exported functions below over prose.)*
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
  /** How the org tracks work — `"project"` (default) | `"machine"` | `"both"` (MANAGED-AGENT.md §4). */
  tracking_mode?: string;
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
  /** Change the tracking mode (owner-only server-side; `version` becomes **required** when set). */
  tracking_mode?: string;
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

/** One downloadable export artifact — `url` is a time-limited presigned S3 GET (~15 min). */
export interface ExportFile {
  name: string;
  url: string;
}

/** `GET /v1/org/exports/{job_id}` (owner-only) — poll the job; `files` fills in once `done`. */
export interface ExportStatusResult {
  job_id: string;
  /** `accepted` | `running` | `done` | `failed`. */
  status: string;
  requested_at?: number;
  completed_at?: number;
  files: ExportFile[];
}

export function getExportStatus(jobId: string): Promise<ExportStatusResult> {
  return apiFetch<ExportStatusResult>(`/v1/org/exports/${encodeURIComponent(jobId)}`);
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
export function updateLocation(id: string, body: LocationInput): Promise<OrgLocation> {
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

// ── Working hours (singleton) — `GET`/`PATCH /v1/org/working-hours` ───────────────────────────────
// The org's schedule: which ISO weekdays are scheduled, the day's bounds, the lateness threshold and
// the minimum minutes that separate `partial` from `present`. One row per org, so one GET + one
// PATCH, no id. The server fills every absent field with the product default, so a GET always
// returns the *effective* schedule the attendance close cron will apply.
//
// **A designated day off is "not expected", not "not recorded".** Work on an off day is still
// tracked and still counts — the schedule only decides who is *absent*.

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface OrgWorkingHours {
  /** `HH:MM`, 24-hour. */
  work_start: string;
  /** `HH:MM`, 24-hour. */
  work_end: string;
  /** Scheduled weekdays, sorted. Defaults to Mon–Fri (`[1,2,3,4,5]`). Never empty. */
  workdays: IsoWeekday[];
  /** `HH:MM` — a first session after this qualifies `present` as **late**. */
  late_threshold: string;
  /** Below this, a worked day is `partial` rather than `present`. */
  min_present_minutes: number;
  /**
   * Unpaid break inside the declared span, in minutes (default 60).
   *
   * Feeds the productivity score's **expected working day**
   * (`backend/docs/PRODUCTIVITY.md` §1.2): `expected = (work_end − work_start) − break_minutes`.
   * The default 09:00–18:00 minus 60 is 8h — the constant the scorer used before it read this
   * setting, so introducing it moved no existing score.
   */
  break_minutes: number;
}

/** A PATCH may carry any subset; the server rejects an empty body. */
export type WorkingHoursInput = Partial<OrgWorkingHours>;

/** `GET /v1/org/working-hours` — the effective schedule. Any member may read it. */
export function getWorkingHours(): Promise<OrgWorkingHours> {
  return apiFetch<OrgWorkingHours>("/v1/org/working-hours");
}

/**
 * `PATCH /v1/org/working-hours` — update the schedule. Needs `settings:manage`
 * (server `OrgSettingsManage`). An empty `workdays` list is a `400`.
 */
export function updateWorkingHours(body: WorkingHoursInput): Promise<OrgWorkingHours> {
  return apiFetch<OrgWorkingHours>("/v1/org/working-hours", {
    method: "PATCH",
    body: JSON.stringify(body),
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
  return apiFetch<{ holidays: OrgHoliday[] }>("/v1/org/holidays").then((r) => r.holidays);
}

/** `POST /v1/org/holidays` — add a holiday (`name` + `date` required). Needs `settings:manage`. */
export function createHoliday(body: { name: string; date: string }): Promise<OrgHoliday> {
  return apiFetch<OrgHoliday>("/v1/org/holidays", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `PATCH /v1/org/holidays/{id}`. Needs `settings:manage`. */
export function updateHoliday(id: string, body: HolidayInput): Promise<OrgHoliday> {
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
  return apiFetch<{ policies: OrgPolicy[] }>("/v1/org/policies").then((r) => r.policies);
}

/** `POST /v1/org/policies` — add a policy (`title` required). Needs `settings:manage`. */
export function createPolicy(body: PolicyInput & { title: string }): Promise<OrgPolicy> {
  return apiFetch<OrgPolicy>("/v1/org/policies", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `PATCH /v1/org/policies/{id}`. Needs `settings:manage`. */
export function updatePolicy(id: string, body: PolicyInput): Promise<OrgPolicy> {
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

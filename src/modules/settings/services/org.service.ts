/**
 * Organization meta + lifecycle — the real backend (`identity` context, LLD §14).
 *
 * These are the owner/admin-authed org routes:
 *   - `GET /v1/org` reads the org's current meta; `PATCH /v1/org` edits the meta fields (name,
 *     timezone, website, emp_id_prefix, industry, size) under an optimistic lock (`version`).
 *     *(This header once claimed "there is deliberately no GET /v1/org" — the read landed; the
 *     stale claim survived it. Trust the exported functions below over prose.)*
 *   - The lifecycle routes (`close`, `reopen`, `export`) are **owner-only** (403 otherwise). Only
 *     `close` checks a re-typed workspace **slug** (`confirm`) server-side; `reopen` takes no body,
 *     and `export` is sent one but doesn't read it (the page checks it before calling).
 */
import { apiFetch } from "@/lib/api";
import { singleFlight } from "@/lib/single-flight";

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
  /** ISO 4217 code chosen at signup (e.g. "INR") — what payroll amounts are shown in. */
  currency?: string;
  /** How the org tracks work — `"project"` (default) | `"machine"` | `"both"` (MANAGED-AGENT.md §4). */
  tracking_mode?: string;
  version: number;
  /** Epoch **seconds** after which a `closing` org is purged. Present only while closing. */
  purge_after?: number;
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
export const getOrg: () => Promise<OrgView> = singleFlight(() =>
  // Concurrent callers share one request (five surfaces read it — WP-369); never cached past it.
  apiFetch<OrgView>("/v1/org"),
);

/* ------------------------------- org owners ------------------------------- */

/**
 * One owner, mirroring `identity::features::org_owners::dto::Owner`.
 *
 * **An org can have several owners** (LLD §16). Ownership is `role-owner` on the user row, which the
 * pre-token trigger turns into the `is_owner` claim that bypasses every privilege bit — so these
 * routes are gated on `is_owner` itself rather than a permission, and a non-owner gets a 403.
 */
export interface OrgOwner {
  user_id: string;
  name: string;
  email: string;
  /** True for the signed-in caller — used to label "you" and to warn before self-demotion. */
  is_you: boolean;
}

export interface OrgOwnersResponse {
  owners: OrgOwner[];
  /**
   * `owners.length`, sent explicitly so the UI can disable "remove" at one owner **before** the
   * request rather than surfacing the server's `last_owner` conflict as a failure. An org that
   * reaches zero owners cannot appoint one — only an owner may — so it is unrecoverable from inside
   * the product, which is why the guard exists on both sides.
   */
  count: number;
}

/** `GET /v1/org/owners` (owner-only). */
export function listOwners(): Promise<OrgOwnersResponse> {
  return apiFetch<OrgOwnersResponse>("/v1/org/owners");
}

/** `POST /v1/org/owners` (owner-only) — idempotent; re-granting an existing owner is a no-op. */
export function grantOwner(userId: string): Promise<OrgOwnersResponse> {
  return apiFetch<OrgOwnersResponse>("/v1/org/owners", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

/**
 * `DELETE /v1/org/owners/{id}` (owner-only) — hands the person an ordinary role and leaves them in
 * the org. `take_role` is **required**: dropping someone to no role leaves a member with a valid
 * login whose bitset cannot be resolved, and no screen explains why they can do nothing.
 *
 * Rejects the last owner with a `last_owner` conflict.
 */
export function revokeOwner(
  userId: string,
  takeRole: string,
): Promise<OrgOwnersResponse> {
  return apiFetch<OrgOwnersResponse>(`/v1/org/owners/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    body: JSON.stringify({ take_role: takeRole }),
  });
}

// `POST /v1/org/transfer-ownership` has no client: ownership is handed over by adding an owner
// (`grantOwner`) and the old one stepping down. Its unused wrapper was deleted 2026-10-09 — its doc
// said omitting `take_role` kept the departing owner as an Admin, when the server deactivates them
// (`ownership::transfer`, QA audit 2026-10-08, WP-536).

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

/**
 * `POST /v1/org/reopen` (owner-only) — reverses a close before the purge deadline. Takes **no body**:
 * unlike close, the handler asks for no slug confirmation (undoing a close is not the dangerous
 * direction), so none is sent.
 */
export interface ReopenOrgResult {
  status: string;
}

export function reopenOrg(): Promise<ReopenOrgResult> {
  return apiFetch<ReopenOrgResult>("/v1/org/reopen", { method: "POST" });
}

/**
 * `POST /v1/org/export` (owner-only) — enqueues an async export job. The typed slug goes as
 * `confirm` and the server checks it, as it does for close (a wrong slug 400s — WP-530).
 */
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

/**
 * `GET /v1/org/exports/{job_id}` (owner-only) — poll the job; `files` fills in once `done`, **one
 * page at a time** (follow `next_cursor`, or use {@link getExportStatusAll}).
 */
export interface ExportStatusResult {
  job_id: string;
  /** `accepted` | `running` | `done` | `failed`. */
  status: string;
  requested_at?: number;
  completed_at?: number;
  files: ExportFile[];
  /** The walk's phase while it runs: `org`, then `users`. */
  phase?: string;
  /** Steps finished so far. */
  steps?: number;
  /** Files written so far, across every page. */
  files_total?: number;
  /** When the job last moved (epoch ms) — a slow export keeps moving, a stuck one doesn't. */
  updated_at?: number;
  /** Why a `failed` job stopped, in words for the owner. */
  error?: string;
  /** More files follow: pass back as `cursor` for the next page. */
  next_cursor?: string;
}

/** One export job in `GET /v1/org/exports` (owner-only), newest first. */
export interface ExportSummary {
  job_id: string;
  status: string;
  requested_at?: number;
  completed_at?: number;
}

/**
 * `GET /v1/org/exports` — the org's export jobs, newest first. Lets a browser that never started (or
 * has forgotten) an export find a running one (WP-349). Absent on servers that predate it (404).
 */
export async function listExports(): Promise<ExportSummary[]> {
  const res = await apiFetch<{ exports: ExportSummary[] }>("/v1/org/exports");
  return res.exports;
}

export function getExportStatus(
  jobId: string,
  cursor?: string,
): Promise<ExportStatusResult> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return apiFetch<ExportStatusResult>(`/v1/org/exports/${encodeURIComponent(jobId)}${q}`);
}

/** Upper bound on file-list pages read for one export (each page is up to ~1,000 files). */
export const MAX_EXPORT_PAGES = 500;

/**
 * {@link getExportStatus}, with every page of a finished export's file list gathered into `files`.
 * The server pages the list because an export with every screenshot is far too many presigned links
 * for one response (QA audit 2026-10-08, WP-350). `next_cursor` is still set on the result only if
 * {@link MAX_EXPORT_PAGES} ran out first.
 */
export async function getExportStatusAll(jobId: string): Promise<ExportStatusResult> {
  const first = await getExportStatus(jobId);
  if (first.status !== "done" || !first.next_cursor) return first;
  const files = [...first.files];
  let cursor: string | undefined = first.next_cursor;
  for (let page = 1; cursor && page < MAX_EXPORT_PAGES; page++) {
    const next = await getExportStatus(jobId, cursor);
    files.push(...next.files);
    cursor = next.next_cursor;
  }
  return { ...first, files, next_cursor: cursor };
}

// (`GET`/`PATCH /v1/org/branding` exist server-side but nothing in the app reads branding, so their
// wrappers went with the unrendered branding form — QA audit 2026-10-08, WP-536.)

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

// ── App/URL classification rules (org + per-department) ────────────────────────────────────────────
// The rules document is opaque server-side and version-conditioned (optimistic lock). Both the org
// editor and the per-department override editor read/write the same envelope shape through these
// helpers — the `use-org-rules` hook (`useRulesDoc`) consumes them, keeping the editor off `apiFetch`.
//
// A department's rules **override** the org rules for its members; where a department has no rule,
// the org rules (`/v1/org/rules`) apply as the fallback.

/** `{ rules, version }` — `rules` is the opaque doc, `version` drives the optimistic lock on PUT. */
export interface RulesEnvelope {
  rules: unknown;
  version: number;
}

/** Org-level rules path. */
export const ORG_RULES_PATH = "/v1/org/rules";

/** Per-department rules path (the dept-scoped twin of {@link ORG_RULES_PATH}). */
export function deptRulesPath(deptId: string): string {
  return `/v1/org/departments/${encodeURIComponent(deptId)}/rules`;
}

/**
 * `GET <path>` for a rules document (org or department). Needs `monitoring:manage` (server
 * `MonitoringManage`) — the read is gated exactly like the write.
 */
export function getRulesEnvelope(path: string): Promise<RulesEnvelope> {
  return apiFetch<RulesEnvelope>(path);
}

/**
 * `PUT <path>` for a rules document (org or department). Version-conditioned: a stale `version`
 * 409s. Needs `monitoring:manage` (server `MonitoringManage`).
 */
export function putRulesEnvelope(
  path: string,
  rules: unknown,
  version: number,
): Promise<RulesEnvelope> {
  return apiFetch<RulesEnvelope>(path, {
    method: "PUT",
    body: JSON.stringify({ rules, version }),
  });
}

/** `GET /v1/org/departments/{id}/rules`. */
export function getDeptRules(deptId: string): Promise<RulesEnvelope> {
  return getRulesEnvelope(deptRulesPath(deptId));
}

/** `PUT /v1/org/departments/{id}/rules`. Needs `monitoring:manage`. */
export function updateDeptRules(
  deptId: string,
  rules: unknown,
  version: number,
): Promise<RulesEnvelope> {
  return putRulesEnvelope(deptRulesPath(deptId), rules, version);
}

/**
 * Insights — the `insights` context read routes (LLD §10/§12/§14). These are the live monitoring
 * read-models the desktop-agent pipeline feeds: an agent batch folds an `ActivityDay`, the
 * Streams-fed scorer writes a `DailySummary` (deterministic U/Q/F/R score) + anomaly flags, and
 * these routes serve them. **Score/activity/screenshot data is empty until agents report**; the
 * daily summary (attendance + timesheet) is real regardless.
 *
 * Every type here mirrors the Rust DTOs in `crates/insights`; the server's shape wins (frontend
 * CLAUDE.md pattern 3). Envelope unwrapping + auth token attach happen in `apiFetch`.
 */
import { apiFetch } from "@/lib/api";

// ── deterministic productivity score (HLD §12) ──

/** Mirrors `insights::…::ScoreBreakdown`. */
export interface ScoreBreakdown {
  /** 0–100 = 0.25·U + 0.40·Q + 0.15·F + 0.20·R. */
  score: number;
  /** Utilization (active vs expected day). */
  u: number;
  /** Quality (category-weighted: productive 1.0 / neutral 0.5 / distracting 0.0). */
  q: number;
  /** Focus (input-gated engagement). */
  f: number;
  /** Reliability (punctuality + hours). */
  r: number;
}

// ── GET /v1/me/insights/summary?date= ──

export interface DailySummaryMetrics {
  /** `present` | `partial` | `absent` | `leave` | `non_workday`. */
  attendance: string;
  late: boolean;
  worked_minutes: number;
  tracked_secs: number;
  billable_secs: number;
  entry_count: number;
  task_count: number;
}

export interface DailySummary {
  date: string;
  metrics: DailySummaryMetrics;
  /** The stored productivity score for the day, present only when the agent reported activity. */
  score?: ScoreBreakdown;
  /** AI recap — generated once per day and cached server-side; use {@link regenerateDailySummary}. */
  narrative: string;
  /** Epoch **ms** the cached narrative was generated. Absent only transiently (couldn't be stored). */
  generated_at?: number;
}

/**
 * `date` is `YYYY-MM-DD` in the caller's local calendar. The narrative is generated once (on the
 * first call for the day) and cached — subsequent calls return the same text until regenerated.
 */
export function getDailySummary(date: string): Promise<DailySummary> {
  return apiFetch<DailySummary>(`/v1/me/insights/summary?date=${encodeURIComponent(date)}`);
}

/** `POST /v1/me/insights/summary/regenerate` — force a fresh AI narrative for the day and re-cache it. */
export function regenerateDailySummary(date: string): Promise<DailySummary> {
  return apiFetch<DailySummary>(
    `/v1/me/insights/summary/regenerate?date=${encodeURIComponent(date)}`,
    { method: "POST" },
  );
}

// ── GET /v1/me/insights/locations?date=  (the caller's own device-location trail for a day) ──

/**
 * One device location fix, mirroring `insights::locations::LocationPoint`. Written by the ingest
 * fold from each consent-gated heartbeat the desktop agent sends (WinRT / OS positioning), so this
 * is **empty until the agent reports location**. `accuracy_m` is the OS's own estimate — coarse on a
 * GPS-less desktop (WiFi/IP positioning), so the map draws a radius rather than a pinpoint.
 */
export interface LocationPoint {
  lat: number;
  lon: number;
  accuracy_m: number;
  /** Epoch ms the fix was taken. */
  captured_at: number;
}

export interface MyLocations {
  date: string;
  /** Chronological (the server keys points `LOC#<date>#<captured_at>`). */
  points: LocationPoint[];
}

/** `date` is `YYYY-MM-DD` in the caller's local calendar (the server is UTC and cannot guess it). */
export function getMyLocations(date: string): Promise<MyLocations> {
  return apiFetch<MyLocations>(`/v1/me/insights/locations?date=${encodeURIComponent(date)}`);
}

// ── GET /v1/me/insights/activity?from=&to=  (personal daily scores + trend) ──

export interface ActivityTotals {
  active_sec: number;
  engaged_sec: number;
  productive_sec: number;
  neutral_sec: number;
  distracting_sec: number;
  worked_minutes: number;
  attendance: string;
}

/** A single day: `ScoreBreakdown` + `ActivityTotals` are flattened onto the row by the server. */
export type DayScore = ScoreBreakdown & ActivityTotals & { date: string };

export interface SelfActivity {
  from: string;
  to: string;
  days: DayScore[];
  trend: {
    days_scored: number;
    avg_score: number | null;
    best: { date: string; score: number } | null;
    worst: { date: string; score: number } | null;
    baseline: number | null;
  };
}

export function getSelfActivity(from: string, to: string): Promise<SelfActivity> {
  return apiFetch<SelfActivity>(
    `/v1/me/insights/activity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
}

// ── GET /v1/insights/user/{id}/activity?from=&to=  (a specific employee's daily scores + trend) ──

/**
 * The admin/manager view of one employee's activity, mirroring {@link getSelfActivity} but for
 * another user (org oversight, gated on `activity:read`). Same `SelfActivity` shape. **Empty
 * `days` / `days_scored: 0` is the honest state** until that person's desktop agent reports — never
 * a fabricated score.
 */
export function getUserActivity(
  userId: string,
  from: string,
  to: string,
): Promise<SelfActivity> {
  return apiFetch<SelfActivity>(
    `/v1/insights/user/${encodeURIComponent(userId)}/activity?from=${encodeURIComponent(
      from,
    )}&to=${encodeURIComponent(to)}`,
  );
}

// ── GET /v1/insights/activity?date=  (org day rollup) ──

export interface PersonScore {
  user_id: string;
  name: string;
  department_id: string;
  /** Absent when the person has no summary that day (agent not reporting) — a gap, never a zero. */
  breakdown?: ScoreBreakdown;
  totals?: ActivityTotals;
}

export interface OrgActivity {
  date: string;
  people: PersonScore[];
  rollup: {
    total_people: number;
    scored_people: number;
    avg_score: number | null;
    active_sec_total: number;
    productive_sec_total: number;
    neutral_sec_total: number;
    distracting_sec_total: number;
  };
}

export function getOrgActivity(date: string): Promise<OrgActivity> {
  return apiFetch<OrgActivity>(`/v1/insights/activity?date=${encodeURIComponent(date)}`);
}

// ── GET /v1/insights/screenshots?date=&user_id=&cursor=&limit=  (GSI4 grid, pii-gated) ──

export interface ShotRow {
  shot_id: string;
  user_id: string;
  captured_at: number;
  app: string;
  blur_level: number;
  phash: string;
  /** Presigned S3 read URL; empty when pii_gate withheld it (`redacted`). */
  url: string;
  redacted?: boolean;
  /** Server-classified category of the captured app: `productive | neutral | distracting`. */
  category: string;
  /** `true` when the capture is worth reviewing (a distracting-app capture) — drives flag/filter. */
  flagged: boolean;
  /**
   * Which physical monitor this frame came from — **0-based, primary = 0**. A multi-monitor machine
   * emits one row per display in the same batch, all sharing `captured_at`; that is what lets the
   * grid group them into one capture and label them "Monitor 1 of 2".
   *
   * Optional on the wire: single-display machines and pre-field batches legitimately have none, and
   * the field is newer than some deployed clients — treat absent as `0`, never as "unknown monitor".
   */
  display?: number;
  /** Machine hostname behind the capture (resolved from the agent). Empty when unknown. */
  device?: string;
}

export interface ScreenshotGrid {
  date: string;
  shots: ShotRow[];
  cursor?: string;
}

export function getScreenshots(
  date: string,
  opts: { userId?: string; cursor?: string; limit?: number } = {},
): Promise<ScreenshotGrid> {
  const q = new URLSearchParams({ date });
  if (opts.userId) q.set("user_id", opts.userId);
  if (opts.cursor) q.set("cursor", opts.cursor);
  if (opts.limit) q.set("limit", String(opts.limit));
  return apiFetch<ScreenshotGrid>(`/v1/insights/screenshots?${q.toString()}`);
}

// ── GET /v1/insights/attention?date=  (AI reduce: people who need attention) ──

export interface AttentionRow {
  user_id: string;
  name: string;
  score: number;
  anomaly_count: number;
  /** `high` | `medium` | `low`, or empty when no anomaly fired. */
  top_severity: string;
  /** Anomaly types firing, e.g. `["overtime","idle"]`. */
  reasons: string[];
  /** Deterministic attention weight (higher = more attention). */
  attention: number;
}

export interface AttentionList {
  date: string;
  people: AttentionRow[];
  /** AI narrative over the ranked list (factual fallback when no LLM key). */
  narrative: string;
}

export function getAttention(date: string): Promise<AttentionList> {
  return apiFetch<AttentionList>(`/v1/insights/attention?date=${encodeURIComponent(date)}`);
}

// ── GET /v1/insights/reports  +  /v1/insights/reports/ai?date= ──

export interface ReportType {
  key: string;
  title: string;
  description: string;
  route: string;
  requires_entitlement?: string;
  available: boolean;
}

export function getReportsCatalog(): Promise<{ reports: ReportType[] }> {
  return apiFetch<{ reports: ReportType[] }>("/v1/insights/reports");
}

export interface NamedScore {
  name: string;
  score: number;
}

export interface AiReport {
  date: string;
  metrics: {
    total_people: number;
    scored_people: number;
    avg_score: number | null;
    active_hours_total: number;
    productive_hours_total: number;
    top_performers: NamedScore[];
    needs_attention: NamedScore[];
  };
  narrative: string;
  generated_at: number;
}

/** Enterprise-gated (`insights.reports.ai_pdf`); throws `ApiError` 403 if the org lacks it. */
export function getAiReport(date: string): Promise<AiReport> {
  return apiFetch<AiReport>(`/v1/insights/reports/ai?date=${encodeURIComponent(date)}`);
}

// ── GET /v1/insights/locations?date=  (org-wide oversight — the admin Locations board) ──

/**
 * One employee's latest known position for the day, mirroring
 * `insights::oversight_locations::PersonLocation`. `latest` is `null` for anyone whose agent
 * reported no fix that day — an honest gap the board renders as "no location", never a fabricated
 * pin. Coordinates are the backend's `{ lat, lon }`; the map wants `lng`, so callers convert.
 */
export interface OversightPersonLocation {
  user_id: string;
  name: string;
  department_id: string;
  latest: LocationPoint | null;
  fix_count: number;
}

export interface OversightLocations {
  date: string;
  people: OversightPersonLocation[];
}

/**
 * Gated on `activity:read` (org oversight). `date` is `YYYY-MM-DD` in the caller's local calendar.
 * Empty `people` (or all-`null` `latest`) is the honest state until the desktop agent reports
 * location for the org — the same "waiting on the agent" stance as every other monitoring surface.
 */
export function getOversightLocations(date: string): Promise<OversightLocations> {
  return apiFetch<OversightLocations>(
    `/v1/insights/locations?date=${encodeURIComponent(date)}`,
  );
}

// ── GET/PUT /v1/org/geofence  (the org's office perimeter) ──

/**
 * The org-wide "office perimeter", mirroring `insights::geofence::GeofenceResponse`.
 *
 * Coordinates are the backend's `{ lat, lon }`. The map component wants `{ lat, lng }`, so the
 * store converts at this boundary rather than leaking two conventions into the components — the
 * same rule `OversightPersonLocation` already follows.
 *
 * `version` is an optimistic lock, not decoration: two admins dragging the perimeter on the same map
 * is the race it exists for. Send back the `version` you last read; a stale one is a `409`.
 */
export interface GeofenceConfig {
  enabled: boolean;
  center: { lat: number; lon: number };
  radius_m: number;
  version: number;
}

/** Gated on `activity:read:team` — the same bit the Locations board itself requires. */
export function getGeofence(): Promise<GeofenceConfig> {
  return apiFetch<GeofenceConfig>("/v1/org/geofence");
}

/** Gated on `monitoring:manage`. Throws `ApiError` 409 (`version_conflict`) if `version` is stale. */
export function updateGeofence(
  body: Omit<GeofenceConfig, "version"> & { version: number },
): Promise<GeofenceConfig> {
  return apiFetch<GeofenceConfig>("/v1/org/geofence", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ── GET /v1/insights/locations/{user_id}?date=  (one employee's full trail) ──

/**
 * One employee's complete location trail for a day, mirroring
 * `insights::oversight_location_trail::TrailResponse`.
 *
 * Distinct from `getOversightLocations`, which serves only each person's **latest** fix for the
 * whole roster. This is the admin detail view: every fix for one person, chronological, so the page
 * can answer "where was this employee at 14:30".
 *
 * Reach-scoped server-side — a department-scoped manager requesting someone outside their department
 * gets a 403, not an empty trail. Empty `points` is a legitimate answer (the agent reported nothing
 * that day), never a 404.
 */
export interface LocationTrail {
  date: string;
  user_id: string;
  name: string;
  department_id: string;
  points: LocationPoint[];
}

export function getLocationTrail(
  userId: string,
  date: string,
): Promise<LocationTrail> {
  return apiFetch<LocationTrail>(
    `/v1/insights/locations/${encodeURIComponent(userId)}?date=${encodeURIComponent(date)}`,
  );
}

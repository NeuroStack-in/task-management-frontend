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
  /** Quality (category-weighted, using the org's weights). **Only meaningful if `q_measured`.** */
  q: number;
  /** Focus (input-gated engagement). */
  f: number;
  /** Reliability (punctuality + hours). */
  r: number;
  /**
   * `false` when nothing was classified that day, so Q was excluded and the remaining weights
   * renormalised (`backend/docs/PRODUCTIVITY.md` §1.4).
   *
   * The server reports `q: 0` in that case, which on the wire is indistinguishable from a day spent
   * entirely on distracting apps — so **rendering `q` without checking this shows "Quality 0" for
   * what was really an instrumentation gap.** Absent (older payloads) means measured.
   */
  q_measured?: boolean;
  /**
   * `true` when Q was derived from the **AI per-screenshot scores**; `false` when it fell back to
   * the **rule-based app-classification share** because no frame was AI-scored that day. This is the
   * "AI-graded vs estimated" signal — mark the score **estimated** when this is `false` (and
   * `q_measured` is not false). Absent (older payloads) ⇒ treat as not AI-scored.
   */
  q_ai_scored?: boolean;
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

/**
 * **The per-person scoring window — 30 days, everywhere** (`backend/docs/PRODUCTIVITY.md` §3.1).
 *
 * One window, one meaning. It lives here, exported, because the moment two surfaces pick their own
 * the same person reads differently on each: the profile once averaged 12 months while the
 * directory averaged 7 days, so the same employee showed two scores at the same instant — same
 * method, different window, which is the most confusing possible combination.
 *
 * A person's score is the mean of their **scored** days in this window; days with no summary are
 * excluded, never counted as zero (they may have been on leave, or their agent may have been off).
 */
export const SCORE_WINDOW_DAYS = 30;

/** One app the agents have reported that no classification rule matches. */
export interface UnclassifiedApp {
  app: string;
  total_sec: number;
  first_seen: number;
  last_seen: number;
  /**
   * The model's proposal — `productive | neutral | distracting` — present only when suggestions
   * were requested and the call succeeded. **A proposal, never applied:** it becomes real only when
   * an admin approves it, which writes a normal rule through `PATCH /v1/org/rules`.
   */
  suggested_category?: RuleCategoryName;
  suggested_reason?: string;
}

export type RuleCategoryName = "productive" | "neutral" | "distracting";

export interface UnclassifiedAppsResponse {
  apps: UnclassifiedApp[];
  /** Everything in the catalogue, classified or not — the denominator for "12 of 63". */
  total_seen: number;
  /** The org has no rules at all, so "unclassified" means *everything* — a different problem. */
  no_rules_configured: boolean;
}

/**
 * `GET /v1/insights/apps/unclassified` — apps seen but not covered by any rule, worst offender
 * first. Needs `monitoring:manage` (server `MonitoringManage`), the same permission as the rules
 * editor, because acting on the list means writing a rule.
 *
 * `suggest` asks the model for a category per app. It is off by default because it is the only
 * paid, slow part of the call, and the worklist is useful without it.
 */
export function getUnclassifiedApps(
  suggest = false,
): Promise<UnclassifiedAppsResponse> {
  return apiFetch<UnclassifiedAppsResponse>(
    `/v1/insights/apps/unclassified${suggest ? "?suggest=true" : ""}`,
  );
}

/** One app or website, with the time it accounted for across the requested range. */
export interface UsageRow {
  /** The app as the agent reported it (`Code.exe`), or the site's host (`youtube.com`). */
  name: string;
  seconds: number;
  category: RuleCategoryName;
}

export interface AppUsageResponse {
  from: string;
  to: string;
  /** Ranked longest-first. */
  apps: UsageRow[];
  /**
   * Ranked longest-first. Empty when no agent reported a browser URL in the range — a genuine
   * data gap (`AppSpan.url` is optional on the wire), not a missing wire.
   */
  sites: UsageRow[];
  /** The read hit its ceiling, so these are the top of a longer list. Say so rather than imply completeness. */
  truncated: boolean;
}

/**
 * `GET /v1/insights/apps/usage` — what the org actually used between two dates, ranked by time.
 * Needs `activity:read:org` (server `ActivityReadOrg`), matching the page's other org-wide reads.
 *
 * **Not the same as {@link getUnclassifiedApps}.** That reads the all-time app catalogue, which has
 * no date dimension and therefore cannot answer "in the period I selected" — which is why the
 * Analytics page's Top applications / Top websites panels sat hardcoded to an empty list behind an
 * empty state blaming the desktop agent. The agent was reporting all of it; the fold discarded the
 * names. This reads the per-day rows that fold now writes.
 *
 * `from`/`to` are inclusive and may be the same day. Ranges wider than ~2 months are refused
 * server-side, since cost scales with days × distinct apps.
 */
export function getAppUsage(from: string, to: string): Promise<AppUsageResponse> {
  const q = new URLSearchParams({ from, to });
  return apiFetch<AppUsageResponse>(`/v1/insights/apps/usage?${q.toString()}`);
}

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

// ── GET /v1/insights/user/{id}/apps?from=&to=  (one employee's apps + sites) ──

/** One app or site, with the time measured against it and how the org classifies it. */
export interface AppUsageRow {
  name: string;
  seconds: number;
  /** `productive` | `neutral` | `distracting` — the org's own rule, not a judgement made here. */
  category: string;
}

export interface AppUsage {
  from: string;
  to: string;
  apps: AppUsageRow[];
  sites: AppUsageRow[];
  /** The read hit its row cap, so the ranking is a top-N rather than the whole period. */
  truncated: boolean;
}

/**
 * One employee's measured app and website time over a range (org oversight, `activity:read`).
 *
 * **Empty is ambiguous and the caller must say which kind.** Per-person rows only exist from
 * 2026-08-27 — before that the ingest fold kept category totals and discarded app names, so an
 * empty list for an earlier range means "not recorded", not "used nothing". Rendering a bare
 * "No activity" over a pre-rollout range states something false about a person.
 */
export function getUserAppUsage(
  userId: string,
  from: string,
  to: string,
): Promise<AppUsage> {
  return apiFetch<AppUsage>(
    `/v1/insights/user/${encodeURIComponent(userId)}/apps?from=${encodeURIComponent(
      from,
    )}&to=${encodeURIComponent(to)}`,
  );
}

/** The caller's own, same shape. Self-scoped. */
export function getMyAppUsage(from: string, to: string): Promise<AppUsage> {
  return apiFetch<AppUsage>(
    `/v1/me/insights/apps?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
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
  /**
   * `true` when the capture is worth reviewing.
   *
   * **Check {@link ShotRow.reviewed} before calling this a verdict.** When the vision model has
   * analysed the frame this is its judgement; when it hasn't — the common case, since analysis is
   * on-demand — it falls back to "the app was classified distracting", which is a guess about the
   * app and not about what is on screen.
   */
  flagged: boolean;
  /**
   * `true` when the vision model has actually analysed this frame.
   *
   * Rendering `flagged` without this is what made a capture badged "Needs review" open to the model
   * saying it was clear: the badge was the app-name fallback, and the frame had never been analysed.
   */
  reviewed?: boolean;
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

// ── Per-screenshot AI report (vision_map) ───────────────────────────────────────────────────────
// The Stage-1 vision model's read of one frame. Mirrors `insights::vision_map::dto::ShotReport`.

export interface ScreenshotReport {
  shot_id: string;
  user_id: string;
  date: string;
  /** The model's category — `productive | neutral | distracting` (its read, not the app-name guess). */
  category: string;
  work_related: boolean;
  /** One factual sentence about what is visible in the frame. */
  description: string;
  flag: boolean;
  flag_reason: string;
  /** Model confidence, 0..1. */
  confidence: number;
  model: string;
  /** Epoch **ms** the report was generated. */
  generated_at: number;
}

/**
 * `GET /v1/insights/screenshots/{id}/report` — the vision model's report for one frame. Needs
 * `screenshots:view`. **A 404 (`ApiError.status === 404`) means the frame hasn't been analyzed yet**
 * — the vision map runs per day (not on capture), so treat 404 as "not analyzed", never an error.
 */
export function getScreenshotReport(
  shotId: string,
  date: string,
  userId?: string,
): Promise<ScreenshotReport> {
  const q = new URLSearchParams({ date });
  if (userId) q.set("user_id", userId);
  return apiFetch<ScreenshotReport>(
    `/v1/insights/screenshots/${encodeURIComponent(shotId)}/report?${q.toString()}`,
  );
}

/** Mirrors `vision_map::dto::RunResponse` — the counts from a day's analysis run. */
export interface ScreenshotReportRun {
  ran: boolean;
  reason?: string;
  scanned: number;
  already_reported: number;
  generated: number;
  flagged: number;
}

/**
 * `POST /v1/insights/screenshots/reports` — run the vision map (the request-path stand-in for the
 * nightly cron). Needs **`monitoring:manage`** (server-enforced), and spends the org's AI budget, so
 * it's a manager action. Idempotent + generate-once — re-running only analyzes frames that don't yet
 * have a report.
 *
 * **Pass `shotId` for a single frame.** Omitting it runs the whole day, which is the cron's shape,
 * not a person's: a day is dozens of model calls and overruns the insights Lambda's 28s ceiling.
 */
export function runScreenshotReports(
  date: string,
  userId?: string,
  shotId?: string,
): Promise<ScreenshotReportRun> {
  const q = new URLSearchParams({ date });
  if (userId) q.set("user_id", userId);
  if (shotId) q.set("shot_id", shotId);
  return apiFetch<ScreenshotReportRun>(`/v1/insights/screenshots/reports?${q.toString()}`, {
    method: "POST",
  });
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

/** `POST /v1/insights/attention/regenerate?date=` — re-run the brief over the current ranking. */
export function regenerateAttention(date: string): Promise<AttentionList> {
  return apiFetch<AttentionList>(
    `/v1/insights/attention/regenerate?date=${encodeURIComponent(date)}`,
    { method: "POST" },
  );
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

/** `POST /v1/insights/reports/ai/regenerate?date=` — re-run the model for the day, re-cache. */
export function regenerateAiReport(date: string): Promise<AiReport> {
  return apiFetch<AiReport>(
    `/v1/insights/reports/ai/regenerate?date=${encodeURIComponent(date)}`,
    { method: "POST" },
  );
}

/**
 * The org weekly/monthly AI reports (`org_weekly_report` / `org_monthly_report`) — the same
 * artifact one resolution up, same gates. Only the fields the AI card renders are typed here;
 * `reason` is set (with an empty `narrative`) when there is nothing to reduce yet — an honest
 * "no data" the caller must show instead of prose.
 */
export interface AiPeriodReport {
  narrative: string;
  reason?: string | null;
  generated_at?: number | null;
}

/** `GET /v1/insights/reports/ai/weekly?week=YYYY-Www`. Enterprise-gated like the daily. */
export function getAiWeeklyReport(week: string): Promise<AiPeriodReport> {
  return apiFetch<AiPeriodReport>(
    `/v1/insights/reports/ai/weekly?week=${encodeURIComponent(week)}`,
  );
}

/** `POST /v1/insights/reports/ai/weekly/regenerate?week=`. */
export function regenerateAiWeeklyReport(week: string): Promise<AiPeriodReport> {
  return apiFetch<AiPeriodReport>(
    `/v1/insights/reports/ai/weekly/regenerate?week=${encodeURIComponent(week)}`,
    { method: "POST" },
  );
}

/** `GET /v1/insights/reports/ai/monthly?month=YYYY-MM`. Enterprise-gated like the daily. */
export function getAiMonthlyReport(month: string): Promise<AiPeriodReport> {
  return apiFetch<AiPeriodReport>(
    `/v1/insights/reports/ai/monthly?month=${encodeURIComponent(month)}`,
  );
}

/** `POST /v1/insights/reports/ai/monthly/regenerate?month=`. */
export function regenerateAiMonthlyReport(month: string): Promise<AiPeriodReport> {
  return apiFetch<AiPeriodReport>(
    `/v1/insights/reports/ai/monthly/regenerate?month=${encodeURIComponent(month)}`,
    { method: "POST" },
  );
}

/** One ranked person in a department summary — name, tracked hours, mean score. */
export interface DeptPersonStat {
  name: string;
  hours: number;
  score: number;
}

/**
 * The dashboard's **department-scoped** AI summary over a date range (`dept_summary` slice). Gated
 * on `ai.insights` (not the enterprise `ai_pdf`), so it's available wherever the old attention
 * fallback was. `department` is a department id, or `"all"` for the whole org.
 */
export interface DeptSummary {
  department: string;
  from: string;
  to: string;
  metrics: {
    total_people: number;
    scored_people: number;
    tracked_hours_total: number;
    avg_score: number | null;
    top_performer: DeptPersonStat | null;
    needs_improvement: DeptPersonStat | null;
  };
  narrative: string;
  generated_at: number;
}

export interface DeptSummaryArgs {
  /** Department id, or `"all"` for the whole organization. */
  department: string;
  /** Display label the narrative should use (the dropdown text). Omitted for `"all"`. */
  label?: string;
  /** Inclusive window, `YYYY-MM-DD`. `from === to` for a single day. */
  from: string;
  to: string;
  /** Natural phrase for the window ("today", "this week") so the prose reads well. */
  period?: string;
}

function deptSummaryQuery(a: DeptSummaryArgs): string {
  const p = new URLSearchParams({ department: a.department, from: a.from, to: a.to });
  if (a.label && a.department !== "all") p.set("label", a.label);
  if (a.period) p.set("period", a.period);
  return p.toString();
}

/** `GET /v1/insights/reports/dept-summary?department=&from=&to=[&label=&period=]`. */
export function getDeptSummary(a: DeptSummaryArgs): Promise<DeptSummary> {
  return apiFetch<DeptSummary>(`/v1/insights/reports/dept-summary?${deptSummaryQuery(a)}`);
}

// ── Locations board summary (insights::location_summary) ──────────────────────
//
// Mirrors `LocationSummaryResponse`. Every figure is computed server-side from the same
// reach-narrowed read the board plots, so the narrative and the map cannot disagree.

export interface LocationSummary {
  date: string;
  metrics: {
    /** Active employees in the caller's reach. */
    people: number;
    /** …of whom reported at least one fix. */
    located: number;
    /** `false` ⇒ `on_site`/`off_site` are null — "no perimeter" is not "nobody on-site". */
    perimeter_set: boolean;
    on_site: number | null;
    off_site: number | null;
    fixes: number;
  };
  narrative: string;
  generated_at: number;
}

/** `GET /v1/insights/locations/summary?date=` — needs `activity:view` + `ai:view`. */
export function getLocationSummary(date: string): Promise<LocationSummary> {
  return apiFetch<LocationSummary>(
    `/v1/insights/locations/summary?date=${encodeURIComponent(date)}`,
  );
}

/** `POST /v1/insights/locations/summary/regenerate?date=` — re-run the model, re-cache. */
export function regenerateLocationSummary(date: string): Promise<LocationSummary> {
  return apiFetch<LocationSummary>(
    `/v1/insights/locations/summary/regenerate?date=${encodeURIComponent(date)}`,
    { method: "POST" },
  );
}

/** `POST /v1/insights/reports/dept-summary/regenerate?…` — re-run the model, re-cache. */
export function regenerateDeptSummary(a: DeptSummaryArgs): Promise<DeptSummary> {
  return apiFetch<DeptSummary>(
    `/v1/insights/reports/dept-summary/regenerate?${deptSummaryQuery(a)}`,
    { method: "POST" },
  );
}

// ── screenshot department summary (GET/POST /v1/insights/screenshots/dept-summary) ──
// A day's screen activity for one department, narrated for that department's role. Distinct from
// getDeptSummary (scores/hours): this summarises what was on screen.

export interface ScreenshotDeptSummary {
  department: string;
  date: string;
  metrics: {
    people_captured: number;
    people_total: number;
    frames: number;
    productive: number;
    neutral: number;
    distracting: number;
    work_related: number;
    flagged: number;
    avg_productivity: number | null;
    on_task_pct: number;
    notable: string[];
  };
  narrative: string;
  generated_at: number;
}

export interface ScreenshotDeptSummaryArgs {
  /** Department id, or `"all"` for the whole organization. */
  department: string;
  /** The day, `YYYY-MM-DD`. */
  date: string;
  /** Display label the narrative should use (the dropdown text). Omitted for `"all"`. */
  label?: string;
}

function shotDeptSummaryQuery(a: ScreenshotDeptSummaryArgs): string {
  const p = new URLSearchParams({ department: a.department, date: a.date });
  if (a.label && a.department !== "all") p.set("label", a.label);
  return p.toString();
}

/** `GET /v1/insights/screenshots/dept-summary?department=&date=[&label=]`. */
export function getScreenshotDeptSummary(
  a: ScreenshotDeptSummaryArgs,
): Promise<ScreenshotDeptSummary> {
  return apiFetch<ScreenshotDeptSummary>(
    `/v1/insights/screenshots/dept-summary?${shotDeptSummaryQuery(a)}`,
  );
}

/** `POST /v1/insights/screenshots/dept-summary/regenerate?…` — re-run the model, re-cache. */
export function regenerateScreenshotDeptSummary(
  a: ScreenshotDeptSummaryArgs,
): Promise<ScreenshotDeptSummary> {
  return apiFetch<ScreenshotDeptSummary>(
    `/v1/insights/screenshots/dept-summary/regenerate?${shotDeptSummaryQuery(a)}`,
    { method: "POST" },
  );
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

/* ------------------- Per-employee AI recaps (profile page) ------------------- */

/**
 * Deterministic totals over a period — **Rust math over the stored daily summaries**, never the
 * model's arithmetic. `avg_score` is `null` when no day in the period was scored: an honest gap,
 * not a zero that would read as a bad month.
 */
export interface PeriodAggregate {
  /** Days with a stored summary — the denominator for every average, not the length of the period. */
  days_with_data: number;
  avg_score: number | null;
  best_day?: { date: string; score: number };
  worst_day?: { date: string; score: number };
  avg_u: number;
  avg_q: number;
  avg_f: number;
  avg_r: number;
  total_active_secs: number;
  total_worked_minutes: number;
  productive_secs: number;
  neutral_secs: number;
  distracting_secs: number;
  days_present: number;
  days_late: number;
  days_absent: number;
  days_on_leave: number;
}

/** A weekly / monthly / all-time recap. The period label differs; the rest is common. */
export interface PeriodRecap {
  aggregate: PeriodAggregate;
  narrative: string;
  /**
   * Why the narrative is empty, when it is — the level below hasn't been generated yet. Shown
   * instead of a blank card, because "nothing to summarise" and "nothing happened" are different.
   */
  reason?: string;
  generated_at?: number;
  /** The narrative's evidence base: how many children actually had a recap to reduce over. */
  source_days?: number;
  source_weeks?: number;
  source_months?: number;
  week?: string;
  month?: string;
  months?: string[];
  dates?: string[];
  weeks?: string[];
}

/** The four periods the employee profile can summarise. */
export type RecapPeriod = "daily" | "weekly" | "monthly" | "overall";

const userBase = (userId: string) => `/v1/insights/user/${encodeURIComponent(userId)}`;

/**
 * One employee's AI recap for a period.
 *
 * **Serves the same cached narrative the employee reads about themselves** — there is no
 * manager-only variant, by design (`insights::shared::subject`). Needs `AiInsightsRead` **and**
 * `ActivityReadOrg`; reading your own recap through this path needs only the former.
 *
 * `param` is the period label the route expects: `YYYY-MM-DD` for daily, `YYYY-Www` for weekly,
 * `YYYY-MM` for monthly, and an optional `YYYY-MM` upper bound for overall (defaults to now).
 */
export function getUserRecap(
  userId: string,
  period: RecapPeriod,
  param?: string,
): Promise<DailySummary | PeriodRecap> {
  const q =
    period === "daily"
      ? `?date=${encodeURIComponent(param ?? "")}`
      : period === "weekly"
        ? `?week=${encodeURIComponent(param ?? "")}`
        : period === "monthly"
          ? `?month=${encodeURIComponent(param ?? "")}`
          : param
            ? `?through=${encodeURIComponent(param)}`
            : "";
  const path = period === "daily" ? "summary" : period;
  return apiFetch(`${userBase(userId)}/${path}${q}`);
}

/** The `POST …/regenerate` twin of {@link getUserRecap}. Overwrites the one cached narrative. */
export function regenerateUserRecap(
  userId: string,
  period: RecapPeriod,
  param?: string,
): Promise<DailySummary | PeriodRecap> {
  const q =
    period === "daily"
      ? `?date=${encodeURIComponent(param ?? "")}`
      : period === "weekly"
        ? `?week=${encodeURIComponent(param ?? "")}`
        : period === "monthly"
          ? `?month=${encodeURIComponent(param ?? "")}`
          : param
            ? `?through=${encodeURIComponent(param)}`
            : "";
  const path = period === "daily" ? "summary" : period;
  return apiFetch(`${userBase(userId)}/${path}/regenerate${q}`, { method: "POST" });
}

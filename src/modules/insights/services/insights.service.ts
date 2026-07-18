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
  narrative: string;
}

/** `date` is `YYYY-MM-DD` in the caller's local calendar. */
export function getDailySummary(date: string): Promise<DailySummary> {
  return apiFetch<DailySummary>(`/v1/me/insights/summary?date=${encodeURIComponent(date)}`);
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

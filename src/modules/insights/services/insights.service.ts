/**
 * Insights — the one real read route in this context (`insights`, LLD §12). `GET
 * /v1/me/insights/summary?date=` returns the **caller's own** day: real metrics computed from their
 * attendance + time entries, plus an AI-written narrative (Groq). Self-scoped — not org-wide — and
 * **not** agent-gated (it reads timesheet/attendance data, which is real).
 *
 * When no LLM key is configured the server returns a factual fallback narrative, so this never fails
 * for want of AI; the metrics are always real.
 */
import { apiFetch } from "@/lib/api";

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
  narrative: string;
}

/** `date` is `YYYY-MM-DD` in the caller's local calendar. */
export function getDailySummary(date: string): Promise<DailySummary> {
  return apiFetch<DailySummary>(`/v1/me/insights/summary?date=${encodeURIComponent(date)}`);
}

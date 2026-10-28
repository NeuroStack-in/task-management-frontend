import type { DailySummary, PeriodRecap } from "@/modules/insights/services/insights.service";

/**
 * Whether the period had anything for a model to analyse — the `hasData` half of `canRegenerate`
 * (UX audit 2026-10-16, MON-21). Read from what the recap routes report: a narrative is stamped
 * `generated_at` only once a model wrote it, which it only does over real data; a period recap counts
 * the children it reduced; a day carries its own metrics. The server's fixed lines — an empty day,
 * an untracked admin role, a week with no daily recaps — carry none of these.
 */
export function recapHasData(r: DailySummary | PeriodRecap | null): boolean {
  if (!r) return false;
  // A model only writes over real data. With the server's own flag (AI-30) a stamp alone no longer
  // proves that — a fallback can carry one — so `ai_generated: false` falls through to the counts.
  if (r.ai_generated === true) return true;
  if (r.ai_generated !== false && r.generated_at) return true;
  const p = r as PeriodRecap;
  if ((p.source_days ?? 0) > 0 || (p.source_weeks ?? 0) > 0 || (p.source_months ?? 0) > 0) {
    return true;
  }
  const m = (r as DailySummary).metrics;
  return (
    (m != null && (m.entry_count > 0 || m.tracked_secs > 0)) || (r as DailySummary).score != null
  );
}

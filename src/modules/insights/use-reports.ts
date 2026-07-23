"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  getAiMonthlyReport,
  getAiReport,
  getAiWeeklyReport,
  getReportsCatalog,
  regenerateAiMonthlyReport,
  regenerateAiReport,
  regenerateAiWeeklyReport,
  type AiReport,
  type ReportType,
} from "./services/insights.service";

// ── reports catalog (GET /v1/insights/reports) ──

export interface CatalogState {
  reports: ReportType[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Loads the report catalog once. Always available — not entitlement-gated. */
export function useReportsCatalog(): CatalogState {
  const [reports, setReports] = useState<ReportType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getReportsCatalog()
      .then((d) => {
        if (live) setReports(d.reports);
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { reports, loading, error, reload };
}

// ── AI executive report (daily / weekly / monthly, one card) ──

export type AiGranularity = "daily" | "weekly" | "monthly";

/** What the AI card renders, whichever resolution produced it. */
export interface AiNarrative {
  narrative: string;
  /** Set (with an empty narrative) when there is nothing to reduce yet — show it, don't invent. */
  reason?: string | null;
  /** Daily-only extras (the day report carries its metrics block); absent on weekly/monthly. */
  metrics?: AiReport["metrics"];
  date?: string;
  generated_at?: number | null;
}

export interface AiReportState {
  data: AiNarrative | null;
  loading: boolean;
  /** A generic (non-403) load error. */
  error: string | null;
  /** True when the org lacks the `insights.reports.ai_pdf` add-on (403). */
  locked: boolean;
  reload: () => void;
  /** Force a fresh narrative for the current period (re-runs the model, re-caches). */
  regenerate: () => void;
  regenerating: boolean;
}

/** The ISO-8601 week (`YYYY-Www`) containing `dateIso` — what `?week=` expects. */
export function isoWeekOf(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  // Thursday-of-week trick: ISO weeks belong to the year containing their Thursday.
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** The `(fetch, regenerate)` pair for a granularity + anchor date. */
function endpoints(granularity: AiGranularity, date: string) {
  if (granularity === "weekly") {
    const week = isoWeekOf(date);
    return {
      fetch: () => getAiWeeklyReport(week),
      regen: () => regenerateAiWeeklyReport(week),
    };
  }
  if (granularity === "monthly") {
    const month = date.slice(0, 7);
    return {
      fetch: () => getAiMonthlyReport(month),
      regen: () => regenerateAiMonthlyReport(month),
    };
  }
  return {
    fetch: () => getAiReport(date),
    regen: () => regenerateAiReport(date),
  };
}

/**
 * Loads the AI executive report for the period containing `date` (`YYYY-MM-DD`) at the given
 * resolution — the Daily/Weekly/Monthly toggle maps straight onto the three backend artifacts
 * (each generate-once-cached server-side; `regenerate` is the only re-run path). Empty `date`
 * skips the fetch. The routes are entitlement-gated: a 403 sets `locked` (not `error`) so the
 * caller renders the add-on upsell rather than a failure.
 */
export function useAiReport(granularity: AiGranularity, date: string): AiReportState {
  const [data, setData] = useState<AiNarrative | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setLoading(true);
    setError(null);
    setLocked(false);
    endpoints(granularity, date)
      .fetch()
      .then((d) => {
        // Spread, not project: the daily payload carries `metrics`/`date` some surfaces render.
        if (live) setData({ ...d });
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 403) {
          setLocked(true);
          setData(null);
        } else {
          setError(messageOf(e));
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [granularity, date, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const regenerate = useCallback(() => {
    if (!date || regenerating) return;
    setRegenerating(true);
    endpoints(granularity, date)
      .regen()
      .then((d) => setData({ ...d }))
      .catch((e) => setError(messageOf(e)))
      .finally(() => setRegenerating(false));
  }, [granularity, date, regenerating]);

  return { data, loading, error, locked, reload, regenerate, regenerating };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to reports.";
    return e.message;
  }
  return "Couldn't load reports. Check your connection and retry.";
}

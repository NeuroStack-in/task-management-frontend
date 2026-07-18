"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  getAiReport,
  getReportsCatalog,
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

// ── AI executive report (GET /v1/insights/reports/ai?date=) ──

export interface AiReportState {
  data: AiReport | null;
  loading: boolean;
  /** A generic (non-403) load error. */
  error: string | null;
  /** True when the org lacks the `insights.reports.ai_pdf` add-on (403). */
  locked: boolean;
  reload: () => void;
}

/**
 * Loads the AI executive report for a day (`YYYY-MM-DD`). Empty `date` skips the fetch.
 * The route is entitlement-gated: a 403 sets `locked` (not `error`) so the caller can
 * render the add-on upsell rather than a failure.
 */
export function useAiReport(date: string): AiReportState {
  const [data, setData] = useState<AiReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setLoading(true);
    setError(null);
    setLocked(false);
    getAiReport(date)
      .then((d) => {
        if (live) setData(d);
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
  }, [date, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, locked, reload };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to reports.";
    return e.message;
  }
  return "Couldn't load reports. Check your connection and retry.";
}

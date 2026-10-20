"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { isOwnerOf } from "@/hooks/use-features";
import {
  ACTIVITY_READ_ORG_BIT,
  AI_PDF_EXPORT_BIT,
  hasPermissionBit,
} from "@/lib/permission-bits";
import { useAuthStore } from "@/stores/auth.store";
import {
  getAiMonthlyReport,
  getAiReport,
  getAiWeeklyReport,
  regenerateAiMonthlyReport,
  regenerateAiReport,
  regenerateAiWeeklyReport,
  type AiReport,
} from "./services/insights.service";

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
  /** Who wrote `narrative` — the server's own word, when it sends it (UX audit MON-08). */
  ai_generated?: boolean;
  model?: string | null;
}

/**
 * Why the report is unavailable.
 *
 * Every 403 used to read as a missing add-on, so a role without the report's permissions — on an org
 * that has the add-on — was told to "ask an owner to enable" it (QA audit 2026-10-08, WP-277). The
 * server answers both with the same plain `forbidden`, so the reason is read off the caller's own
 * token, which is exactly what the server judged.
 *
 * - `permission` — the role lacks `AiPdfExport` or `ActivityReadOrg`.
 * - `addon` — the role may read it, so the refusal was the `insights.reports.ai_pdf` entitlement.
 * - `unavailable` — refused, and this session's token cannot say which (a pre-bitset session).
 */
export type AiReportLock = "permission" | "addon" | "unavailable";

export interface AiReportState {
  data: AiNarrative | null;
  loading: boolean;
  /** A generic (non-403) load error. */
  error: string | null;
  /** Why the report is refused, or `null` — see {@link AiReportLock}. */
  locked: AiReportLock | null;
  reload: () => void;
  /** Force a fresh narrative for the current period (re-runs the model, re-caches). */
  regenerate: () => void;
  regenerating: boolean;
  /**
   * A failed Regenerate. Kept apart from `error`: the report already on screen is still right, and
   * a failed re-run used to replace the whole report with a bare error and no retry (WP-278).
   */
  regenError: string | null;
}

/** All of `bits` on the `perm` claim — `null` when the claim cannot say (absent or malformed). */
function holdsBits(perm: string | undefined, bits: number[]): boolean | null {
  let all = true;
  for (const bit of bits) {
    const has = hasPermissionBit(perm, bit);
    if (has === null) return null;
    all = all && has;
  }
  return all;
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
 * skips the fetch. The routes need `AiPdfExport` + `ActivityReadOrg` **and** the
 * `insights.reports.ai_pdf` entitlement: a refusal sets `locked` (not `error`) with its reason, so
 * the caller can say which one is missing rather than a failure.
 */
export function useAiReport(granularity: AiGranularity, date: string): AiReportState {
  const [data, setData] = useState<AiNarrative | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<AiReportLock | null>(null);
  /** The period a Regenerate is running for, or `null`. */
  const [regenFor, setRegenFor] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // An owner holds every privilege bit server-side (`AuthContext::can`), so only the entitlement can
  // refuse them. Anyone else is judged on the same `perm` claim the server reads.
  const isOwner = useAuthStore(isOwnerOf);
  const perm = useAuthStore((s) => s.user?.perm);
  const mayRead = isOwner ? true : holdsBits(perm, [AI_PDF_EXPORT_BIT, ACTIVITY_READ_ORG_BIT]);

  /** The period on screen — a response must still match it to land. */
  const period = `${granularity}|${date}`;
  const current = useRef(period);
  useEffect(() => {
    current.current = period;
  }, [period]);
  /** The period `data` belongs to: a reload of the same one keeps it on screen. */
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setError(null);
    setRegenError(null);
    // A role that cannot read the report gets the reason without a request the server would refuse.
    if (mayRead === false) {
      setLocked("permission");
      setData(null);
      setLoading(false);
      return;
    }
    setLocked(null);
    setLoading(true);
    // Another period's report must not stand in for this one while it loads — the page's loader
    // only shows when there is nothing on screen (QA audit 2026-10-08, WP-279).
    if (loadedFor.current !== period) {
      setData(null);
      loadedFor.current = period;
    }
    endpoints(granularity, date)
      .fetch()
      .then((d) => {
        // Spread, not project: the daily payload carries `metrics`/`date` some surfaces render.
        if (live) setData({ ...d });
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 403) {
          setLocked(
            e.code === "feature_disabled" || mayRead === true ? "addon" : "unavailable",
          );
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
  }, [granularity, date, nonce, mayRead, period]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const regenerate = useCallback(() => {
    if (!date || regenFor === period) return;
    const started = period;
    setRegenFor(started);
    setRegenError(null);
    endpoints(granularity, date)
      .regen()
      // A slow model run must not land on a period the user has since moved to — it used to put
      // "Executive summary · Oct 7" under a picker on Oct 8 (QA audit 2026-10-08, WP-278).
      .then((d) => {
        if (current.current === started) setData({ ...d });
      })
      .catch((e) => {
        if (current.current === started) setRegenError(messageOf(e));
      })
      .finally(() => setRegenFor((k) => (k === started ? null : k)));
  }, [granularity, date, regenFor, period]);

  return {
    data,
    loading,
    error,
    locked,
    reload,
    regenerate,
    regenerating: regenFor === period,
    regenError,
  };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to reports.";
    return e.message;
  }
  return "Couldn't load reports. Check your connection and retry.";
}

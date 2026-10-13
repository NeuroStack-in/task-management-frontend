"use client";

/**
 * Org attendance for a whole month, assembled from the day endpoint.
 *
 * The backend serves attendance **one day at a time** (`GET /v1/attendance/day?date=`, reads GSI3) —
 * there is no month/range route for org-wide counts. So a month calendar has to fan the day call out
 * over the visible month's days. This hook does that safely:
 *
 *  - **Bounded concurrency (3).** Firing ~22 requests at once is the fan-out throttle hazard this
 *    project already hit once (`cef2df9`). At most 3 are in flight; `apiFetch` additionally retries
 *    transient 503/429 on its own, so a cold-start hiccup doesn't drop a day.
 *  - **Skip-on-failure.** One day that errors becomes a `null` — its cell renders "unknown", the rest
 *    of the month still loads. A month must never be all-or-nothing on a single bad day.
 *  - **Full response cached per day.** `/v1/attendance/day` returns *both* the summary and the roster,
 *    so the calendar reads `.summary` for the grid and the day view reads `.users` for the selected
 *    day — from the same fetch. Clicking a day the calendar already loaded costs no extra request.
 *
 * Only **closed** days are fetched: today and the future are skipped — today is still open (sealed
 * at 23:59 in the org's timezone), so calling it would just return an empty day. Days off are
 * fetched: an off day somebody worked is `present` server-side and counts, and skipping it made
 * that work invisible on the calendar (QA audit 2026-10-08, WP-260).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { getDayOversight, type ApiDayResponse } from "./services/attendance.service";
import { daysInMonth } from "./lib/calendar";
import { isoOfDay, useToday } from "./use-today";

/** Run `fn` over `items` with at most `limit` in flight. Mirrors `use-projects-data`. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

export interface MonthAttendance {
  /** iso date → that day's full response. Absent key = weekend, future, or a failed fetch. */
  days: Map<string, ApiDayResponse>;
  loading: boolean;
  /** Set only if the whole month failed (e.g. 403); a single bad day is swallowed, not surfaced. */
  error: string | null;
  reload: () => void;
}

/** Closed days change once a night (the 23:59 close), so a slow re-check is plenty. */
const MONTH_REFRESH_MS = 10 * 60_000;

/**
 * `enabled` is the calendar being open. It is collapsed by default, and this fanned out over every
 * closed workday of the month on load **and every 30 s** regardless — up to ~44 day reads a minute
 * from an idle tab, for data that changes once a night (QA audit 2026-10-08, WP-272). Now: nothing
 * until it is opened, then a re-check every 10 minutes (and on the page's Refresh).
 */
export function useMonthAttendance(
  year: number,
  month: number,
  enabled = true,
): MonthAttendance {
  const [days, setDays] = useState<Map<string, ApiDayResponse>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { nonce, reload, isBackground } = useLiveRefresh(MONTH_REFRESH_MS);
  // What the current `days` were loaded for, so closing and reopening the calendar costs nothing.
  const loadedFor = useRef<string | null>(null);
  // Days ≥ today are open → skip. Re-read at midnight, so yesterday becomes fetchable (WP-258).
  const todayIso = isoOfDay(useToday());

  // The closed days of the visible month — what we actually fetch.
  // `year === 0` is the caller's "date not resolved yet" sentinel (the date defaults client-side in
  // an effect): fetch nothing until a real month arrives, or we'd fire ~30 requests for year 0.
  const targets = useMemo(() => {
    if (year <= 0) return [];
    const out: string[] = [];
    for (let d = 1; d <= daysInMonth(year, month); d++) {
      const iso = isoOf(year, month, d);
      if (iso < todayIso) out.push(iso);
    }
    return out;
  }, [year, month, todayIso]);

  useEffect(() => {
    // Read (and so clear) the poll flag first, whether or not this run fetches.
    const background = isBackground();
    if (!enabled) {
      setLoading(false);
      return;
    }
    const key = `${targets.join(",")}#${nonce}`;
    if (loadedFor.current === key) return;
    let live = true;
    if (!background) setLoading(true);
    setError(null);

    if (targets.length === 0) {
      setDays(new Map());
      setLoading(false);
      loadedFor.current = key;
      return;
    }

    mapWithConcurrency(targets, 3, (iso) =>
      getDayOversight(iso).then(
        (resp) => [iso, resp] as const,
        // Skip-on-failure: this day is unknown, the month still loads. Re-throw a 403 (an
        // access problem is the whole month's, not one day's) so the caller can show it.
        (e) => {
          if (isForbidden(e)) throw e;
          return [iso, null] as const;
        },
      ),
    )
      .then((entries) => {
        if (!live) return;
        const map = new Map<string, ApiDayResponse>();
        for (const [iso, resp] of entries) if (resp) map.set(iso, resp);
        setDays(map);
        loadedFor.current = key;
      })
      .catch((e) => {
        if (live)
          setError(
            isForbidden(e)
              ? "You don't have access to team attendance."
              : "Couldn't load the month. Retry.",
          );
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [targets, nonce, isBackground, enabled]);

  return { days, loading, error, reload };
}

function isForbidden(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    (e as { status: number }).status === 403
  );
}

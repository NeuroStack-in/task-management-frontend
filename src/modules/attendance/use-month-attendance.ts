"use client";

/**
 * Org attendance for a whole month, assembled from the day endpoint.
 *
 * The backend serves attendance **one day at a time** (`GET /v1/attendance/day?date=`, reads GSI3) —
 * there is no month/range route for org-wide counts. So a month calendar has to fan the day call out
 * over the visible month's workdays. This hook does that safely:
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
 * Only **closed** days are fetched: weekends (non-workdays) and today/future are skipped — today is
 * still open (resolved by the 00:15 cron), so calling it would just return an empty day.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { getDayOversight, type ApiDayResponse } from "./services/attendance.service";
import { monthMatrix } from "./lib/calendar";
import { useWorkdays } from "@/hooks/use-working-hours";

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

export function useMonthAttendance(year: number, month: number): MonthAttendance {
  const [days, setDays] = useState<Map<string, ApiDayResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Today's iso, computed once client-side (avoids SSR drift). Days ≥ today are open → skip.
  const todayIso = useRef(
    isoOf(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()),
  );

  const workdays = useWorkdays();

  // The closed workdays of the visible month — what we actually fetch.
  // `year === 0` is the caller's "date not resolved yet" sentinel (the date defaults client-side in
  // an effect): fetch nothing until a real month arrives, or we'd fire ~22 requests for year 0.
  const targets = useMemo(() => {
    if (year <= 0) return [];
    return monthMatrix(year, month, workdays)
      .flat()
      .filter((c) => c.inMonth && c.isWorkday)
      .map((c) => isoOf(c.year, c.month, c.day))
      .filter((iso) => iso < todayIso.current);
  }, [year, month, workdays]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);

    if (targets.length === 0) {
      setDays(new Map());
      setLoading(false);
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
  }, [targets, nonce]);

  return { days, loading, error, reload: () => setNonce((n) => n + 1) };
}

function isForbidden(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    (e as { status: number }).status === 403
  );
}

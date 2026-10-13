"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOrgActivity, type OrgActivity } from "./services/insights.service";

/**
 * One day's org rollup. `score` is `null` when that day's fetch failed or nothing was scored.
 *
 * The whole rollup is kept, not just the score: the period metric tiles are aggregated from these
 * days. Previously only `score` survived the fan-out, so anything shown for a week or a month had
 * to fall back to a single day's rollup — which is how the tiles came to contradict a narrative
 * saying no weekly data existed.
 */
export interface RangePoint {
  date: string;
  score: number | null;
  /** `null` when the day's fetch failed — distinguishable from a real zero. */
  rollup: OrgActivity["rollup"] | null;
}

export interface RangeState {
  points: RangePoint[];
  loading: boolean;
  /** Manual refetch of the whole range (for a Refresh button). */
  reload: () => void;
}

/**
 * Fans `getOrgActivity` over a set of dates with **bounded concurrency (3)** and **skip-on-fail**
 * (a failed day becomes `score: null`, never blocks the rest). Used to synthesise the weekly /
 * monthly trend from the per-day org rollups — the scorer stores daily totals only, so a range is
 * built by aggregating day calls rather than a dedicated range endpoint.
 *
 * `cancelled` is checked before each request: a run the user has already moved past stops issuing
 * them. Discarding its result was not enough — flipping through three months left three 23-request
 * fan-outs in flight at once, the burst the lane cap exists to prevent (QA audit 2026-10-08, WP-492).
 */
async function fanOut(dates: string[], cancelled: () => boolean): Promise<RangePoint[]> {
  const results: RangePoint[] = dates.map((date) => ({
    date,
    score: null,
    rollup: null,
  }));
  let cursor = 0;
  const worker = async () => {
    while (cursor < dates.length && !cancelled()) {
      const i = cursor++;
      try {
        const d = await getOrgActivity(dates[i]);
        results[i] = {
          date: dates[i],
          score: d.rollup.avg_score,
          rollup: d.rollup,
        };
      } catch {
        results[i] = { date: dates[i], score: null, rollup: null };
      }
    }
  };
  const lanes = Math.min(3, dates.length);
  await Promise.all(Array.from({ length: lanes }, worker));
  return results;
}

/** Loads the org avg score for each of `dates`. An empty list skips the fetch. */
export function useOrgActivityRange(dates: string[]): RangeState {
  const [points, setPoints] = useState<RangePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const key = dates.join(",");
  /** The range the current `points` describe — a reload of the same range keeps them on screen. */
  const loadedKey = useRef<string | null>(null);

  useEffect(() => {
    if (dates.length === 0) {
      setPoints([]);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    // A **different** range starts empty: last week's days must not stand in for this month's while
    // the fan-out runs (QA audit 2026-10-08, WP-279).
    if (loadedKey.current !== key) {
      setPoints([]);
      loadedKey.current = key;
    }
    fanOut(dates, () => !live)
      .then((r) => {
        if (live) setPoints(r);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // `key` captures the date list identity; `dates` itself is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  return { points, loading, reload };
}

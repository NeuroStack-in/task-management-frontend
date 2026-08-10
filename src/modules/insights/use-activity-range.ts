"use client";

import { useEffect, useState } from "react";
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
}

/**
 * Fans `getOrgActivity` over a set of dates with **bounded concurrency (3)** and **skip-on-fail**
 * (a failed day becomes `score: null`, never blocks the rest). Used to synthesise the weekly /
 * monthly trend from the per-day org rollups — the scorer stores daily totals only, so a range is
 * built by aggregating day calls rather than a dedicated range endpoint.
 */
async function fanOut(dates: string[]): Promise<RangePoint[]> {
  const results: RangePoint[] = dates.map((date) => ({
    date,
    score: null,
    rollup: null,
  }));
  let cursor = 0;
  const worker = async () => {
    while (cursor < dates.length) {
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
  const key = dates.join(",");

  useEffect(() => {
    if (dates.length === 0) {
      setPoints([]);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    fanOut(dates)
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
  }, [key]);

  return { points, loading };
}

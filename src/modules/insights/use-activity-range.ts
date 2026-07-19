"use client";

import { useEffect, useState } from "react";
import { getOrgActivity } from "./services/insights.service";

/** One day's org average score, or `null` when that day's fetch failed or has no scores. */
export interface RangePoint {
  date: string;
  score: number | null;
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
  const results: RangePoint[] = dates.map((date) => ({ date, score: null }));
  let cursor = 0;
  const worker = async () => {
    while (cursor < dates.length) {
      const i = cursor++;
      try {
        const d = await getOrgActivity(dates[i]);
        results[i] = { date: dates[i], score: d.rollup.avg_score };
      } catch {
        results[i] = { date: dates[i], score: null };
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

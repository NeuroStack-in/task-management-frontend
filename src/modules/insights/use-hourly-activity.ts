"use client";

import { useCallback, useEffect, useState } from "react";
import { getScreenshots, type ShotRow } from "./services/insights.service";
// Shared with the dashboard heatmap, which had the same UTC-partition/local-hour mismatch.
import { localDateOf, utcDatesFor } from "@/lib/local-day";

/**
 * Hour-by-hour activity for one day, derived from the day's **screenshot captures**.
 *
 * The scorer stores daily totals, so there is no hourly *score* to plot — but captures carry
 * `captured_at` (epoch ms) and a server-classified `category`, which is a real record of **when**
 * people were at their machines and what kind of work it was. That is a genuine signal already in
 * the system, not a distribution invented from a daily total.
 *
 * What it is and isn't: this counts **capture moments**, not active minutes. The agent captures
 * periodically, so the curve shows when work was happening, not how much. Callers must label it
 * that way — presenting it as measured time would be a fabrication of precision the data lacks.
 *
 * Two correctness details that are easy to get wrong:
 *  - **Multi-monitor double counting.** Frames of one capture share a `captured_at`, so a
 *    dual-monitor machine emits several rows for a single moment (see `screenshots-tab`, which
 *    groups on exactly this). Counting rows would inflate those users' hours, so moments are
 *    de-duplicated per `user_id + captured_at`.
 *  - **Local hours over a UTC-keyed day.** `captured_at` is epoch **milliseconds** and buckets are
 *    the viewer's local hour — but `GET /v1/insights/screenshots?date=` partitions on
 *    `utc_date(captured_at)` (ingest writes `GSI4PK` from it). Those are not the same 24 hours. At
 *    UTC+5:30 one UTC day is local 05:30 → 05:30 the next morning, so asking for one partition and
 *    bucketing locally drew the *following* morning's captures on the left edge of the chart, as
 *    though someone had been working at 4am on the day you selected. So the local day is assembled
 *    from the **one or two UTC partitions that overlap it** and then filtered back to the selected
 *    local date — the chart's axis and its title now mean the same day.
 */

export interface HourBucket {
  /** 0–23, local. */
  hour: number;
  productive: number;
  neutral: number;
  distracting: number;
  total: number;
}

export interface HourlyActivityState {
  hours: HourBucket[];
  /** Distinct capture moments counted across the day. `0` = genuinely nothing to draw. */
  captures: number;
  /** The day had more captures than the page budget — the curve is a partial read, so say so. */
  truncated: boolean;
  loading: boolean;
  error: string | null;
  /** Manual refetch of the day's curve (for a Refresh button). */
  reload: () => void;
}

/** Page size and budget: a day of captures for a small org, without storming the endpoint. */
const PAGE = 200;
const MAX_PAGES = 6;

const EMPTY_HOURS: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  productive: 0,
  neutral: 0,
  distracting: 0,
  total: 0,
}));

/**
 * Bucket de-duplicated capture moments into 24 local hours, split by server category.
 *
 * `localDate` keeps only the moments that fall on that local day. Omit it to bucket everything —
 * the reads span two UTC partitions, so without it the chart would show more than a day.
 */
export function bucketByHour(
  shots: ShotRow[],
  localDate?: string,
): {
  hours: HourBucket[];
  captures: number;
} {
  const hours: HourBucket[] = EMPTY_HOURS.map((h) => ({ ...h }));
  const seen = new Set<string>();

  for (const s of shots) {
    if (localDate && localDateOf(s.captured_at) !== localDate) continue;
    // One moment per user, however many monitors it was photographed on.
    const moment = `${s.user_id}|${s.captured_at}`;
    if (seen.has(moment)) continue;
    seen.add(moment);

    const hour = new Date(s.captured_at).getHours();
    const bucket = hours[hour];
    if (!bucket) continue;
    // The category of the first frame seen for the moment. Frames of one moment can differ per
    // monitor; picking one keeps the moment counted exactly once rather than split across bars.
    if (s.category === "productive") bucket.productive += 1;
    else if (s.category === "distracting") bucket.distracting += 1;
    else bucket.neutral += 1;
    bucket.total += 1;
  }

  return { hours, captures: seen.size };
}

export function useHourlyActivity(date: string): HourlyActivityState {
  const [state, setState] = useState<Omit<HourlyActivityState, "reload">>({
    hours: EMPTY_HOURS,
    captures: 0,
    truncated: false,
    loading: false,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!date) {
      setState({
        hours: EMPTY_HOURS,
        captures: 0,
        truncated: false,
        loading: false,
        error: null,
      });
      return;
    }
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const all: ShotRow[] = [];
        let more = false;
        // Sequential, not `Promise.all`: two days at `MAX_PAGES` each is already a burst, and
        // parallel fan-outs against this endpoint are what trip the 503 throttle.
        for (const utcDate of utcDatesFor(date)) {
          let cursor: string | undefined;
          let pages = 0;
          do {
            const grid = await getScreenshots(utcDate, { cursor, limit: PAGE });
            all.push(...grid.shots);
            cursor = grid.cursor;
            pages += 1;
          } while (cursor && pages < MAX_PAGES);
          more = more || Boolean(cursor);
        }

        if (!live) return;
        const { hours, captures } = bucketByHour(all, date);
        setState({
          hours,
          captures,
          truncated: more,
          loading: false,
          error: null,
        });
      } catch {
        if (!live) return;
        // A failure (commonly a 403 without screenshot access) degrades to the honest empty state
        // rather than an error banner — the hourly curve decorates the page, it isn't the page.
        setState({
          hours: EMPTY_HOURS,
          captures: 0,
          truncated: false,
          loading: false,
          error: "unavailable",
        });
      }
    })();

    return () => {
      live = false;
    };
  }, [date, nonce]);

  return { ...state, reload };
}

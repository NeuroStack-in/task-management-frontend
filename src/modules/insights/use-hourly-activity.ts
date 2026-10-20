"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getScreenshots, type ShotRow } from "./services/insights.service";
// Shared with the dashboard heatmap, which had the same UTC-partition/local-hour mismatch.
import { localDateOf, utcDatesFor } from "@/lib/local-day";

/**
 * Hour-by-hour activity for one day, derived from the day's **screenshot captures**.
 *
 * The scorer stores daily totals, so there is no hourly *score* to plot — but captures carry
 * `captured_at` (epoch ms), which is a real record of **when** people were at their machines. That
 * is a genuine signal already in the system, not a distribution invented from a daily total.
 *
 * **Split by the AI's check, not by app name** (UX audit 2026-10-16, MON-07 / XC-08). The hours
 * were coloured red "Distracting" by the org's app-name rule (`ShotRow.category`), against the
 * owner's decision of 2026-10-13 that app names decide nothing — so a frame could be red here and
 * unflagged on the Screenshots tab. Each moment is now what the Screenshots tab says it is: checked
 * and fine for the person's role, flagged by the AI, or not checked yet.
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
  /** The AI checked every frame of the moment and flagged none (or a reviewer dismissed the flag). */
  ok: number;
  /** The AI flagged a frame of the moment as not work for the person's role, and it stands. */
  flagged: number;
  /** No AI verdict yet on at least one frame, and nothing flagged. */
  unchecked: number;
  total: number;
}

export type HourVerdict = "ok" | "flagged" | "unchecked";

/**
 * One frame's AI verdict, by the Screenshots tab's rules: a flag counts until a reviewer dismisses
 * it (a confirmed flag stays flagged); otherwise a frame the model analysed is fine.
 */
export function frameVerdict(
  s: Pick<ShotRow, "flagged" | "reviewed" | "human_review">,
): HourVerdict {
  if (s.flagged && s.human_review !== "dismissed") return "flagged";
  return s.reviewed === true ? "ok" : "unchecked";
}

export interface HourlyActivityState {
  hours: HourBucket[];
  /** Distinct capture moments counted across the day. `0` = genuinely nothing to draw. */
  captures: number;
  /** Distinct people those moments belong to — what a truncated curve actually covers. */
  people: number;
  /**
   * The day had more captures than the page budget — the curve is a partial read, so say so.
   *
   * **Partial by person, not by time.** The day's index is sorted user-then-time, so what the budget
   * drops is whole people (those whose ids sort first), not the oldest frames.
   */
  truncated: boolean;
  loading: boolean;
  /** Display-ready, or `null`. Set on a failed read, which must never render as an empty day. */
  error: string | null;
  /** The read was refused (403): screenshots are not available to this viewer or this org. */
  denied: boolean;
  /** Manual refetch of the day's curve (for a Refresh button). */
  reload: () => void;
}

/** Page size and budget: a day of captures for a small org, without storming the endpoint. */
const PAGE = 200;
const MAX_PAGES = 6;

const EMPTY_HOURS: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  ok: 0,
  flagged: 0,
  unchecked: 0,
  total: 0,
}));

/**
 * Bucket de-duplicated capture moments into 24 local hours, split by the AI's verdict.
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
  people: number;
} {
  const hours: HourBucket[] = EMPTY_HOURS.map((h) => ({ ...h }));
  // One moment per user, however many monitors it was photographed on — with the verdict of all
  // its frames: flagged if any frame is, fine only if every frame was checked.
  const moments = new Map<string, { at: number; verdict: HourVerdict }>();
  const users = new Set<string>();

  for (const s of shots) {
    if (localDate && localDateOf(s.captured_at) !== localDate) continue;
    const key = `${s.user_id}|${s.captured_at}`;
    const v = frameVerdict(s);
    const prev = moments.get(key);
    users.add(s.user_id);
    if (!prev) {
      moments.set(key, { at: s.captured_at, verdict: v });
    } else if (v === "flagged" || (v === "unchecked" && prev.verdict === "ok")) {
      prev.verdict = v;
    }
  }

  for (const { at, verdict } of moments.values()) {
    const bucket = hours[new Date(at).getHours()];
    if (!bucket) continue;
    bucket[verdict] += 1;
    bucket.total += 1;
  }

  return { hours, captures: moments.size, people: users.size };
}

const IDLE: Omit<HourlyActivityState, "reload"> = {
  hours: EMPTY_HOURS,
  captures: 0,
  people: 0,
  truncated: false,
  loading: false,
  error: null,
  denied: false,
};

export function useHourlyActivity(date: string): HourlyActivityState {
  const [state, setState] = useState<Omit<HourlyActivityState, "reload">>(IDLE);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!date) {
      setState(IDLE);
      return;
    }
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null, denied: false }));

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
        const { hours, captures, people } = bucketByHour(all, date);
        setState({
          hours,
          captures,
          people,
          truncated: more,
          loading: false,
          error: null,
          denied: false,
        });
      } catch (e) {
        if (!live) return;
        // A failure is **not** an empty day. It used to land in the same "none were recorded"
        // state, so a plan without screenshots — or a 500 — read as a measurement of the team
        // (QA audit 2026-10-08, WP-274). The chart still only decorates the page: the caller shows
        // this in place of the curve, not as a page-level banner.
        const denied = e instanceof ApiError && e.status === 403;
        setState({
          ...IDLE,
          error: denied
            ? "Hour-by-hour activity is drawn from screenshot captures, and screenshots aren't available to you — your organization's plan or settings, or your role, don't include them."
            : e instanceof ApiError
              ? e.message
              : "Couldn't load the day's captures. Check your connection and try again.",
          denied,
        });
      }
    })();

    return () => {
      live = false;
    };
  }, [date, nonce]);

  return { ...state, reload };
}

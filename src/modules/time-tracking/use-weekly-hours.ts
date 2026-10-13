"use client";

/**
 * Weekly tracked hours, from the real backend (`GET /v1/me/timesheet?from&to`).
 *
 * **One week per read.** This used to fetch a 12-week window and slice it, and re-download all
 * twelve weeks — every session row in them — every 30 s to draw one week. The server also reads a
 * range with a single query capped at 2,000 entries and no truncation signal, oldest first, so a
 * heavy tracker lost the *newest* weeks, the ones shown by default (QA audit 2026-10-08, WP-434).
 * Now the shown week is read on its own: the current week is polled, a past week is read once and
 * kept, so paging back to it again costs nothing.
 *
 * Billable vs other is real: each day carries `billable_secs` and `total_secs`; "other" is the
 * remainder. A week with no tracked time reads as genuine zeros — not fabricated bars.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { LIVE_REFRESH_MS, useLiveRefresh } from "@/hooks/use-live-refresh";
import { ApiError } from "@/lib/api";
import { getRange, todayLocal } from "./services/timesheet.service";

/** How many weeks back the chart can page. */
export const MAX_WEEKS_BACK = 11;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** One weekday's hours, split billable vs other (both decimal hours). */
export interface WeekDay {
  day: string;
  billable: number;
  other: number;
  hours: number;
}

export interface WeeklyHoursState {
  /** The 7 days (Mon–Sun) of the requested week. */
  days: WeekDay[];
  /** Total tracked hours for that week. */
  totalHours: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Local Monday of the week containing `d` (Mon = start). */
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const delta = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - delta);
  return x;
}

interface DayTotals {
  total: number;
  billable: number;
}

/** One read week: its Monday (`YYYY-MM-DD`) and its date → hours map. */
interface LoadedWeek {
  monday: string;
  totals: Map<string, DayTotals>;
}

const EMPTY_WEEK: WeekDay[] = DAY_LABELS.map((day) => ({
  day,
  billable: 0,
  other: 0,
  hours: 0,
}));

/** @param offset Which week: `0` = this week, `-1` = last week, and so on. */
export function useWeeklyHours(offset: number): WeeklyHoursState {
  const [shown, setShown] = useState<LoadedWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Weeks already read, by Monday. A finished week no longer changes, so paging back to one is
  // served from here; the current week is shown from here too, then re-read quietly.
  const weeksRead = useRef(new Map<string, Map<string, DayTotals>>());
  const lastOffset = useRef<number | null>(null);
  // Live: the **current** week re-fetches every 30 s in the background, so newly-synced time appears
  // without a reload. A past week is not polled. `reload` stays the visible path (Retry).
  const { nonce, reload, isBackground } = useLiveRefresh(offset === 0 ? LIVE_REFRESH_MS : null);

  useEffect(() => {
    // Resolve "now" inside the effect (never during render) so the server and client passes agree —
    // the same reason `use-timesheet` reads the date here. The weeks are the client's own.
    const now = new Date();
    const monday = addDays(mondayOf(now), offset * 7);
    const key = ymd(monday);
    const today = todayLocal(now);
    const sunday = ymd(addDays(monday, 6));
    const to = sunday < today ? sunday : today;
    const background = isBackground();
    const paged = lastOffset.current !== offset;
    lastOffset.current = offset;

    const kept = paged ? weeksRead.current.get(key) : undefined;
    if (kept) {
      setShown({ monday: key, totals: kept });
      setError(null);
      setLoading(false);
      if (offset !== 0) return; // a finished week cannot change
    }

    let live = true;
    // A background poll — or a re-read of a week already on screen — must not blank the chart it
    // is refreshing, nor replace it with an error.
    const quiet = background || Boolean(kept);
    if (!quiet) {
      setLoading(true);
      setError(null);
    }

    getRange(key, to)
      .then((res) => {
        if (!live) return;
        const totals = new Map<string, DayTotals>();
        for (const d of res.days) {
          totals.set(d.date, {
            total: d.total_secs / 3600,
            billable: d.billable_secs / 3600,
          });
        }
        weeksRead.current.set(key, totals);
        setShown({ monday: key, totals });
        setError(null);
      })
      .catch((e) => {
        if (live && !quiet) setError(messageOf(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [offset, nonce, isBackground]);

  const days = useMemo((): WeekDay[] => {
    if (!shown) return EMPTY_WEEK;
    const mon = new Date(`${shown.monday}T00:00:00`);
    return DAY_LABELS.map((day, i) => {
      const rec = shown.totals.get(ymd(addDays(mon, i)));
      const hours = rec ? exactHours(rec.total) : 0;
      const billable = rec ? exactHours(Math.min(rec.billable, rec.total)) : 0;
      return { day, hours, billable, other: exactHours(Math.max(0, hours - billable)) };
    });
  }, [shown]);

  const totalHours = useMemo(() => days.reduce((s, d) => s + d.hours, 0), [days]);

  return { days, totalHours, loading, error, reload };
}

/**
 * Hours as they are — **not** rounded. These were rounded to one decimal (6-minute steps) and
 * then shown, summed and exported as `HH:MM:SS`, so every cell was a multiple of 00:06:00, a
 * day under 3 minutes read as untracked, and totals did not equal their parts (WP-056). The
 * formatters round to the second when they display.
 */
const exactHours = (n: number) => n;

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to this timesheet.";
    return e.message;
  }
  return "Couldn't load your weekly hours. Check your connection and retry.";
}

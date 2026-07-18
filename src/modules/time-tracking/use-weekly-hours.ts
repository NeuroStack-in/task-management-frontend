"use client";

/**
 * Weekly tracked hours, from the real backend (`GET /v1/me/timesheet?from&to`).
 *
 * The server rolls entries up into days server-side and caps the span at 92 days, so this fetches a
 * single ~12-week window (Monday of 11 weeks ago → today, 84 days max) once and slices it per week
 * on the client. Paging the chart back and forth never re-hits the network.
 *
 * Billable vs other is real: each day carries `billable_secs` and `total_secs`; "other" is the
 * remainder. A week with no tracked time reads as genuine zeros — not fabricated bars.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { getRange, todayLocal } from "./services/timesheet.service";

/** How many weeks back the chart can page (matches the fetched window). */
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
  /** The 7 days (Mon–Sun) for `offset` weeks from this week (0 = this week, −1 = last). */
  week: (offset: number) => WeekDay[];
  /** Total tracked hours for that week. */
  totalHoursFor: (offset: number) => number;
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

/** The fetched window: a date→seconds map plus the anchor Monday it was built against. */
interface Loaded {
  totals: Map<string, DayTotals>;
  anchorMonday: Date;
}

const EMPTY_WEEK: WeekDay[] = DAY_LABELS.map((day) => ({
  day,
  billable: 0,
  other: 0,
  hours: 0,
}));

export function useWeeklyHours(): WeeklyHoursState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    // Resolve "now" inside the effect (never during render) so the server and client passes agree —
    // the same reason `use-timesheet` reads the date here. The window is the client's own weeks.
    const now = new Date();
    const anchorMonday = mondayOf(now);
    const from = ymd(addDays(anchorMonday, -MAX_WEEKS_BACK * 7));
    const to = todayLocal(now);

    let live = true;
    setLoading(true);
    setError(null);

    getRange(from, to)
      .then((res) => {
        if (!live) return;
        const totals = new Map<string, DayTotals>();
        for (const d of res.days) {
          totals.set(d.date, {
            total: d.total_secs / 3600,
            billable: d.billable_secs / 3600,
          });
        }
        setLoaded({ totals, anchorMonday });
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

  const week = useCallback(
    (offset: number): WeekDay[] => {
      if (!loaded) return EMPTY_WEEK;
      const mon = addDays(loaded.anchorMonday, offset * 7);
      return DAY_LABELS.map((day, i) => {
        const rec = loaded.totals.get(ymd(addDays(mon, i)));
        const hours = rec ? round1(rec.total) : 0;
        const billable = rec ? round1(Math.min(rec.billable, rec.total)) : 0;
        return { day, hours, billable, other: round1(Math.max(0, hours - billable)) };
      });
    },
    [loaded],
  );

  const totalHoursFor = useCallback(
    (offset: number) => week(offset).reduce((s, d) => s + d.hours, 0),
    [week],
  );

  return { week, totalHoursFor, loading, error, reload };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to this timesheet.";
    return e.message;
  }
  return "Couldn't load your weekly hours. Check your connection and retry.";
}

"use client";

/**
 * The caller's own attendance for a date range, from the real backend.
 *
 * Exposes a `recordFor(year, month0, day)` lookup shaped like the mock `dayRecordFor`, so
 * `personal-attendance-view` swaps its data source without restructuring its calendar/summary math.
 *
 * Takes an explicit `(from, to)` range rather than a month, because the view has two independent
 * windows: the calendar (the viewed month) and the "recent days" list (a fixed span back from
 * today, which doesn't move when you page months). Each is one range read.
 */
import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { ApiError } from "@/lib/api";
import { formatTimeOfDay } from "./lib/clock";
import {
  getMyAttendance,
  type AttendanceStatus,
  type ApiAttendanceDay,
} from "./services/attendance.service";

/**
 * One day as the view reads it. `clockIn`/`clockOut` are the viewer's clock (the working window), or
 * empty when the day had no session / a session is still running.
 */
export interface DayRecord {
  status: AttendanceStatus;
  late: boolean;
  /** Worked hours, exactly `worked_minutes / 60` — format with `formatHours`, never round first. */
  hours: number;
  clockIn: string;
  clockOut: string;
}

/**
 * Epoch ms → the viewer's clock ("14:30" / "02:30 PM"), or `""` when absent. Client-only, so it uses
 * the viewer's tz. Not a forced 24-hour clock any more: the leave pages beside this one forced a
 * 12-hour clock, so one product read "14:30" here and "2:30 pm" there (UX audit 2026-10-16, TIME-14).
 */
function hhmm(ms?: number): string {
  if (!ms) return "";
  return formatTimeOfDay(ms);
}

export interface MyAttendanceRange {
  /** A day the cron has closed, or `null` for an unclosed/future/out-of-range day. */
  recordFor: (year: number, month0: number, day: number) => DayRecord | null;
  /**
   * The records on hand belong to the requested range. False until its first read lands — and after
   * a range change or a failed read — so a caller can show "—" instead of zeros it doesn't have.
   */
  loaded: boolean;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** `from`/`to` are `YYYY-MM-DD` in the client's local calendar. */
export function useMyAttendance(from: string, to: string): MyAttendanceRange {
  // Kept with the range it was read for. On a month change the previous month's map used to be
  // matched against the new grid until the new read landed (QA audit 2026-10-08, WP-483).
  const [data, setData] = useState<{
    key: string;
    byDate: Map<string, ApiAttendanceDay>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Live: a quiet background re-fetch every 30 s, so time on screen keeps up with what the
  // agents have uploaded. `reload` stays the visible path; the poll uses `refresh`.
  const { nonce, reload, isBackground } = useLiveRefresh();
  useEffect(() => {
    let live = true;
    if (!isBackground()) setLoading(true);
    setError(null);

    getMyAttendance(from, to)
      .then((res) => {
        if (!live) return;
        setData({ key: `${from}|${to}`, byDate: new Map(res.days.map((d) => [d.date, d])) });
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
  }, [from, to, nonce, isBackground]);

  const byDate = data?.key === `${from}|${to}` ? data.byDate : null;

  const recordFor = useCallback(
    (y: number, m0: number, day: number): DayRecord | null => {
      const hit = byDate?.get(ymd(y, m0, day));
      if (!hit) return null;
      return {
        status: hit.status,
        late: hit.late,
        // Exact. It was rounded to a tenth of an hour and then printed to the second, so 407 minutes
        // (06:47) read "06:48:00" and a month's total drifted by up to 3 minutes a day (QA audit
        // 2026-10-08, WP-261).
        hours: hit.worked_minutes / 60,
        // The working window — first timer start / last stop that day, enriched server-side onto the
        // attendance row. Rendered in the viewer's local time; empty when there were no sessions.
        clockIn: hhmm(hit.clock_in),
        clockOut: hhmm(hit.clock_out),
      };
    },
    [byDate],
  );

  return {
    recordFor,
    loaded: byDate !== null,
    loading,
    error,
    reload,
  };
}

export function ymd(year: number, month0: number, day: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p(month0 + 1)}-${p(day)}`;
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to attendance.";
    return e.message;
  }
  return "Couldn't load attendance. Check your connection and retry.";
}

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
import { ApiError } from "@/lib/api";
import {
  getMyAttendance,
  type AttendanceStatus,
  type ApiAttendanceDay,
} from "./services/attendance.service";

/** One day as the view reads it. `clockIn`/`clockOut` are empty — attendance has no punches. */
export interface DayRecord {
  status: AttendanceStatus;
  late: boolean;
  hours: number;
  clockIn: string;
  clockOut: string;
}

export interface MyAttendanceRange {
  /** A day the cron has closed, or `null` for an unclosed/future/out-of-range day. */
  recordFor: (year: number, month0: number, day: number) => DayRecord | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** `from`/`to` are `YYYY-MM-DD` in the client's local calendar. */
export function useMyAttendance(from: string, to: string): MyAttendanceRange {
  const [byDate, setByDate] = useState<Map<string, ApiAttendanceDay>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);

    getMyAttendance(from, to)
      .then((res) => {
        if (!live) return;
        setByDate(new Map(res.days.map((d) => [d.date, d])));
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
  }, [from, to, nonce]);

  const recordFor = useCallback(
    (y: number, m0: number, day: number): DayRecord | null => {
      const hit = byDate.get(ymd(y, m0, day));
      if (!hit) return null;
      return {
        status: hit.status,
        late: hit.late,
        hours: Math.round((hit.worked_minutes / 60) * 10) / 10,
        // Attendance is a daily verdict, not a punch log — no clock times to show.
        clockIn: "",
        clockOut: "",
      };
    },
    [byDate],
  );

  return {
    recordFor,
    loading,
    error,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  };
}

export function ymd(year: number, month0: number, day: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p(month0 + 1)}-${p(day)}`;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to attendance.";
    return e.message;
  }
  return "Couldn't load attendance. Check your connection and retry.";
}

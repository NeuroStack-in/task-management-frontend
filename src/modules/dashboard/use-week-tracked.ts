"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRange } from "@/modules/time-tracking/services/timesheet.service";
import { useTimesheet } from "@/modules/time-tracking/use-timesheet";
import { LIVE_REFRESH_MS, useRunningSeconds } from "@/hooks/use-live-refresh";
import { usePoll } from "@/hooks/use-poll";

/**
 * Hours **logged on the timer** across a date range, including the session running right now.
 *
 * The personal dashboard's "Hours this week" used to sum attendance records, whose `hours` come
 * from `worked_minutes` — a figure the nightly attendance close stamps. So today contributed
 * nothing however long the timer had been running: someone three hours into a session saw a tile
 * that hadn't moved since yesterday, next to a live timer counting up. Two numbers about the same
 * work, disagreeing on screen.
 *
 * Two sources, because neither is complete on its own:
 *
 *  - `GET /v1/me/timesheet?from&to` gives the range's **closed** sessions. The server's `total_secs`
 *    explicitly skips a running session (its duration is `None` until it ends), so it is always
 *    behind by however long the current one has been open.
 *  - The open session's elapsed time, derived from its start stamp and re-rendered once a second.
 *
 * They cannot double-count, and that is a property of the server's sum rather than an assumption
 * made here: a session contributes to `total_secs` only once it has an end.
 *
 * **Today comes from today's sheet, everywhere.** It is the fresher of the two (polled every 30 s,
 * where the range is re-read only when a session starts or stops), so the week's total, today's row
 * and the timer tile all agree on today.
 *
 * This is the personal dashboard's **one** `useTimesheet()`: the timer tile is handed `runningRow`
 * and `todaySettledSec` from here. Each used to mount its own, polling the same three endpoints
 * twice every 30 s (QA audit 2026-10-08, WP-434).
 */
export function useWeekTracked(from: string, to: string) {
  // The range's settled seconds per day (`YYYY-MM-DD` → seconds), once read.
  const [byDay, setByDay] = useState<Map<string, number> | null>(null);
  const [nonce, setNonce] = useState(0);

  // Today's sheet, polled by `useTimesheet`. `running` is the open session, if any.
  const today = useTimesheet();
  const running = today.rows.find((r) => r.running) ?? null;
  const liveSec = useRunningSeconds(running ? running.startMs : null);

  // A failed first read used to count as "loaded" with nothing in it — 00:00:00 for the week, and
  // no retry until a session started or stopped (QA audit 2026-10-08, WP-198). It stays unloaded
  // ("—") and is retried on the poll cadence until it lands.
  const loadedRef = useRef(false);
  usePoll(() => {
    if (!loadedRef.current) setNonce((n) => n + 1);
  }, LIVE_REFRESH_MS);

  useEffect(() => {
    if (!from || !to) return;
    let live = true;
    getRange(from, to)
      .then((g) => {
        if (!live) return;
        setByDay(new Map(g.days.map((d) => [d.date, d.total_secs] as const)));
        loadedRef.current = true;
      })
      .catch(() => {
        // Leave the last good figures rather than dropping to zero — a failed refresh must not
        // read as "you worked nothing this week".
      });
    return () => {
      live = false;
    };
    // Re-fetches when the session ends: the seconds move out of `liveSec` and into the server's
    // closed total, and reading the range again is what makes that handover seamless instead of a
    // visible dip.
  }, [from, to, running?.id, nonce]);

  /** Today's date as today's sheet resolved it (`""` until it has loaded). */
  const todayKey = today.date;
  const todaySec = today.totalSec + liveSec;
  let totalSec = todaySec;
  if (byDay) for (const [date, sec] of byDay) if (date !== todayKey) totalSec += sec;

  /** One day's tracked seconds — today's live figure for today, the range's settled one otherwise. */
  const daySec = useCallback(
    (date: string): number => (date === todayKey ? todaySec : (byDay?.get(date) ?? 0)),
    [byDay, todayKey, todaySec],
  );

  const reloadToday = today.reload;
  /** Re-read both: today's sheet and the range (it used to reload today only). */
  const reload = useCallback(() => {
    reloadToday();
    setNonce((n) => n + 1);
  }, [reloadToday]);

  return {
    /** Whole-range seconds: everything closed, plus the session still open. */
    totalSec,
    /**
     * Is a session open right now?
     *
     * Exposed so a caller can distinguish "working" from "worked" — the personal dashboard needs it
     * to label today's row, which has no attendance record until the nightly close writes one.
     */
    running: running !== null,
    /**
     * **Today** on its own: settled seconds plus the open session's elapsed.
     *
     * This hook already reads today's sheet for the live top-up, so exposing it costs nothing —
     * and it saves the caller mounting a second copy of this hook over a one-day range, which
     * would mean two `useTimesheet` instances polling the same endpoint every 30 s for the same
     * answer.
     *
     * `liveSec` is derived from the running session's start stamp and re-rendered once a second
     * locally. Nothing here polls per second.
     */
    todaySec,
    /** Today's **settled** seconds alone (the open session excluded) — for the timer tile. */
    todaySettledSec: today.totalSec,
    /** The session open right now, if any — for the timer tile. */
    runningRow: running,
    daySec,
    /** True once the range has been read at least once — for showing "—" instead of a false 0. */
    loaded: byDay !== null,
    reload,
  };
}

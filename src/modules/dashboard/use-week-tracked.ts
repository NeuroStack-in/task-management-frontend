"use client";

import { useEffect, useState } from "react";
import { getRange } from "@/modules/time-tracking/services/timesheet.service";
import { useTimesheet } from "@/modules/time-tracking/use-timesheet";
import { useRunningSeconds } from "@/hooks/use-live-refresh";

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
 */
export function useWeekTracked(from: string, to: string) {
  const [closedSec, setClosedSec] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Today's sheet is already polled for the timer tile; reuse it rather than opening a second
  // stream for the same fact. `running` is the open session, if any.
  const { rows, totalSec: todayClosedSec, reload } = useTimesheet();
  const running = rows.find((r) => r.running) ?? null;
  const liveSec = useRunningSeconds(running ? running.startMs : null);

  useEffect(() => {
    if (!from || !to) return;
    let live = true;
    getRange(from, to)
      .then((g) => {
        if (!live) return;
        setClosedSec(g.total_secs);
        setLoaded(true);
      })
      .catch(() => {
        // Leave the last good figure rather than dropping to zero — a failed refresh must not read
        // as "you worked nothing this week".
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
    // Re-fetches when the session ends: the seconds move out of `liveSec` and into the server's
    // closed total, and reading the range again is what makes that handover seamless instead of a
    // visible dip.
  }, [from, to, running?.id]);

  return {
    /** Whole-range seconds: everything closed, plus the session still open. */
    totalSec: closedSec + liveSec,
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
    todaySec: todayClosedSec + liveSec,
    /** True once the range has been read at least once — for showing "—" instead of a false 0. */
    loaded,
    reload,
  };
}

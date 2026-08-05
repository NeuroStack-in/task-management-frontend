"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Timer as TimerIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useTimesheet } from "@/modules/time-tracking/use-timesheet";
import { formatDuration } from "@/lib/format";

/**
 * Employee-dashboard hero KPI — **today's total tracked time**, ticking live while a
 * session is open. **View-only** (LLD §4): the timer runs in the WorkPulse desktop
 * agent; this only mirrors what the server folded from its batches. The navbar's
 * GlobalTimer is hidden on /dashboard, so this tile is the single timer surface there.
 * Clicks through to the full Time Tracking view.
 *
 * **It shows the day, not the segment.** This used to render
 * `Date.now() - running.startMs` — the time since the *current* session opened. Pause
 * and resume and it restarted from zero, so someone six hours into their day saw
 * `00:06:39` on the tile that is meant to answer "how much have I worked today". A
 * session is a segment; the day is the sum of them.
 *
 * `totalSec` counts **settled** sessions only — the server's `total_secs` sums
 * `duration_secs`, which an open entry does not have yet (`shared::entry::total_secs`).
 * So the open session's elapsed time has to be added here, and only here: adding it
 * server-side would make a cached read drift the moment it was cached.
 */
export function TimerStatCard() {
  const { rows, totalSec } = useTimesheet();
  const running = rows.find((r) => r.running) ?? null;

  // Advance the clock once a second while a session is open (read-only).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const liveSec = running
    ? Math.max(0, Math.floor((Date.now() - running.startMs) / 1000))
    : 0;
  const todaySec = totalSec + liveSec;
  // What the number is *of* matters as much as the number. Running: name the work in
  // progress. Stopped with time on the clock: say it's the day's total, so a static
  // figure isn't mistaken for a stalled timer.
  const label = running
    ? (running.task ?? running.project ?? "Tracking now")
    : todaySec > 0
      ? "Total tracked today"
      : "Start it in the WorkPulse desktop app";

  return (
    <Link
      href="/time-tracking"
      className="wp-stat-card group/stat block focus-visible:outline-none"
    >
      <Card className="flex h-full flex-col justify-between gap-3 border-transparent bg-feature p-4 text-feature-foreground shadow-none transition-colors hover:bg-feature/90">
        {/* Top row: status + icon */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 truncate text-sm text-feature-foreground/85">
            {running ? (
              <>
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70 opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-white" />
                </span>
                Recording
              </>
            ) : (
              "Today"
            )}
          </span>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-feature-foreground">
            <TimerIcon className="size-4" />
          </span>
        </div>

        {/* Bottom row: elapsed clock + what's running */}
        <div className="min-w-0">
          <p className="font-mono text-2xl font-semibold leading-none tabular-nums">
            {formatDuration(todaySec)}
          </p>
          <p className="mt-1.5 truncate text-xs text-feature-foreground/80">{label}</p>
        </div>
      </Card>
    </Link>
  );
}

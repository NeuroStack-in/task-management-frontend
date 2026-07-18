"use client";

/**
 * The timer, on the web, is **view-only** (LLD §4). The timer itself is a module of the WorkPulse
 * **desktop agent** — starting, pausing, and stopping happen there. This card mirrors the currently
 * open session as the backend knows it (folded from the agent's batches), and nothing more: no
 * Start/Stop, no task picker, no local clock the web could desync from the agent.
 *
 * The elapsed time is computed from the session's real start; note it can run a few minutes ahead of
 * the agent's own stop, because the agent syncs on a batch cycle (~5 min), not live. The copy says so
 * rather than implying a live mirror.
 */
import { useEffect, useState } from "react";
import { MonitorSmartphone, Timer as TimerIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";

/** The open session, as the server reports it. `null` when nothing is running. */
export interface RunningSession {
  task: string;
  project: string;
  /** Local `HH:MM` the session started (from the folded time entry). */
  start: string;
}

/** Reconstruct today's start epoch from an `HH:MM` local time. Null if unparseable. */
function startEpochToday(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime();
}

export function TimerHero({
  running,
  todayTotalSec,
}: {
  running: RunningSession | null;
  todayTotalSec: number;
}) {
  // Tick once per second while a session is open so the elapsed clock advances. Read-only — this
  // moves the display, it never touches the session (that's the agent's job).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const startedAt = running ? startEpochToday(running.start) : null;
  const elapsedSec = startedAt
    ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    : 0;

  return (
    <Card>
      <CardContent className="p-6">
        {running ? (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-xs font-medium text-success">
              <span className="size-1.5 animate-pulse rounded-full bg-success" />
              Recording
            </span>
            <p className="mt-1 font-mono text-4xl font-semibold tabular-nums">
              {formatDuration(elapsedSec)}
            </p>
            <p className="text-sm font-medium">{running.task}</p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {running.project}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MonitorSmartphone className="size-3.5" />
              Started {running.start} · runs in the WorkPulse desktop app
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              <TimerIcon className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">No timer running</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Your timer lives in the WorkPulse desktop app — start and stop it there. Sessions appear
              here once they sync, about every few minutes.
            </p>
          </div>
        )}

        {todayTotalSec > 0 ? (
          <p className="mt-4 flex items-center justify-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
            {formatDuration(todayTotalSec)} logged today
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

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
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The open session, as the server reports it. `null` when nothing is running. */
export interface RunningSession {
  task: string;
  project: string;
  /** Local `HH:MM` the session started — display only, never the tick anchor. */
  start: string;
  /**
   * Epoch ms the session started — the agent's exact stamp. The elapsed clock is anchored here so
   * it agrees with the desktop timer to the second; deriving it from the `HH:MM` string truncated
   * the seconds and read up to 59 s ahead of the agent.
   */
  startMs: number;
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

  const elapsedSec = running
    ? Math.max(0, Math.floor((Date.now() - running.startMs) / 1000))
    : 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border",
        running
          ? "border-primary/20 bg-gradient-to-br from-feature-tint/70 via-card to-card shadow-soft"
          : "border-border bg-card",
      )}
    >
      {running ? (
        <>
          {/* Ambient teal glow + a faint grid-free radial accent behind the clock. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-20 size-64 rounded-full bg-primary/5 blur-3xl"
          />

          <div className="relative flex flex-col items-center gap-3 px-6 py-8 text-center sm:py-10">
            {/* Live recording indicator */}
            <span className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-3 py-1 text-xs font-semibold tracking-wide text-success">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Recording
            </span>

            {/* Elapsed clock — the hero */}
            <p className="font-mono text-5xl font-bold tracking-tight tabular-nums text-foreground sm:text-6xl">
              {formatDuration(elapsedSec)}
            </p>

            {/* Task + project */}
            <div className="space-y-1">
              <p className="text-base font-semibold">{running.task}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                {running.project}
              </p>
            </div>

            {/* Where it's controlled */}
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-background/60 px-3 py-1 text-xs text-muted-foreground ring-1 ring-border/60">
              <MonitorSmartphone className="size-3.5 text-primary" />
              Started {running.start} · runs in the WorkPulse desktop app
            </p>

            {todayTotalSec > 0 ? (
              <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {formatDuration(todayTotalSec)}
                </span>{" "}
                logged today
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-feature-tint text-primary">
            <TimerIcon className="size-5" />
          </span>
          <p className="text-sm font-semibold">No timer running</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Your timer lives in the WorkPulse desktop app — start and stop it there. Sessions appear
            here once they sync, about every few minutes.
          </p>
          {todayTotalSec > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {formatDuration(todayTotalSec)}
              </span>{" "}
              logged today
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

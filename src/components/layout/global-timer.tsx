"use client";

import { useEffect, useState } from "react";
import { Timer as TimerIcon } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useIsSurfaceOn } from "@/hooks/use-features";
import { useTimesheet } from "@/modules/time-tracking/use-timesheet";
import { formatDuration } from "@/lib/format";

/**
 * Global timer indicator (navbar). **View-only** (LLD §4): the timer is a module of the WorkPulse
 * desktop agent — this only mirrors the open session the server has folded from the agent's batches.
 * There are no controls, and it now reads the real `/v1/me/timesheet/today` session instead of a
 * browser-local mock, so it reflects the agent rather than a second clock.
 *
 * Oversight roles (Owner/Admin/managers) don't run a personal timer — they manage their team's — so
 * only contributors (`time-tracking:self`) render the indicator, and only they fetch the timesheet.
 * The gate is a separate component so a non-contributor never mounts the fetching part.
 */
export function GlobalTimer() {
  const { can } = usePermissions();
  const isSurfaceOn = useIsSurfaceOn();
  // Gate on the org feature too — an org with Time Tracking switched off shouldn't show the chip (the
  // outer gate keeps `useTimesheet` from mounting at all). The permission gate stays: oversight roles
  // don't run a personal timer.
  if (!can("time-tracking:self") || !isSurfaceOn("time.tracking")) return null;
  return <RunningIndicator />;
}

function RunningIndicator() {
  const { rows } = useTimesheet();
  const running = rows.find((r) => r.running) ?? null;

  // Re-derive the elapsed once a second while a session is open (from its real start).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Idle — no open session.
  if (!running) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-full bg-card px-3.5 text-sm text-muted-foreground shadow-soft">
        <TimerIcon className="size-4" />
        <span className="hidden font-medium md:inline">No timer</span>
      </div>
    );
  }

  // Anchor to the agent's exact epoch-ms stamp, not the `HH:MM` display string — the truncated
  // seconds made this chip read up to 59 s ahead of the desktop timer for the same session.
  const elapsedSec = Math.max(0, Math.floor((Date.now() - running.startMs) / 1000));

  return (
    <div
      className="flex h-10 items-center gap-2.5 rounded-full bg-card px-3.5 shadow-soft"
      title="Running in the WorkPulse desktop app"
    >
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-success" />
      <span className="hidden max-w-[140px] truncate text-xs font-medium text-muted-foreground sm:inline">
        {running.task}
      </span>
      <span className="font-mono text-sm tabular-nums">{formatDuration(elapsedSec)}</span>
    </div>
  );
}

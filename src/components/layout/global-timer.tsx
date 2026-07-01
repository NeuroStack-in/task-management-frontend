"use client";

import { useEffect, useState } from "react";
import { Timer as TimerIcon } from "lucide-react";
import { useTimerStore } from "@/stores/timer.store";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Global timer indicator (TDD §11). A read-only status display in the top
 * navbar — it shows whether a timer is running and the elapsed time, ticking
 * once per second while running. Starting / pausing / stopping happens on the
 * Time Tracking page; this only mirrors the persisted timer store.
 */
export function GlobalTimer() {
  const { can } = usePermissions();
  const task = useTimerStore((s) => s.task);
  const status = useTimerStore((s) => s.status);
  const elapsed = useTimerStore((s) => s.elapsed);

  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Oversight roles (Owner/Admin/managers) don't run a personal timer — they
  // manage their team's. The personal indicator only applies to people who
  // log their own time (`time-tracking:edit`, a contributor-only permission).
  if (!can("time-tracking:edit")) return null;

  // Idle — no timer running.
  if (!task) {
    return (
      <div className="flex h-10 items-center gap-2 rounded-full bg-card px-3.5 text-sm text-muted-foreground shadow-soft">
        <TimerIcon className="size-4" />
        <span className="hidden font-medium md:inline">No timer</span>
      </div>
    );
  }

  const running = status === "running";
  return (
    <div className="flex h-10 items-center gap-2.5 rounded-full bg-card px-3.5 shadow-soft">
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          running ? "animate-pulse bg-success" : "bg-warning",
        )}
      />
      <span className="hidden max-w-[140px] truncate text-xs font-medium text-muted-foreground sm:inline">
        {task.taskTitle}
      </span>
      <span className="font-mono text-sm tabular-nums">
        {formatDuration(elapsed())}
      </span>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Play, Pause, Square, Timer as TimerIcon } from "lucide-react";
import { toast } from "sonner";
import { useTimerStore } from "@/stores/timer.store";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Global persistent timer (TDD §11). Always visible in the top navbar. Ticks
 * once per second while running; reads accumulated time from the timer store so
 * it survives navigation and reloads.
 */
export function GlobalTimer() {
  const task = useTimerStore((s) => s.task);
  const status = useTimerStore((s) => s.status);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const stop = useTimerStore((s) => s.stop);
  const start = useTimerStore((s) => s.start);
  const elapsed = useTimerStore((s) => s.elapsed);

  const [, setTick] = useState(0);

  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const handleStop = () => {
    const total = stop();
    toast.success("Time entry submitted", {
      description: `Logged ${formatDuration(total)} to "${task?.taskTitle}".`,
    });
  };

  if (!task) {
    return (
      <Button
        variant="ghost"
        className="h-10 gap-2 rounded-full bg-card text-primary shadow-soft hover:bg-card hover:text-primary"
        onClick={() =>
          start({ taskId: "demo-task", taskTitle: "Focus session" })
        }
      >
        <TimerIcon className="size-4" />
        <span className="hidden font-medium md:inline">Start timer</span>
      </Button>
    );
  }

  return (
    <div className="flex h-10 items-center gap-2 rounded-full bg-card px-3 shadow-soft">
      <span
        className={cn(
          "size-2 rounded-full",
          status === "running" ? "animate-pulse bg-success" : "bg-warning",
        )}
      />
      <div className="hidden min-w-0 flex-col leading-tight sm:flex">
        <span className="truncate text-xs font-medium" style={{ maxWidth: 140 }}>
          {task.taskTitle}
        </span>
      </div>
      <span className="font-mono text-sm tabular-nums">
        {formatDuration(elapsed())}
      </span>
      {status === "running" ? (
        <Button variant="ghost" size="icon" className="size-7" onClick={pause}>
          <Pause className="size-4" />
        </Button>
      ) : (
        <Button variant="ghost" size="icon" className="size-7" onClick={resume}>
          <Play className="size-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-destructive"
        onClick={handleStop}
      >
        <Square className="size-4" />
      </Button>
    </div>
  );
}

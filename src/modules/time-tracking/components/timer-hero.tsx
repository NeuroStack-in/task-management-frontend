"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Square, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useTimerStore } from "@/stores/timer.store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDuration } from "@/lib/format";
import { TASK_OPTIONS, type TaskOption, type TimeEntry } from "@/lib/mock-time";
import { cn } from "@/lib/utils";

const pad = (n: number) => n.toString().padStart(2, "0");

/**
 * The live timer — Time Tracking's hero (TDD §11). Drives the same persisted
 * timer store as the global navbar timer, so the two stay in lock-step. Pick a
 * task, start/pause/resume, and stopping appends a real entry to today's sheet.
 */
export function TimerHero({
  onLogged,
}: {
  onLogged: (entry: TimeEntry) => void;
}) {
  const task = useTimerStore((s) => s.task);
  const status = useTimerStore((s) => s.status);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const stop = useTimerStore((s) => s.stop);
  const elapsed = useTimerStore((s) => s.elapsed);

  const [selected, setSelected] = useState<TaskOption>(TASK_OPTIONS[0]);
  const [, setTick] = useState(0);

  // Tick once per second while running so the clock animates.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const running = status === "running";
  const active = Boolean(task);

  const handleStart = () => {
    start({
      taskId: selected.taskId,
      taskTitle: selected.taskTitle,
      projectName: selected.projectName,
    });
  };

  const handleStop = () => {
    const total = stop();
    const end = new Date();
    const begin = new Date(end.getTime() - total * 1000);
    const matched = TASK_OPTIONS.find((t) => t.taskTitle === task?.taskTitle);
    const entry: TimeEntry = {
      id: `te-live-${end.getTime()}`,
      task: task?.taskTitle ?? selected.taskTitle,
      project: task?.projectName ?? selected.projectName,
      start: `${pad(begin.getHours())}:${pad(begin.getMinutes())}`,
      end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
      durationSec: total,
      billable: matched?.billable ?? true,
      activity: 70 + (total % 25),
    };
    onLogged(entry);
    toast.success("Time entry logged", {
      description: `${formatDuration(total)} on “${entry.task}”.`,
    });
  };

  return (
    <Card className="bg-feature text-feature-foreground shadow-none">
      <div className="flex flex-col gap-6 px-6 py-1 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-feature-foreground/80">
            <span
              className={cn(
                "size-2 rounded-full",
                running
                  ? "animate-pulse bg-white"
                  : active
                    ? "bg-white/60"
                    : "bg-white/30",
              )}
            />
            <span className="text-xs font-medium uppercase tracking-wide">
              {running ? "Tracking" : active ? "Paused" : "Ready"}
            </span>
          </div>

          {/* Task picker */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={active}
              render={
                <button
                  type="button"
                  className="group flex items-center gap-2 text-left disabled:cursor-default"
                />
              }
            >
              <div>
                <p className="font-display text-xl font-semibold leading-tight">
                  {active ? task?.taskTitle : selected.taskTitle}
                </p>
                <p className="text-sm text-feature-foreground/75">
                  {active ? task?.projectName : selected.projectName}
                </p>
              </div>
              {!active ? (
                <ChevronDown className="size-4 text-feature-foreground/70 transition-transform group-data-[popup-open]:rotate-180" />
              ) : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {TASK_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.taskId}
                  onClick={() => setSelected(opt)}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="font-medium">{opt.taskTitle}</span>
                    {opt.billable ? (
                      <Badge variant="secondary" className="shrink-0">
                        Billable
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {opt.projectName} · {opt.taskId}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-5">
          <span className="font-mono text-4xl font-semibold tabular-nums sm:text-5xl">
            {formatDuration(active ? elapsed() : 0)}
          </span>

          <div className="flex items-center gap-2">
            {!active ? (
              <Button
                size="lg"
                className="gap-2 rounded-full bg-white text-primary hover:bg-white/90"
                onClick={handleStart}
              >
                <Play className="size-4 fill-current" /> Start
              </Button>
            ) : (
              <>
                {running ? (
                  <Button
                    size="icon"
                    className="size-11 rounded-full bg-white/15 text-white hover:bg-white/25"
                    onClick={pause}
                    aria-label="Pause"
                  >
                    <Pause className="size-5" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="size-11 rounded-full bg-white text-primary hover:bg-white/90"
                    onClick={resume}
                    aria-label="Resume"
                  >
                    <Play className="size-5 fill-current" />
                  </Button>
                )}
                <Button
                  size="icon"
                  className="size-11 rounded-full bg-white/15 text-white hover:bg-white/25"
                  onClick={handleStop}
                  aria-label="Stop and log"
                >
                  <Square className="size-4 fill-current" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

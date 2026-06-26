"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  FolderKanban,
  ListChecks,
  Pause,
  Play,
  Square,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

const PROJECTS = Array.from(new Set(TASK_OPTIONS.map((o) => o.projectName)));
const tasksForProject = (project: string) =>
  TASK_OPTIONS.filter((o) => o.projectName === project);

/**
 * The live timer — Time Tracking's hero. Pick a project, then a task, and
 * start. Each continuous run is logged as its own entry: pausing (and stopping)
 * appends the segment to today's sheet. While paused you can switch the
 * project/task and resume against the new one. Drives the same persisted timer
 * store as the navbar timer, so the two stay in lock-step.
 */
export function TimerHero({
  onLogged,
}: {
  onLogged: (entry: TimeEntry) => void;
}) {
  const task = useTimerStore((s) => s.task);
  const status = useTimerStore((s) => s.status);
  const segmentStartedAt = useTimerStore((s) => s.segmentStartedAt);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const stop = useTimerStore((s) => s.stop);
  const switchTask = useTimerStore((s) => s.switchTask);
  const elapsed = useTimerStore((s) => s.elapsed);

  const [selProject, setSelProject] = useState(TASK_OPTIONS[0].projectName);
  const [selTask, setSelTask] = useState<TaskOption>(TASK_OPTIONS[0]);
  const [, setTick] = useState(0);

  // Tick once per second while running so the clock animates.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Keep the pickers in sync when a known task is the active one (e.g. after a
  // reload while a timer is running).
  useEffect(() => {
    if (!task) return;
    const opt = TASK_OPTIONS.find((o) => o.taskId === task.taskId);
    if (opt) {
      setSelProject(opt.projectName);
      setSelTask(opt);
    }
  }, [task]);

  const running = status === "running";
  const active = Boolean(task);
  const locked = running; // can only change the task when idle or paused

  const chooseProject = (project: string) => {
    setSelProject(project);
    setSelTask(tasksForProject(project)[0]);
  };

  /** Log the just-finished run segment (between resume/start and now). */
  const logSegment = (): number => {
    if (!task || segmentStartedAt === null) return 0;
    const end = new Date();
    const begin = new Date(segmentStartedAt);
    const sec = Math.max(0, Math.floor((end.getTime() - begin.getTime()) / 1000));
    if (sec < 1) return 0;
    const matched = TASK_OPTIONS.find((o) => o.taskId === task.taskId);
    onLogged({
      id: `te-live-${end.getTime()}`,
      task: task.taskTitle,
      project: task.projectName ?? "",
      start: `${pad(begin.getHours())}:${pad(begin.getMinutes())}`,
      end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
      durationSec: sec,
      billable: matched?.billable ?? true,
      activity: 68 + (sec % 28),
    });
    return sec;
  };

  const handleStart = () =>
    start({
      taskId: selTask.taskId,
      taskTitle: selTask.taskTitle,
      projectName: selTask.projectName,
    });

  const handlePause = () => {
    const sec = logSegment();
    pause();
    if (sec)
      toast.success("Segment logged", {
        description: `${formatDuration(sec)} on “${task?.taskTitle}”.`,
      });
  };

  const handleResume = () => {
    if (task && selTask.taskId !== task.taskId) {
      switchTask({
        taskId: selTask.taskId,
        taskTitle: selTask.taskTitle,
        projectName: selTask.projectName,
      });
      toast.success("Switched task", { description: selTask.taskTitle });
    } else {
      resume();
    }
  };

  const handleStop = () => {
    logSegment();
    stop();
    toast.success("Timer stopped", {
      description: "Today’s timesheet is up to date.",
    });
  };

  return (
    <Card className="bg-feature text-feature-foreground shadow-none">
      <div className="flex flex-col gap-6 p-5 lg:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3.5">
          {/* Status */}
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

          {/* Project + Task pickers */}
          <div className="flex flex-wrap items-center gap-2.5">
            <HeroPicker
              icon={FolderKanban}
              label={selProject}
              disabled={locked}
              width="min-w-[16rem]"
            >
              <p className="px-1.5 pt-0.5 pb-1 text-xs font-medium text-muted-foreground">
                Project
              </p>
              {PROJECTS.map((p) => {
                const isSel = p === selProject;
                return (
                  <DropdownMenuItem
                    key={p}
                    onClick={() => chooseProject(p)}
                    className={cn(
                      "gap-2.5 rounded-lg px-1.5 py-1.5",
                      isSel && "bg-accent/60",
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FolderKanban className="size-4" />
                    </span>
                    <span className="flex-1 truncate font-medium">{p}</span>
                    {isSel ? (
                      <Check className="size-4 shrink-0 text-primary" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </HeroPicker>

            <HeroPicker
              icon={ListChecks}
              label={selTask.taskTitle}
              disabled={locked}
              width="min-w-[20rem]"
            >
              <p className="flex items-center gap-1.5 px-1.5 pt-0.5 pb-1 text-xs font-medium text-muted-foreground">
                Task
                <span className="font-normal text-muted-foreground/70">
                  · {selProject}
                </span>
              </p>
              {tasksForProject(selProject).map((opt) => {
                const isSel = opt.taskId === selTask.taskId;
                return (
                  <DropdownMenuItem
                    key={opt.taskId}
                    onClick={() => setSelTask(opt)}
                    className={cn(
                      "items-start gap-2.5 rounded-lg px-1.5 py-1.5",
                      isSel && "bg-accent/60",
                    )}
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <ListChecks className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {opt.taskTitle}
                        </span>
                        {opt.billable ? (
                          <Badge
                            variant="secondary"
                            className="shrink-0 px-1.5 py-0 text-[0.65rem]"
                          >
                            Billable
                          </Badge>
                        ) : null}
                      </span>
                      <span className="block truncate font-mono text-[0.7rem] text-muted-foreground">
                        {opt.taskId}
                      </span>
                    </span>
                    {isSel ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : null}
                  </DropdownMenuItem>
                );
              })}
            </HeroPicker>
          </div>

          {active && !running ? (
            <p className="text-xs text-feature-foreground/70">
              Paused — switch the project or task above, then resume.
            </p>
          ) : null}
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
                    onClick={handlePause}
                    aria-label="Pause"
                  >
                    <Pause className="size-5" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="size-11 rounded-full bg-white text-primary hover:bg-white/90"
                    onClick={handleResume}
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

function HeroPicker({
  icon: Icon,
  label,
  disabled,
  width,
  children,
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  width?: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className="group inline-flex min-w-[8rem] max-w-xs items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/25 hover:ring-white/25 disabled:opacity-70 disabled:ring-white/10 disabled:hover:bg-white/15"
          />
        }
      >
        <Icon className="size-4 shrink-0 text-white/80" />
        <span className="truncate">{label}</span>
        {!disabled ? (
          <ChevronDown className="size-4 shrink-0 text-white/70 transition-transform group-data-[popup-open]:rotate-180" />
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className={cn("max-h-80 overflow-y-auto p-1.5", width)}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

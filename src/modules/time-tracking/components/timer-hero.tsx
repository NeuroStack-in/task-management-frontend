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
import { useTimeLogger } from "../use-time-logger";

const PROJECTS = Array.from(new Set(TASK_OPTIONS.map((o) => o.projectName)));
const tasksForProject = (project: string) =>
  TASK_OPTIONS.filter((o) => o.projectName === project);
const optionForEntry = (task: string, project: string) =>
  TASK_OPTIONS.find((o) => o.taskTitle === task && o.projectName === project);

interface SessionRow {
  opt: TaskOption;
  totalSec: number;
  /** Recency key for sorting (later = more recent). */
  order: number;
}

/**
 * The live timer — Time Tracking's hero. The Task picker doubles as the
 * "Today's sessions" list: its top group shows every task worked today (with
 * its day total) so a tap resumes or switches to it; the bottom group lists all
 * assignable tasks to start something new. Pause/stop log each run segment, and
 * the per-task day clock lives in the persisted timer store (shared with the
 * navbar timer).
 */
export function TimerHero({
  entries,
  onLogged,
}: {
  entries: TimeEntry[];
  onLogged: (entry: TimeEntry) => void;
}) {
  const task = useTimerStore((s) => s.task);
  const status = useTimerStore((s) => s.status);
  const taskSeconds = useTimerStore((s) => s.taskSeconds);
  const elapsed = useTimerStore((s) => s.elapsed);
  const { startTask, resumeTask, pauseAndLog, stopAndLog } =
    useTimeLogger(onLogged);

  const [selProject, setSelProject] = useState(TASK_OPTIONS[0].projectName);
  const [selTask, setSelTask] = useState<TaskOption>(TASK_OPTIONS[0]);
  const [, setTick] = useState(0);

  // Tick once per second while running so the clock (and live session) animate.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Keep the pickers in sync when a known task is the active one (e.g. after a
  // reload while a timer is running, or after switching from the list).
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

  // Today's sessions, rolled up per task from logged entries, with the active
  // task's live (unlogged) portion folded in so its row ticks. Most recent first.
  const sessionMap = new Map<string, SessionRow>();
  entries.forEach((e, i) => {
    const opt = optionForEntry(e.task, e.project);
    if (!opt) return;
    const cur = sessionMap.get(opt.taskId);
    if (cur) {
      cur.totalSec += e.durationSec;
      cur.order = i;
    } else {
      sessionMap.set(opt.taskId, { opt, totalSec: e.durationSec, order: i });
    }
  });
  if (task) {
    const opt = TASK_OPTIONS.find((o) => o.taskId === task.taskId);
    if (opt) {
      const banked = taskSeconds[task.taskId] ?? 0;
      const live = running ? Math.max(0, elapsed() - banked) : 0;
      const cur = sessionMap.get(task.taskId);
      if (cur) {
        cur.totalSec += live;
        cur.order = entries.length;
      } else {
        sessionMap.set(task.taskId, { opt, totalSec: live, order: entries.length });
      }
    }
  }
  const sessions = [...sessionMap.values()].sort((a, b) => b.order - a.order);
  const sessionsTotal = sessions.reduce((s, x) => s + x.totalSec, 0);

  const chooseProject = (project: string) => {
    setSelProject(project);
    setSelTask(tasksForProject(project)[0]);
  };

  // Picking from the Task menu. A "Today's sessions" tap resumes/switches to
  // that task right away; an "All tasks" tap selects it to start (or, while
  // running, switches immediately — so the menu is never a dead-end).
  const pickTask = (opt: TaskOption, fromSessions: boolean) => {
    if (running) {
      if (!task || opt.taskId !== task.taskId) resumeTask(opt);
      return;
    }
    if (fromSessions) {
      resumeTask(opt);
      return;
    }
    setSelProject(opt.projectName);
    setSelTask(opt);
  };

  const handleStart = () => startTask(selTask);
  const handlePause = pauseAndLog;
  const handleResume = () => resumeTask(selTask);
  const handleStop = stopAndLog;

  return (
    <Card className="bg-feature text-feature-foreground shadow-none">
      <div className="flex flex-col gap-6 px-6 py-1 lg:flex-row lg:items-center lg:justify-between">
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

          {/* Project + Task pickers (Task doubles as Today's sessions) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <HeroPicker icon={FolderKanban} label={selProject} width="w-64">
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
              label={active ? task!.taskTitle : selTask.taskTitle}
              width="w-[22rem]"
            >
              {/* ── Today's sessions ── */}
              {sessions.length > 0 ? (
                <>
                  <p className="flex items-center justify-between gap-2 px-1.5 pt-0.5 pb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Today&apos;s sessions
                    </span>
                    <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground">
                      {formatDuration(sessionsTotal)}
                    </span>
                  </p>
                  {sessions.map(({ opt, totalSec }) => {
                    const isActive = task?.taskId === opt.taskId;
                    const isRunning = isActive && running;
                    return (
                      <DropdownMenuItem
                        key={`session-${opt.taskId}`}
                        onClick={() => pickTask(opt, true)}
                        className={cn(
                          "items-center gap-2.5 rounded-lg px-1.5 py-1.5",
                          isActive && "bg-accent/60",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-md",
                            isRunning
                              ? "bg-success/15 text-success"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          {isRunning ? (
                            <span className="size-2 animate-pulse rounded-full bg-success" />
                          ) : (
                            <Play className="size-3.5 fill-current" />
                          )}
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
                          <span className="block truncate text-[0.7rem] text-muted-foreground">
                            {opt.projectName}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-mono text-xs tabular-nums",
                            isRunning ? "text-success" : "text-muted-foreground",
                          )}
                        >
                          {formatDuration(totalSec)}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                  <div className="my-1 h-px bg-border" />
                </>
              ) : null}

              {/* ── All tasks (start something new) ── */}
              <p className="flex items-center gap-1.5 px-1.5 pt-0.5 pb-1 text-xs font-medium text-muted-foreground">
                All tasks
                <span className="font-normal text-muted-foreground/70">
                  · {selProject}
                </span>
              </p>
              {tasksForProject(selProject).map((opt) => {
                const isSel = !active && opt.taskId === selTask.taskId;
                return (
                  <DropdownMenuItem
                    key={opt.taskId}
                    onClick={() => pickTask(opt, false)}
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
              Paused — pick a task from the menu to switch, or resume below.
            </p>
          ) : (
            <p className="text-xs text-feature-foreground/70">
              {active
                ? "Tracking — open the task menu to switch to another session."
                : "Pick a task to start, or resume one from today’s sessions."}
            </p>
          )}
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
            className="group inline-flex max-w-full items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-inset ring-white/15 backdrop-blur-sm transition-colors hover:bg-white/25 hover:ring-white/25 disabled:opacity-70 disabled:ring-white/10 disabled:hover:bg-white/15"
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
        className={cn("max-h-96 overflow-y-auto p-1.5", width)}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

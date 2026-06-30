"use client";

import { toast } from "sonner";
import { useTimerStore } from "@/stores/timer.store";
import { formatDuration } from "@/lib/format";
import { TASK_OPTIONS, type TaskOption, type TimeEntry } from "@/lib/mock-time";

const pad = (n: number) => n.toString().padStart(2, "0");

/**
 * The live timer's effect on today's timesheet, in one place. Both the timer
 * hero controls and the "Today's sessions" resume buttons drive these so the
 * logging stays identical no matter where the action is triggered.
 *
 * Each continuous run is logged as its own segment: pausing, switching, and
 * stopping all append the just-finished segment to `onLogged` before mutating
 * the timer. The per-task clock lives in the timer store (`taskSeconds`).
 */
export function useTimeLogger(onLogged: (entry: TimeEntry) => void) {
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const stop = useTimerStore((s) => s.stop);
  const switchTask = useTimerStore((s) => s.switchTask);

  /** Log the just-finished run segment (between resume/start and now). */
  const logSegment = (): number => {
    const { task, segmentStartedAt } = useTimerStore.getState();
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

  const startTask = (opt: TaskOption) =>
    start({
      taskId: opt.taskId,
      taskTitle: opt.taskTitle,
      projectName: opt.projectName,
    });

  const switchToTask = (opt: TaskOption) => {
    logSegment();
    switchTask({
      taskId: opt.taskId,
      taskTitle: opt.taskTitle,
      projectName: opt.projectName,
    });
    toast.success("Switched task", { description: opt.taskTitle });
  };

  const pauseAndLog = () => {
    const { task } = useTimerStore.getState();
    const sec = logSegment();
    pause();
    if (sec)
      toast.success("Segment logged", {
        description: `${formatDuration(sec)} on “${task?.taskTitle}”.`,
      });
  };

  const stopAndLog = () => {
    logSegment();
    stop();
    toast.success("Timer stopped", {
      description: "Today’s timesheet is up to date.",
    });
  };

  /**
   * Track a specific task again (used by the timer's Resume button and the
   * sessions list): switch to it (logging the outgoing segment) when another
   * task is live, plain-resume when it's the paused task, or start it from idle.
   */
  const resumeTask = (opt: TaskOption) => {
    const { task, status } = useTimerStore.getState();
    if (!task) {
      startTask(opt);
      toast.success("Tracking started", { description: opt.taskTitle });
      return;
    }
    if (task.taskId === opt.taskId) {
      if (status === "paused") resume();
      return;
    }
    switchToTask(opt);
  };

  return { startTask, switchToTask, resumeTask, pauseAndLog, stopAndLog };
}

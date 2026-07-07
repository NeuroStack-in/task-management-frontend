import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActiveTimerTask, TimerStatus } from "@/types";

interface TimerState {
  task: ActiveTimerTask | null;
  status: TimerStatus;
  /**
   * Banked seconds **per task** (keyed by taskId), excluding the live segment.
   * This is each task's running total for the WHOLE DAY: it survives pause,
   * switch, and stop, so returning to a task always resumes from its day total.
   * Reset only when the calendar day rolls over (see `dayStamp`).
   */
  taskSeconds: Record<string, number>;
  /** Local date ("YYYY-MM-DD") the per-task totals belong to; null until seeded. */
  dayStamp: string | null;
  /** Epoch ms when the current running segment started; null when not running. */
  segmentStartedAt: number | null;

  /**
   * Seed today's per-task totals from existing logged time (e.g. the mock
   * day's entries), so a task resumes from its full day total. No-op once the
   * current `dayStamp` matches — preserves live progress across reloads — and a
   * full reset when the day changes.
   */
  seedDay: (totals: Record<string, number>, day: string) => void;
  start: (task: ActiveTimerTask) => void;
  pause: () => void;
  resume: () => void;
  stop: () => number; // returns total elapsed seconds across all tasks
  switchTask: (task: ActiveTimerTask) => void;
  /** Elapsed seconds for the ACTIVE task, including its live segment. */
  elapsed: () => number;
}

function liveSegment(segmentStartedAt: number | null): number {
  if (segmentStartedAt === null) return 0;
  return Math.floor((Date.now() - segmentStartedAt) / 1000);
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      task: null,
      status: "idle",
      taskSeconds: {},
      dayStamp: null,
      segmentStartedAt: null,

      seedDay: (totals, day) => {
        if (get().dayStamp === day) return; // already seeded today — keep progress
        set({
          taskSeconds: totals,
          dayStamp: day,
          task: null,
          status: "idle",
          segmentStartedAt: null,
        });
      },

      // Run the chosen task, continuing from its day total (no reset) — start
      // doubles as "resume this task" since the per-task clock persists.
      start: (task) => {
        const { taskSeconds } = get();
        set({
          task,
          status: "running",
          taskSeconds: {
            ...taskSeconds,
            [task.taskId]: taskSeconds[task.taskId] ?? 0,
          },
          segmentStartedAt: Date.now(),
        });
      },

      pause: () => {
        const { status, task, taskSeconds, segmentStartedAt } = get();
        if (status !== "running" || !task) return;
        set({
          status: "paused",
          taskSeconds: {
            ...taskSeconds,
            [task.taskId]:
              (taskSeconds[task.taskId] ?? 0) + liveSegment(segmentStartedAt),
          },
          segmentStartedAt: null,
        });
      },

      // Reopen a segment for the current task; its banked seconds are untouched,
      // so the clock continues from where this task was paused.
      resume: () => {
        if (get().status !== "paused") return;
        set({ status: "running", segmentStartedAt: Date.now() });
      },

      // End the live run but KEEP the day's per-task totals: bank the active
      // task's live segment so restarting it later today resumes from here.
      stop: () => {
        const { task, taskSeconds, segmentStartedAt } = get();
        const total = get().elapsed();
        const banked = task
          ? {
              ...taskSeconds,
              [task.taskId]:
                (taskSeconds[task.taskId] ?? 0) + liveSegment(segmentStartedAt),
            }
          : taskSeconds;
        set({
          task: null,
          status: "idle",
          taskSeconds: banked,
          segmentStartedAt: null,
        });
        return total;
      },

      // Switch the active task mid-session: bank the live segment into the
      // OUTGOING task, then run the incoming one — which keeps whatever it had
      // banked before (0 if new, its prior total if you're returning to it).
      switchTask: (next) => {
        const { task, taskSeconds, segmentStartedAt } = get();
        const banked = task
          ? {
              ...taskSeconds,
              [task.taskId]:
                (taskSeconds[task.taskId] ?? 0) + liveSegment(segmentStartedAt),
            }
          : taskSeconds;
        set({
          task: next,
          status: "running",
          taskSeconds: banked,
          segmentStartedAt: Date.now(),
        });
      },

      elapsed: () => {
        const { task, taskSeconds, segmentStartedAt } = get();
        if (!task) return 0;
        return (taskSeconds[task.taskId] ?? 0) + liveSegment(segmentStartedAt);
      },
    }),
    {
      name: "wp-timer",
      // Bumped when the persisted shape changed; reset the timer on any version
      // mismatch so a stale/half-finished segment never carries over (and to
      // silence zustand's "no migrate function" warning).
      version: 3,
      migrate: () =>
        ({
          task: null,
          status: "idle",
          taskSeconds: {},
          dayStamp: null,
          segmentStartedAt: null,
        }) as TimerState,
    },
  ),
);

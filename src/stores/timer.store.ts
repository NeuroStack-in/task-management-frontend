import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ActiveTimerTask, TimerStatus } from "@/types";

interface TimerState {
  task: ActiveTimerTask | null;
  status: TimerStatus;
  /**
   * Accumulated seconds for the current work session, across every run segment
   * (and across task switches) — excludes the live segment. The session clock
   * keeps counting when you switch tasks; each segment is logged individually.
   */
  accumulatedSeconds: number;
  /** Epoch ms when the current running segment started; null when not running. */
  segmentStartedAt: number | null;

  start: (task: ActiveTimerTask) => void;
  pause: () => void;
  resume: () => void;
  stop: () => number; // returns total elapsed seconds
  switchTask: (task: ActiveTimerTask) => void;
  /** Total elapsed seconds including the live segment. */
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
      accumulatedSeconds: 0,
      segmentStartedAt: null,

      start: (task) =>
        set({
          task,
          status: "running",
          accumulatedSeconds: 0,
          segmentStartedAt: Date.now(),
        }),

      pause: () => {
        const { status, accumulatedSeconds, segmentStartedAt } = get();
        if (status !== "running") return;
        set({
          status: "paused",
          accumulatedSeconds: accumulatedSeconds + liveSegment(segmentStartedAt),
          segmentStartedAt: null,
        });
      },

      resume: () => {
        if (get().status !== "paused") return;
        set({ status: "running", segmentStartedAt: Date.now() });
      },

      stop: () => {
        const total = get().elapsed();
        set({
          task: null,
          status: "idle",
          accumulatedSeconds: 0,
          segmentStartedAt: null,
        });
        return total;
      },

      // Switch the active task mid-session without resetting the clock: the
      // previous segment has already been logged/paused, so we keep
      // accumulatedSeconds and just open a fresh live segment for the new task.
      switchTask: (task) =>
        set({
          task,
          status: "running",
          segmentStartedAt: Date.now(),
        }),

      elapsed: () => {
        const { accumulatedSeconds, segmentStartedAt } = get();
        return accumulatedSeconds + liveSegment(segmentStartedAt);
      },
    }),
    {
      name: "wp-timer",
      version: 1,
      // On a version bump, don't resurrect a stale timer from a prior shape —
      // start clean and idle. (A dangling running segment isn't worth keeping.)
      migrate: () =>
        ({
          task: null,
          status: "idle",
          accumulatedSeconds: 0,
          segmentStartedAt: null,
        }) as TimerState,
    },
  ),
);

"use client";

/**
 * Today's timesheet, from the real backend.
 *
 * Joins two reads: the day's entries (`time-attendance`) and the project catalog (`projects`), so
 * rows can show a project *name* for the `project_id` the entry carries. The two are fetched
 * together but fail independently — see `projectOf`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { UNKNOWN_PROJECT } from "@/lib/format";
import { usePoll } from "@/hooks/use-poll";
import {
  listMyTasks,
  projectNameMap,
} from "@/modules/projects/services/projects.service";
import {
  clockOf,
  getToday,
  todayLocal,
  type ApiEntryRow,
} from "./services/timesheet.service";

/** One row as the table renders it. No `activity` — the server does not serve one (see the service). */
export interface TimesheetRow {
  id: string;
  /**
   * The **task's title**, or `null` when the session was tracked against a project only (a task is
   * optional — the agent's `start_timer` takes `task_id: Option<String>`).
   *
   * Kept distinct from `description`: collapsing them into one label made the TASK column show a
   * task name on one row and a typed description on the next, which reads as inconsistent data
   * rather than two different fields.
   */
  task: string | null;
  /** What the person typed in the agent. The server folds entries by (project, description). */
  description: string;
  project: string;
  /** Local `HH:MM`. */
  start: string;
  /**
   * Epoch **ms** the session started — the agent's exact stamp, straight from the server.
   *
   * The ticking timers (hero, navbar chip) must anchor to this, never to the display `start`:
   * `HH:MM` has its seconds truncated, so reconstructing an epoch from it made the web clock read
   * up to 59 s ahead of the desktop agent's own timer for the same session.
   */
  startMs: number;
  /** Local `HH:MM`, or null while the session is still running. */
  end: string | null;
  /** Seconds. 0 for a running session — it has not yet contributed any settled time. */
  durationSec: number;
  billable: boolean;
  /** The session is open: no end, no duration. Rendered as a state, not as a zero. */
  running: boolean;
  /** The task was gone/unassigned at fold. The time still counts; this is a flag for a human. */
  taskInvalid: boolean;
}

export interface TimesheetState {
  rows: TimesheetRow[];
  totalSec: number;
  billableSec: number;
  /** A session is open right now. Read-only: the web cannot start or stop it (LLD §4). */
  running: boolean;
  date: string;
  loading: boolean;
  /** A human-readable failure. `null` while loading or on success. */
  error: string | null;
  reload: () => void;
}

/**
 * One day's timesheet. Defaults to **today**, which is the primary view; pass a `YYYY-MM-DD` to read
 * a past day for the history section.
 *
 * The 30 s background poll only runs for today. A past day is immutable — the agent cannot fold new
 * entries into a day that has ended — so polling it would be pure request noise against an answer
 * that cannot change.
 */
export function useTimesheet(day?: string): TimesheetState {
  const [state, setState] = useState<
    Omit<TimesheetState, "reload" | "loading" | "error">
  >({ rows: [], totalSec: 0, billableSec: 0, running: false, date: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Monotonic request id: a slow response that lands after a newer one is dropped, so overlapping
  // fetches (a poll firing mid-reload) can't apply stale data out of order.
  const reqId = useRef(0);

  const fetchToday = useCallback(
    async (background: boolean) => {
      // The date is resolved here (not at render) for the same reason it always was: the server runs
      // in UTC and 400s a missing date, and a render-time `new Date()` would trip a hydration mismatch.
      // An explicit `day` wins; without one this is today, exactly as before.
      const date = day ?? todayLocal();
      const id = ++reqId.current;
      // A foreground load shows the spinner and surfaces errors. A background poll does neither: it
      // refreshes silently, so the page doesn't flash every 30 s and a transient blip doesn't blank
      // good data. This is what makes the poll invisible until it actually has news.
      if (!background) {
        setLoading(true);
        setError(null);
      }
      try {
        // The project catalog is a *nicety* — it turns an id into a name. A caller without
        // `projects:view` gets a 403 here, which must not blank out their own timesheet, so its
        // failure degrades to an empty map rather than rejecting the pair.
        // Task titles are the same kind of *nicety* as the project catalog: they turn an id into a
        // name and must never be able to blank a timesheet, so a 403/failure degrades to an empty map.
        const [today, names, titles] = await Promise.all([
          getToday(date),
          projectNameMap().catch(() => new Map<string, string>()),
          // `includeUnassigned` because this is a **name lookup**, not a to-do list. An unassigned
          // task is offered in the desktop picker, so time really does get tracked against one —
          // and without its title here the row fell back to "No description" and named nothing at
          // all. Nothing about this list is rendered as "your tasks"; only `id → title` is used.
          listMyTasks({ includeUnassigned: true })
            .then((ts) => new Map(ts.map((t) => [t.id, t.title])))
            .catch(() => new Map<string, string>()),
        ]);
        if (id !== reqId.current) return; // a newer request superseded this one
        setState({
          date: today.date,
          totalSec: today.total_secs,
          billableSec: today.billable_secs,
          running: today.running,
          // **Chronological.** The server returns entries in its own key order, which put the
          // day's sessions on screen as 12:01, 11:37, 13:02, 14:22, 14:03 — a list nobody can read
          // down. Sorted here, once, so every consumer of this hook agrees on the order rather
          // than each sorting (or not) for itself. Ascending, so the running session — the one
          // that started most recently — sits last, where the day is still being written.
          rows: today.entries
            .map((e) => toRow(e, names, titles))
            .sort((a, b) => a.startMs - b.startMs),
        });
        if (background) setError(null); // a good background refresh clears a stale error banner
      } catch (e) {
        if (id !== reqId.current) return;
        // Only a foreground load surfaces the error — a failed background poll keeps the last good
        // data on screen rather than replacing a working timesheet with an error.
        if (!background) setError(messageOf(e));
      } finally {
        if (id === reqId.current && !background) setLoading(false);
      }
    },
    [day],
  );

  // Initial load (foreground), and a reload whenever the selected day changes.
  useEffect(() => {
    fetchToday(false);
  }, [fetchToday]);

  // Live-refresh every 30 s in the background (paused when the tab is hidden; refetches on return).
  // This is the freshness half of the view-only timer: once the agent posts a timer transition
  // out-of-band, the running state shows up here within a poll instead of on a manual refresh.
  // `null` disables the poll: a past day cannot change, so polling it would be request noise against
  // an answer that is already final.
  usePoll(() => fetchToday(true), day ? null : 30_000);

  const reload = useCallback(() => fetchToday(false), [fetchToday]);

  return { ...state, loading, error, reload };
}

/**
 * What to call the work: `Task · Subtask`, the task alone, or null when neither resolves.
 *
 * The server resolves both titles (it can name a task this caller could never list). The local map
 * remains a fallback for a backend that predates `task_title`; it has no subtask equivalent, which
 * is fine — the separator only appears when there is something to put after it.
 */
function taskLabel(e: ApiEntryRow, titles: Map<string, string>): string | null {
  const task = e.task_title?.trim() || titles.get(e.task_id)?.trim() || "";
  const sub = e.subtask_title?.trim() || "";
  if (task && sub) return `${task} · ${sub}`;
  return task || null;
}

function toRow(
  e: ApiEntryRow,
  names: Map<string, string>,
  titles: Map<string, string>,
): TimesheetRow {
  const running = e.end === undefined;
  return {
    id: e.session_id,
    // Server first: it resolves the title even for a task this caller cannot list. The local map
    // stays as the fallback for a backend that predates `task_title`.
    // `Task · Subtask` when the session ran against a subtask — the desktop app lets you point the
    // clock at one, and a timesheet that only ever says the parent hides which part was worked on.
    task: taskLabel(e, titles),
    description: e.description?.trim() || "",
    project: projectOf(e.project_id, names),
    start: clockOf(e.start),
    startMs: e.start,
    end: e.end === undefined ? null : clockOf(e.end),
    durationSec: e.duration_secs ?? 0,
    billable: e.billable,
    running,
    taskInvalid: e.task_invalid ?? false,
  };
}

/**
 * A project's display name, tolerating a miss.
 *
 * A project can be deleted (or be invisible to this caller) while an old entry still references it.
 * The entry is still true — the time really was worked — so the row must render. Falling back to a
 * neutral label (never the raw id) keeps it honest instead of showing a blank cell that reads as
 * "no project".
 */
function projectOf(id: string, names: Map<string, string>): string {
  if (!id) return "—";
  return names.get(id) ?? UNKNOWN_PROJECT;
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to this timesheet.";
    return e.message;
  }
  return "Couldn't load your timesheet. Check your connection and retry.";
}

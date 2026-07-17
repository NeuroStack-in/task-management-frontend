"use client";

/**
 * Today's timesheet, from the real backend.
 *
 * Joins two reads: the day's entries (`time-attendance`) and the project catalog (`projects`), so
 * rows can show a project *name* for the `project_id` the entry carries. The two are fetched
 * together but fail independently — see `projectOf`.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { projectNameMap } from "@/modules/projects/services/projects.service";
import {
  clockOf,
  getToday,
  taskLabel,
  todayLocal,
  type ApiEntryRow,
} from "./services/timesheet.service";

/** One row as the table renders it. No `activity` — the server does not serve one (see the service). */
export interface TimesheetRow {
  id: string;
  task: string;
  project: string;
  /** Local `HH:MM`. */
  start: string;
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

export function useTimesheet(): TimesheetState {
  const [state, setState] = useState<
    Omit<TimesheetState, "reload" | "loading" | "error">
  >({ rows: [], totalSec: 0, billableSec: 0, running: false, date: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    // The date is resolved on the client, deliberately: the server runs in UTC and 400s a missing
    // date rather than guess a timezone. It must also be read inside the effect, not during render
    // — a render-time `new Date()` would differ between the server and client passes and trip a
    // hydration mismatch.
    const date = todayLocal();
    let live = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // The project catalog is a *nicety* — it turns an id into a name. A caller without
        // `projects:view` gets a 403 here, which must not blank out their own timesheet, so its
        // failure degrades to an empty map rather than rejecting the pair.
        const [today, names] = await Promise.all([
          getToday(date),
          projectNameMap().catch(() => new Map<string, string>()),
        ]);
        if (!live) return;

        setState({
          date: today.date,
          totalSec: today.total_secs,
          billableSec: today.billable_secs,
          running: today.running,
          rows: today.entries.map((e) => toRow(e, names)),
        });
      } catch (e) {
        if (!live) return;
        setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce]);

  return { ...state, loading, error, reload };
}

function toRow(e: ApiEntryRow, names: Map<string, string>): TimesheetRow {
  const running = e.end === undefined;
  return {
    id: e.session_id,
    task: taskLabel(e),
    project: projectOf(e.project_id, names),
    start: clockOf(e.start),
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
 * The entry is still true — the time really was worked — so the row must render. Falling back to the
 * id keeps it honest instead of showing a blank cell that reads as "no project".
 */
function projectOf(id: string, names: Map<string, string>): string {
  if (!id) return "—";
  return names.get(id) ?? id;
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to this timesheet.";
    return e.message;
  }
  return "Couldn't load your timesheet. Check your connection and retry.";
}

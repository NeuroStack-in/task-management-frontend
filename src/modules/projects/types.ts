/**
 * Projects & Tasks domain model (SPEC §7, PAGES §6–7).
 *
 * Tasks live INSIDE Projects — there is no standalone /tasks route (the page was
 * merged into Projects; see the handoff doc). These types are shared by the seed
 * script, the data accessors, and the UI.
 */

export type ProjectStatus = "active" | "on_hold" | "completed";

export interface Project {
  id: string;
  name: string;
  /** Optional one-paragraph brief shown on the project detail page. */
  description?: string;
  /** Short uppercase key, e.g. "WP" — used as a task prefix and card badge. */
  key: string;
  status: ProjectStatus;
  /**
   * Billable is a **project-level** decision — every task inherits it, there is no
   * per-task override (LLD §4). Required at creation: there is no sensible default,
   * and guessing wrong silently mis-bills a client.
   *
   * The server stamps this onto each `TimeEntry` at fold time and **freezes** it, so
   * reclassifying a project never rewrites past entries.
   */
  billable: boolean;
  /** 0–100. */
  progress: number;
  leadUserId: string;
  /** Optional project manager (distinct from the delivery lead). */
  managerId?: string;
  memberIds: string[];
  department: string;
  /** ISO date strings (absolute — relative ranges are resolved at seed time). */
  startDate: string;
  dueDate: string;
  /** 7-point activity pulse (the WorkPulse motif), newest last. */
  velocity: number[];
}

// `blocked` matches the backend's TaskStatus (LLD §5) — an exception state reachable from any
// column, not a stage. It was missing here while the board was mock; the real board serves it.
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "in_review"
  /**
   * Reviewed and signed off — the terminal state.
   *
   * Until 2026-08-31 this meant only "the assignee says it's finished", and a separate `closed`
   * carried the sign-off. Two terminal columns made the board confusing and put the review action
   * somewhere other than the column called *In review*. Now `done` IS the sign-off: reaching it
   * takes a Manager or Lead, and the ordinary route is reviewing an `in_review` task.
   */
  | "done"
  | "blocked";

/**
 * A status a person may set.
 *
 * Every column is now reachable by hand — but not by everyone: `done` is sign-off and needs a
 * Manager or Lead, which is a fact about the CALLER, not about the status, so the type can no
 * longer express it. `canSetTaskStatus` in `lib.ts` is the runtime gate, and the server enforces
 * it regardless.
 */
export type SettableTaskStatus = TaskStatus;

/** A task's sign-off, present only on a reviewed (`done`) task. */
export interface TaskReview {
  reviewed_by: string;
  /** Resolved and stored server-side at review time, so it survives the reviewer leaving. */
  reviewer_name: string;
  /** Epoch millis. */
  reviewed_at: number;
  /** 1-5. */
  rating: number;
  note?: string;
}
export type TaskPriority = "low" | "medium" | "high";

/** A file attached to a task. Client shape is camelCase (`contentType`); the wire uses `content_type`. */
export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

/** One person on a task, and the record of who put them there. */
export interface TaskAssignee {
  userId: string;
  /**
   * Who assigned them. **Empty string** for assignments made before the server recorded it — read
   * that as "unknown", never as the task's creator: this is an audit field, and a plausible guess
   * is worse than a gap.
   */
  assignedBy: string;
  /** Epoch ms, or 0 when unrecorded (same pre-migration rows as `assignedBy`). */
  assignedAt: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  /** Free-text detail; empty string when the task has none. */
  description: string;
  status: TaskStatus;
  /**
   * Everyone on the task, in the order they were assigned.
   *
   * **Empty is a real, useful state**, not a missing value: an unassigned task is offered to every
   * member of its project in the desktop app's task picker, so "nobody yet" is how work gets put up
   * for grabs. Surfaces should say "Unassigned" rather than leaving a blank.
   */
  assignees: TaskAssignee[];
  priority: TaskPriority;
  dueDate: string | null;
  estimateHours: number;
  /** Files attached to the task; empty array when none. */
  attachments: Attachment[];
  /**
   * Who created the task (the server's `created_by`). Delete authority depends on it — a project
   * Member may remove only their own tasks (`canDeleteTask` in `./lib`).
   *
   * Optional because tasks predating the attribute omit it, and the seed/store copies never had it.
   * Absent means "not mine" — never assume ownership from a missing value.
   */
  createdBy?: string | null;
  /** Sign-off, present only on a `closed` task — who approved it, when, and their rating. */
  review?: TaskReview | null;
  /**
   * How much of this task's breakdown is done — the `3/5` counter on the card.
   *
   * `{total: 0, done: 0}` means the task has no subtasks, which is the normal case. The count comes
   * from the server rather than from `subtasks.length` so every surface agrees what "done" counts:
   * both `done` **and** `closed` are finished.
   */
  subtaskProgress: SubtaskProgress;
}

/** The `3/5` counter on a task card. */
export interface SubtaskProgress {
  total: number;
  done: number;
}

/**
 * One subtask — a single level of breakdown under a task.
 *
 * Real work, not a checklist tick: it carries a status and an assignee, and the desktop app's timer
 * runs against it. It is **created and edited only in the desktop app**; the web shows it read-only.
 *
 * A subtask never appears on the kanban board or in "My tasks" — the parent task is the unit of
 * delivery, so an employee breaking their work into five pieces does not add five cards to their
 * manager's board or move the project's completion percentage.
 */
export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  createdBy: string;
  createdAt: number;
  completedAt: number | null;
}

/* ------------------------------------------------------------------ */
/* Presentation metadata — kept here (server-safe) so both the cards   */
/* and the detail views read from one source of truth.                 */
/* ------------------------------------------------------------------ */

export interface StatusMeta {
  label: string;
  /** Tailwind token color class fragment, e.g. "primary" → bg-primary. */
  tone: "primary" | "success" | "warning" | "muted";
}

export const PROJECT_STATUS_META: Record<ProjectStatus, StatusMeta> = {
  active: { label: "Active", tone: "primary" },
  on_hold: { label: "On hold", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
};

export const PROJECT_STATUS_ORDER: ProjectStatus[] = ["active", "on_hold", "completed"];

export interface TaskStatusMeta {
  label: string;
  tone: "muted" | "primary" | "warning" | "success";
}

export const TASK_STATUS_META: Record<TaskStatus, TaskStatusMeta> = {
  todo: { label: "To do", tone: "muted" },
  in_progress: { label: "In progress", tone: "primary" },
  in_review: { label: "In review", tone: "warning" },
  done: { label: "Done", tone: "success" },
  blocked: { label: "Blocked", tone: "warning" },
};

// `blocked` sits last — an exception state, not a stage in the flow (LLD §5).
export const TASK_STATUS_ORDER: TaskStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
];

/**
 * Statuses a person may drag a card into, or pick in a form.
 *
 * Every column is listed, because which ones a given person may set depends on who they are:
 * `done` is sign-off and needs a Manager or Lead. That check is `canSetTaskStatus` in `lib.ts` —
 * a list of names cannot express it, and pretending otherwise is how `closed` ended up both
 * un-settable and unreachable from the column named for reviewing it.
 */
export const TASK_STATUS_SETTABLE: TaskStatus[] = [...TASK_STATUS_ORDER];

/**
 * The statuses that mean the work is finished — mirrors `TaskStatus::is_open` in
 * `backend/crates/projects/src/shared/task.rs`.
 *
 * One entry since `closed` was retired on 2026-08-31. Kept as a list rather than inlined as
 * `s === "done"` precisely because the dashboard once tested `status !== "done"` in two places and
 * every reviewed task counted as open work forever — the tile inflated and finished tasks kept
 * reappearing under upcoming deadlines. A named constant is where that stays fixed.
 */
export const FINISHED_TASK_STATUSES: readonly TaskStatus[] = ["done"];

/**
 * Does this status still need someone's attention? The inverse of {@link FINISHED_TASK_STATUSES}.
 *
 * Takes a `string` rather than a `TaskStatus` on purpose: callers hold raw server values, and an
 * unrecognised status must read as *open* (visible, chaseable) rather than silently vanishing.
 */
export function isOpenTaskStatus(status: string): boolean {
  return !FINISHED_TASK_STATUSES.includes(status as TaskStatus);
}

export const TASK_PRIORITY_META: Record<
  TaskPriority,
  { label: string; tone: "muted" | "warning" | "negative" }
> = {
  low: { label: "Low", tone: "muted" },
  medium: { label: "Medium", tone: "warning" },
  high: { label: "High", tone: "negative" },
};

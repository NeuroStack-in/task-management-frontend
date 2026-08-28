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
  | "done"
  /**
   * Reviewed and signed off — the terminal state.
   *
   * `done` is the assignee's claim that the work is finished; `closed` is someone with authority
   * over the project agreeing, with a rating. Only the review endpoint can set it, so nothing here
   * should offer it as a drag target or a status option.
   */
  | "closed"
  | "blocked";

/**
 * A status a person may actually set — everything except `closed`.
 *
 * Used by the create/edit form and the drag handler, so the "you cannot set this by hand" rule is
 * enforced by the compiler rather than remembered.
 */
export type SettableTaskStatus = Exclude<TaskStatus, "closed">;

/** A task's sign-off, present only on a `closed` task. */
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
  closed: { label: "Closed", tone: "success" },
  blocked: { label: "Blocked", tone: "warning" },
};

// `blocked` sits last — an exception state, not a stage in the flow (LLD §5).
export const TASK_STATUS_ORDER: TaskStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "done",
  "closed",
  "blocked",
];

/**
 * Statuses a person may drag a card into, or pick in a form.
 *
 * `closed` is deliberately absent: it is set by reviewing the task, never by moving it. Offering it
 * as a drop target would let the assignee mark their own work approved, which is the thing the
 * review step exists to prevent — and the server would refuse it anyway.
 */
export const TASK_STATUS_SETTABLE: TaskStatus[] = TASK_STATUS_ORDER.filter(
  (s) => s !== "closed",
);

/**
 * The statuses that mean the work is finished — mirrors `TaskStatus::is_open` in
 * `backend/crates/projects/src/shared/task.rs`.
 *
 * `closed` belongs here as much as `done`. It is the terminal state a task reaches once a
 * Manager/Lead signs it off through `POST /v1/projects/{id}/tasks/{task_id}/review`, and the
 * dashboard used to test `status !== "done"` in two places — so every reviewed task counted as open
 * work forever, inflating the Open Tasks tile and re-appearing under upcoming deadlines.
 */
export const FINISHED_TASK_STATUSES: readonly TaskStatus[] = ["done", "closed"];

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

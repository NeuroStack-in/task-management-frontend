/**
 * Projects & Tasks domain model (SPEC §7, PAGES §6–7).
 *
 * Tasks live INSIDE Projects — there is no standalone /tasks route (the page was
 * merged into Projects; see the handoff doc). These types are shared by the seed
 * script, the data accessors, and the UI.
 */

export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";

export interface Project {
  id: string;
  name: string;
  /** Optional one-paragraph brief shown on the project detail page. */
  description?: string;
  /** Short uppercase key, e.g. "WP" — used as a task prefix and card badge. */
  key: string;
  status: ProjectStatus;
  /** 0–100. */
  progress: number;
  leadUserId: string;
  /** Optional project manager (distinct from the delivery lead). */
  managerId?: string;
  memberIds: string[];
  department: string;
  budget: number;
  spent: number;
  /** ISO date strings (absolute — relative ranges are resolved at seed time). */
  startDate: string;
  dueDate: string;
  /** 7-point activity pulse (the WorkPulse motif), newest last. */
  velocity: number[];
}

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  estimateHours: number;
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
  archived: { label: "Archived", tone: "muted" },
};

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "active",
  "on_hold",
  "completed",
  "archived",
];

export interface TaskStatusMeta {
  label: string;
  tone: "muted" | "primary" | "warning" | "success";
}

export const TASK_STATUS_META: Record<TaskStatus, TaskStatusMeta> = {
  todo: { label: "To do", tone: "muted" },
  in_progress: { label: "In progress", tone: "primary" },
  in_review: { label: "In review", tone: "warning" },
  done: { label: "Done", tone: "success" },
};

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "done",
];

export const TASK_PRIORITY_META: Record<
  TaskPriority,
  { label: string; tone: "muted" | "warning" | "negative" }
> = {
  low: { label: "Low", tone: "muted" },
  medium: { label: "Medium", tone: "warning" },
  high: { label: "High", tone: "negative" },
};

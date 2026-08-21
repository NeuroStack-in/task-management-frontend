/**
 * Server-safe derivations & presentation helpers for Projects.
 *
 * No "use client" — pure functions + literal Tailwind class maps so both the
 * server page and the client views read from one place.
 */
import type { User } from "@/types/user";
import { personName } from "@/lib/format";
import type { ApiProjectMember } from "./services/projects.service";
import type { Project, Task, TaskAssignee, TaskStatus } from "./types";

const DAY = 86_400_000;

/**
 * **Today at UTC midnight.** Deadlines are real data now (not the old mock seed), so "days left" must
 * count from the actual current day — the previous fixed 2026-06-23 anchor made every deadline read
 * ~52 days off. UTC to match `formatDate`, which renders due dates in UTC (`getUTCDate`); computed
 * once at module load, not in a render path.
 */
export const TODAY = (() => {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
})();

export interface UserMini {
  id: string;
  name: string;
  avatarUrl?: string;
  jobTitle: string;
  /**
   * The membership survives but the person's `User` item is gone — a deleted employee.
   *
   * Set only by {@link membersToUserMap}, which is the one place that can tell: the server resolved
   * the name, looked, and found nothing. Real directory entries never carry it.
   */
  removed?: boolean;
}

/**
 * What a person-picker may offer: everyone in the map except deleted employees, name-sorted.
 *
 * Deleted people still appear in *historical* surfaces (a member list, an old assignee chip) because
 * their membership is a fact — but they must never be selectable. Assigning a project lead whose
 * identity has been purged writes a reference nothing can resolve, and the server would reject it
 * anyway once the membership is cleaned up.
 */
export function selectablePeople(map: Record<string, UserMini>): UserMini[] {
  return Object.values(map)
    .filter((u) => !u.removed)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The assignee list off a board task, falling back to the single `assignee_id` a task written
 * before assignments became their own rows still carries.
 *
 * Without the fallback every such task renders as unassigned for the length of the backfill — and,
 * worse, is then *offered to the whole project* as unclaimed work in the desktop picker. Shared by
 * both board readers so the two can't disagree about what an old task means.
 */
export function toAssignees(t: {
  assignees?: { user_id: string; assigned_by: string; assigned_at: number }[];
  assignee_id?: string;
}): TaskAssignee[] {
  if (t.assignees?.length) {
    return t.assignees.map((a) => ({
      userId: a.user_id,
      assignedBy: a.assigned_by,
      assignedAt: a.assigned_at,
    }));
  }
  return t.assignee_id
    ? [{ userId: t.assignee_id, assignedBy: "", assignedAt: 0 }]
    : [];
}

/** Slim, prop-friendly user lookup (avoids shipping the full user array). */
export function buildUserMap(users: User[]): Record<string, UserMini> {
  const map: Record<string, UserMini> = {};
  for (const u of users) {
    map[u.id] = {
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      jobTitle: u.jobTitle,
    };
  }
  return map;
}

/**
 * A project's own members as a user lookup — the names the **server** resolved onto each member row.
 *
 * This is the source every caller has, including an Employee. The alternative, `GET /v1/employees`,
 * needs `EmployeesRead`; an Employee 403s on it, so building names only from the directory left the
 * project's team dialog showing "—" for Lead/Manager and rows with no names. Merge this first and let
 * the directory (when the caller can read it) layer avatars and non-member people on top.
 *
 * The two ways a name can be missing are deliberately treated differently, because the frontend
 * deploys before the backend does:
 * - **`name` absent** — a server from before the field shipped. Contribute nothing and let the
 *   directory answer, exactly as before; otherwise every member would render as a raw ULID for the
 *   hours between the two deploys.
 * - **`name` empty** — the server looked and the `User` item is gone (a deleted employee whose
 *   membership row survives). Fall back to the id so a real membership is never invisible.
 */
export function membersToUserMap(members: ApiProjectMember[]): Record<string, UserMini> {
  const map: Record<string, UserMini> = {};
  for (const m of members) {
    if (m.name === undefined) continue;
    const name = m.name.trim();
    map[m.user_id] = {
      id: m.user_id,
      // Never the raw id. An empty name means the `User` item is gone, and a bare Cognito sub in the
      // UI tells the reader nothing while looking like a bug — which is exactly how it read in the
      // project-lead picker. Say what it is instead.
      name: personName(name),
      jobTitle: name ? (m.title ?? "") : "",
      ...(name ? {} : { removed: true as const }),
    };
  }
  return map;
}

/* ----------------------------- formatting ----------------------------- */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Whole days from today to the given ISO date (negative = past). Both normalised to UTC midnight so
 * a due date with a time component still counts exact calendar days. */
export function daysUntil(iso: string): number {
  const d = new Date(iso);
  const dueUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((dueUtc - TODAY) / DAY);
}

/** Human due-date label, e.g. "in 4d", "Today", "3d overdue". */
export function dueLabel(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: "No date", overdue: false };
  const d = daysUntil(iso);
  if (d === 0) return { text: "Today", overdue: false };
  if (d < 0) return { text: `${-d}d overdue`, overdue: true };
  if (d <= 6) return { text: `in ${d}d`, overdue: false };
  return { text: formatDate(iso), overdue: false };
}

/* ------------------------------- health ------------------------------- */

export type Tone = "primary" | "success" | "warning" | "muted" | "negative";

/** A project needing attention: live, but overdue and not yet finished. */
export function isAtRisk(p: Project): boolean {
  if (p.status !== "active" && p.status !== "on_hold") return false;
  return daysUntil(p.dueDate) < 0 && p.progress < 100;
}

export interface ProjectStats {
  total: number;
  active: number;
  atRisk: number;
  avgProgress: number;
  /** Aggregate pulse across active projects — feeds the featured KPI sparkline. */
  pulse: number[];
}

export function projectStats(projects: Project[]): ProjectStats {
  const active = projects.filter((p) => p.status === "active");
  const live = projects.filter((p) => p.status === "active" || p.status === "on_hold");
  const avgProgress = live.length
    ? Math.round(live.reduce((s, p) => s + p.progress, 0) / live.length)
    : 0;

  const pulse = [0, 0, 0, 0, 0, 0, 0];
  for (const p of active) p.velocity.forEach((v, i) => (pulse[i] += v));

  return {
    total: projects.length,
    active: active.length,
    atRisk: projects.filter(isAtRisk).length,
    avgProgress,
    // Real aggregate velocity, or `[]` when there's none — the Sparkline no-ops on an empty
    // series, so an org with no velocity shows no line rather than a fabricated rising one.
    pulse: pulse.some((v) => v > 0) ? pulse : [],
  };
}

/** An open task whose due date has already passed (excludes done & undated). */
export function isTaskOverdue(t: Task): boolean {
  if (!t.dueDate || t.status === "done") return false;
  return daysUntil(t.dueDate) < 0;
}

/** Counts per task status for one project's tasks. */
export function taskCounts(tasks: Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    todo: 0,
    in_progress: 0,
    in_review: 0,
    done: 0,
    closed: 0,
    blocked: 0,
  };
  for (const t of tasks) counts[t.status] += 1;
  return counts;
}

/**
 * May this caller delete this task? Mirrors `projects::delete_task` (backend LLD §5).
 *
 * - **Manager | Lead** — any task in the project. An org admin holding `projects:manage` arrives
 *   here as `manager`, because that override is what `GET /v1/projects/{id}` resolves it to.
 * - **Member** — only tasks they created. A task with no recorded `createdBy` (written before the
 *   server stored it) is not theirs: the server's `created_by = :me` condition fails it too, so
 *   offering the button would only produce a 403.
 *
 * This is UX, not security — the server re-decides on every DELETE. It exists so the card shows an
 * action that will actually work, rather than one that fails on click or is hidden when it wouldn't.
 */
export function canDeleteTask(
  task: Pick<Task, "createdBy">,
  authority: string,
  currentUserId: string | null | undefined,
): boolean {
  if (authority === "manager" || authority === "lead") return true;
  return Boolean(currentUserId && task.createdBy === currentUserId);
}

/**
 * May this person sign off this task?
 *
 * Mirrors the server's `can_review_task()` — Manager|Lead, which org admins and owners resolve
 * into — plus the two row-level rules the role cannot express:
 *
 * - only a task that is **done** is awaiting review; anything else has nothing to approve;
 * - **never your own task**, even as a Lead. Reviewing your own work is the thing review exists to
 *   prevent, so unlike deletion there is no "your own" fallback.
 *
 * The server enforces all three. This exists so the button is absent rather than present-and-403.
 */
export function canReviewTask(
  task: Pick<Task, "status" | "assignees">,
  authority: string,
  currentUserId: string | null | undefined,
): boolean {
  if (task.status !== "done") return false;
  if (authority !== "manager" && authority !== "lead") return false;
  // *Any* assignee, not just the first: with several people on a task, checking only the one the
  // card happens to show would let the second one approve work they did.
  return !(
    currentUserId && task.assignees.some((a) => a.userId === currentUserId)
  );
}

/* --------------------- tone → literal class maps ---------------------- */
/* Literal strings (not interpolated) so Tailwind keeps them at build.    */

export const toneText: Record<Tone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  muted: "text-muted-foreground",
  negative: "text-destructive",
};

export const toneDot: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-muted-foreground/60",
  negative: "bg-destructive",
};

export const toneBar: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-muted-foreground/50",
  negative: "bg-destructive",
};

export const toneSoft: Record<Tone, string> = {
  primary: "bg-accent text-accent-foreground",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  muted: "bg-muted text-muted-foreground",
  negative: "bg-destructive/12 text-destructive",
};

/** Left accent rail tint on cards. */
export const toneRail: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-border",
  negative: "bg-destructive",
};

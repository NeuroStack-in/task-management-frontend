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

/**
 * The board's headline numbers, counted one way so no two cards can disagree.
 *
 * **`total` is live work: it excludes `closed` and `blocked`.** A closed task is finished and
 * signed off — it has left the queue. A blocked one cannot be worked until something else moves, so
 * counting it as outstanding overstates what the team can actually pick up. Both are still shown,
 * on their own card, because "how much is parked" is a real question — just not the same question
 * as "how much is left".
 *
 * `total === done + open` always holds, which is what makes the card readable at a glance.
 */
export interface TaskTotals {
  /** Live work: todo + in progress + in review. Excludes done and blocked. */
  total: number;
  /** Signed off by a reviewer — finished and out of the queue. */
  done: number;
  /** todo + in progress + in review. */
  open: number;
  /** Waiting on something else; cannot be picked up. */
  blocked: number;
  /**
   * Finished work for **progress only**: `done + closed`.
   *
   * Closed counts here even though it is absent from `total`, and the two answer different
   * questions on purpose. `total` is *what is left to do*, so signed-off work has left it. Progress
   * is *how much of the work is finished*, and a task a reviewer approved is the most finished a
   * task can be. Counting it only in `total` made approving work push a project's percentage down —
   * a one-task project went 100% → 0% the moment it was signed off.
   */
  completed: number;
  /**
   * The denominator for progress: `completed + open` — everything except blocked.
   *
   * Blocked work is excluded because it cannot be advanced by the team; leaving it in would hold a
   * project's percentage down for a reason nobody on it can act on.
   */
  deliverable: number;
}

export function taskTotals(tasks: Pick<Task, "status">[]): TaskTotals {
  const c = taskCounts(tasks as Task[]);
  const open = c.todo + c.in_progress + c.in_review;
  // `done` is the only completed state since `closed` was retired, so it plays the role `closed`
  // used to: it leaves `total` (what is still to do) but counts toward `completed`.
  const completed = c.done;
  return {
    total: open,
    done: c.done,
    open,
    blocked: c.blocked,
    completed,
    deliverable: completed + open,
  };
}

/**
 * A project's short badge key, derived from its name — e.g. "Atlas Migration" → "AM".
 *
 * **This must never be able to fail.** There is no key field in the create form: the key is derived
 * silently, and the server requires 2–8 ASCII letters or digits. The old derivation took initials
 * *before* stripping punctuation, so a perfectly reasonable name could produce a key the API
 * rejected — and the user, who never typed a key, got "Key must be 2–8 letters or digits" with
 * nothing on screen to correct. Creating a project would simply refuse:
 *
 * - `"A/B Testing"`   → `"A/"` — a slash is not alphanumeric
 * - `"Q1"`            → `"Q1"` fine, but `"Q"` alone → one character
 * - `"日本語"`         → nothing usable at all
 *
 * So: strip to what the server accepts **first**, then take initials, then guarantee the length.
 * The key is a cosmetic badge; it must never be the reason a project cannot be created.
 */
export function deriveProjectKey(name: string): string {
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);
  const initials = words.length >= 2 ? words[0][0] + words[1][0] : "";
  const base = (initials || words[0] || "").slice(0, 8).toUpperCase();
  // One usable character, or none: pad rather than fail. "PRJ" is the last resort for a name with
  // no ASCII alphanumerics in it at all.
  return base.length >= 2 ? base : `${base}PRJ`.slice(0, 3).toUpperCase();
}

/** Counts per task status for one project's tasks. */
export function taskCounts(tasks: Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    todo: 0,
    in_progress: 0,
    in_review: 0,
    done: 0,
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
/**
 * The columns a reviewer may move **someone else's** task into.
 *
 * Sign-off (`done`) and parking work that cannot proceed (`blocked`) are the two judgements a lead
 * makes about a finished piece. Everything else — dragging a colleague's card back to `todo`,
 * "helpfully" advancing it to `in_progress` — is editing the record of their work, and a status is
 * a claim about what they did.
 */
export const REVIEWER_TARGETS: readonly TaskStatus[] = ["done", "blocked"];

/**
 * May this person move this task at all? (Is the card draggable?)
 *
 * Two ways to qualify, and they are different powers:
 *
 * - **An assignee** moves their own card through the board. Any column: it is their work, and
 *   describing its state is the point of the board. (`done` is still gated separately by
 *   {@link canSetTaskStatus} — sign-off is not something you award yourself.)
 * - **A Manager or Lead** may pick up someone else's card **only while it is in review** — the
 *   moment their judgement is actually being asked for. A colleague's `in_progress` card is not
 *   theirs to reposition.
 *
 * **Any assignee counts, not just the first.** A task with several people on it shows one avatar;
 * checking only that one would stop the second assignee moving work that is genuinely theirs.
 *
 * A UX mirror, not the boundary — the server refuses regardless. It exists so the card does not
 * lift, rather than sliding into a column and springing back when the 403 lands.
 */
export function canMoveTask(
  task: Pick<Task, "assignees" | "status">,
  authority: string,
  currentUserId: string | null | undefined,
): boolean {
  const mine = Boolean(
    currentUserId && task.assignees.some((a) => a.userId === currentUserId),
  );
  if (mine) return true;
  const reviewer = authority === "manager" || authority === "lead";
  return reviewer && task.status === "in_review";
}

/**
 * May this person move this task into **this** column?
 *
 * The drop-time half of {@link canMoveTask}. A reviewer holding someone else's reviewed card may
 * put it down in exactly two places; an assignee moving their own is bounded only by the sign-off
 * rule, which is checked separately so its message can say what it is.
 */
export function canMoveTaskTo(
  task: Pick<Task, "assignees" | "status">,
  authority: string,
  currentUserId: string | null | undefined,
  target: TaskStatus,
): boolean {
  if (!canMoveTask(task, authority, currentUserId)) return false;
  const mine = Boolean(
    currentUserId && task.assignees.some((a) => a.userId === currentUserId),
  );
  return mine || REVIEWER_TARGETS.includes(target);
}

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
 * - only a task that is **in review** is awaiting review; anything else has nothing to approve.
 *   (This was `done` until 2026-08-31, when `closed` was retired and `done` became the signed-off
 *   state. The column named *In review* is now the one where reviewing happens, which is what
 *   everyone expected it to mean in the first place.);
 * - **never your own task**, even as a Lead. Reviewing your own work is the thing review exists to
 *   prevent, so unlike deletion there is no "your own" fallback.
 *
 * The server enforces all three. This exists so the button is absent rather than present-and-403.
 */
/**
 * May this person move a task INTO `done`?
 *
 * `done` stopped being "the assignee says it's finished" on 2026-08-31 and became the signed-off
 * state, so it is the one column an assignee must not be able to reach for their own work. Every
 * other column stays draggable by whoever may manage the task.
 *
 * Mirrors the server's `update_task` gate (`can_review_task`), which is the real boundary — this
 * exists so the card refuses the drop instead of bouncing off a 403.
 */
export function canSetTaskStatus(
  next: TaskStatus,
  authority: string,
): boolean {
  if (next !== "done") return true;
  return authority === "manager" || authority === "lead";
}

export function canReviewTask(
  task: Pick<Task, "status" | "assignees">,
  authority: string,
  currentUserId: string | null | undefined,
): boolean {
  if (task.status !== "in_review") return false;
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

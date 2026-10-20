/**
 * Server-safe derivations & presentation helpers for Projects.
 *
 * No "use client" — pure functions + literal Tailwind class maps so both the
 * server page and the client views read from one place.
 */
import { personName } from "@/lib/format";
import type {
  ApiBoardColumn,
  ApiProjectMember,
  TaskPatch,
} from "./services/projects.service";
import type { TaskFormValues } from "./forms";
import { isOpenTaskStatus, type Project, type Task, type TaskAssignee, type TaskPriority, type TaskStatus } from "./types";

const DAY = 86_400_000;

/**
 * **Today — the user's own calendar date**, at UTC midnight so it compares directly with a
 * `YYYY-MM-DD` due date (which `new Date()` parses as UTC midnight, and `formatDate` renders in UTC).
 *
 * It was a module constant holding the **UTC** date: computed once at load, so a tab left open kept
 * yesterday's "today", and for part of every day outside UTC it disagreed with the date pickers'
 * local floor — in US Pacific a task due today read "1d overdue" from 5 pm, in India one due
 * yesterday read "Today" until 05:30 (QA audit 2026-10-08, WP-304). Read per call, from the local
 * clock. Only ever reached after a client-side load, so it can't split a server and client render.
 */
function todayUtc(): number {
  const n = new Date();
  return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
}

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
  /**
   * In the directory but unable to take part: deactivated (cannot sign in), or a monitored
   * employee with no login at all. Shown where they already are, never offered (WP-309).
   */
  inactive?: boolean;
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
    // Nor anyone deactivated or login-less: the server accepted them as manager or member, and the
    // deactivation saga that releases a leaver's projects had already run (QA audit WP-309).
    .filter((u) => !u.removed && !u.inactive)
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

const PRIORITIES: readonly TaskPriority[] = ["low", "medium", "high"];

/**
 * The board's columns as the page's `Task`s — one mapping for both readers (the project page and the
 * Projects list), so the two can't disagree about what a board row means.
 */
export function boardTasks(columns: ApiBoardColumn[], projectId: string): Task[] {
  return columns.flatMap((col) =>
    col.tasks.map((t) => ({
      id: t.id,
      projectId,
      title: t.title,
      description: t.description ?? "",
      status: col.status as TaskStatus,
      assignees: toAssignees(t),
      // Guarded, not cast: an unknown value would reach `TASK_PRIORITY_META[…]` and crash the card.
      priority: PRIORITIES.includes(t.priority as TaskPriority)
        ? (t.priority as TaskPriority)
        : "medium",
      dueDate: t.due ?? null,
      // Absent means unestimated, which is not an estimate of zero hours (QA audit 2026-10-08, WP-505).
      estimateHours: t.estimate_hours ?? null,
      createdBy: t.created_by ?? null,
      // A review is a verdict on finished work. Rows reopened before the server cleared it on leaving
      // Done still carry one, and it must not ride along into In progress (QA audit 2026-10-08, WP-313).
      review: col.status === "done" ? (t.review ?? null) : null,
      changes:
        col.status !== "done" && t.changes
          ? { byName: t.changes.by_name, at: t.changes.at, note: t.changes.note }
          : null,
      // A server predating subtasks omits this; an absent breakdown and an empty one are the same
      // thing to a card, so both collapse to zero.
      subtaskProgress: t.subtasks ?? { total: 0, done: 0 },
      attachments: (t.attachments ?? []).map((a) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.content_type,
        size: a.size,
      })),
    })),
  );
}

/**
 * The PATCH for an edit: **only what the form changed**, compared with the task as it was when the
 * dialog opened.
 *
 * The endpoint is a true PATCH, and the dialog used to send every field from that snapshot — so
 * fixing a typo in the title also re-sent the stale status, assignees and attachment set, reopening a
 * task a lead had signed off in the meantime and dropping files a teammate had attached (QA audit
 * 2026-10-08, WP-301). `null` when nothing changed: the server refuses an empty PATCH.
 */
export function taskPatchFrom(before: Task, v: TaskFormValues): TaskPatch | null {
  const patch: TaskPatch = {};
  if (v.title !== before.title) patch.title = v.title;
  if (v.description !== before.description) patch.description = v.description;
  if (v.status !== before.status) patch.status = v.status;
  // In order: the first assignee is the one older clients are shown.
  if (!sameList(v.assigneeIds, before.assignees.map((a) => a.userId))) {
    patch.assignee_ids = v.assigneeIds;
  }
  const due = v.dueDate || null;
  if (due !== (before.dueDate ? before.dueDate.slice(0, 10) : null)) patch.due = due;
  if (v.priority !== before.priority) patch.priority = v.priority;
  if (v.estimateHours !== before.estimateHours) patch.estimate_hours = v.estimateHours;
  // A set: sent whole when it changed at all, since a present list replaces the task's files.
  const ids = (list: { id: string }[]) => list.map((a) => a.id).sort();
  if (!sameList(ids(v.attachments), ids(before.attachments))) {
    patch.attachments = v.attachments;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
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
  return Math.round((dueUtc - todayUtc()) / DAY);
}

/**
 * Human due-date label, e.g. "in 4d", "Today", "3d overdue".
 *
 * `finished` work is never overdue — a signed-off task (or a completed project) past its date was
 * finished, not late, so it shows the date instead. The Done column was covered in red "5d overdue"
 * labels (QA audit 2026-10-08, WP-377).
 */
export function dueLabel(
  iso: string | null,
  finished = false,
): { text: string; overdue: boolean } {
  if (!iso) return { text: "No date", overdue: false };
  const d = daysUntil(iso);
  if (finished && d < 0) return { text: formatDate(iso), overdue: false };
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
  // No end date (the server makes it optional) is no deadline to miss.
  if (!p.dueDate) return false;
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
export function isTaskOverdue(t: Pick<Task, "dueDate" | "status">): boolean {
  if (!t.dueDate || !isOpenTaskStatus(t.status)) return false;
  return daysUntil(t.dueDate) < 0;
}

/**
 * The board's headline numbers, counted one way so no two cards can disagree.
 *
 * **`total` is live work: it excludes `done` and `blocked`.** A done task is finished and signed
 * off — it has left the queue. A blocked one cannot be worked until something else moves, so
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
   * Finished work for **progress only**: `done` (which absorbed the retired `closed`).
   *
   * Done counts here even though it is absent from `total`, and the two answer different
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
  /**
   * Progress 0–100, **weighted by how far each task has got** rather than counting only the
   * finished ones.
   *
   * A project of three tasks all in review used to read 0%: nothing was signed off, so nothing
   * counted, and a board that had visibly moved for a fortnight showed no movement at all. Under
   * {@link STATUS_WEIGHT} the same board reads 75% — which is what the columns are already saying.
   *
   * Blocked work is excluded from the denominator entirely, not scored zero: it cannot be advanced
   * by the team, so holding the percentage down for it punishes people for something they cannot
   * act on. A project where everything is blocked has no meaningful progress and reads 0.
   */
  progressPct: number;
}

/**
 * How far each column counts toward progress, out of 100.
 *
 * **Mirrors `STATUS_WEIGHT` in `backend/crates/projects/src/features/kpi/data.rs`.** The server
 * computes the same number for the dashboard; if these two drift, the same project shows two
 * different percentages on two screens and neither is obviously wrong.
 *
 * The middle values are a judgement (owner decision, revised 2026-09-01 from 25/75). Starting a
 * task books **35** — a third of the way, because getting a card moving is more than a token step
 * even though most of the work is still ahead. Reaching review books **90**: the work is finished
 * as far as its author is concerned and the only thing left is somebody else's sign-off, so the
 * remaining ten points measure the review, not the work.
 *
 * The owner asked for 30–40 on in-progress; **35 is the midpoint**, and it is a one-line change
 * here and in the server mirror if a different point in that range is wanted.
 *
 * `blocked` has no weight because it never reaches the sum — it is excluded from the denominator.
 */
export const STATUS_WEIGHT: Record<Exclude<TaskStatus, "blocked">, number> = {
  todo: 0,
  in_progress: 35,
  in_review: 90,
  done: 100,
};

export function taskTotals(tasks: Pick<Task, "status">[]): TaskTotals {
  const c = taskCounts(tasks as Task[]);
  const open = c.todo + c.in_progress + c.in_review;
  // `done` is the only completed state since `closed` was retired, so it plays the role `closed`
  // used to: it leaves `total` (what is still to do) but counts toward `completed`.
  const completed = c.done;
  const deliverable = completed + open;
  // Weighted, not counted. Every non-blocked task contributes its column's weight, so moving a card
  // forward moves the number — which is the whole reason a board has columns between the ends.
  const earned =
    c.todo * STATUS_WEIGHT.todo +
    c.in_progress * STATUS_WEIGHT.in_progress +
    c.in_review * STATUS_WEIGHT.in_review +
    c.done * STATUS_WEIGHT.done;
  return {
    total: open,
    done: c.done,
    open,
    blocked: c.blocked,
    completed,
    deliverable,
    // Round to nearest — 2 of 3 done reads 67%, not 66%.
    progressPct: deliverable ? Math.round(earned / deliverable) : 0,
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
 * Where **any project member** may put a card — the working columns.
 *
 * These three are a shared account of where the work actually is, so anyone on the project keeps
 * them honest. It used to take being the card's assignee: a member watching a teammate's finished
 * work sit in `in_progress` had to go and find that teammate, and "I picked this up" needed a
 * reassignment before it could be said. Owner decision, 2026-09-01.
 */
export const MEMBER_TARGETS: readonly TaskStatus[] = [
  "todo",
  "in_progress",
  "in_review",
];

/**
 * The two columns that need a **Manager or Lead**, on anyone's card including their own.
 *
 * Neither is a report of where the work is; both are judgements about it:
 *
 * - `done` — signed off. The fuller path is the review dialog, which also records who approved it
 *   and what they rated it; dragging here reaches the same state with neither, which is why it
 *   takes the same authority.
 * - `blocked` — cannot proceed. It also removes the task from the progress denominator entirely,
 *   so an assignee could otherwise park their own work where it stops counting against the project
 *   and nobody is asked why.
 *
 * Mirrors the server's `TaskStatus::is_oversight_only` + `can_review_task`. `closed` is not here
 * because it is retired: the server parses it onto `done` and rejects it by name on a PATCH.
 */
export const OVERSIGHT_TARGETS: readonly TaskStatus[] = ["done", "blocked"];

/** Manager or Lead — the roles the server resolves `projects:manage` and ownership into. */
function isReviewer(authority: string): boolean {
  return authority === "manager" || authority === "lead";
}

/**
 * Anyone **on** the project — Manager, Lead or Member — who may add, edit and move its tasks.
 *
 * Not `viewer`: that is org-wide project oversight without membership (`projects:read` at org
 * scope), which the server lets read every project and change nothing (QA audit 2026-10-08, WP-302).
 */
export function canWorkOnTasks(authority: string): boolean {
  return authority === "manager" || authority === "lead" || authority === "member";
}

/**
 * May this person move this task at all? (Is the card draggable?)
 *
 * **Anyone on the project.** Only members can load a board — a non-member gets a 404 — so a
 * resolved `authority` is itself proof of membership, and the target column decides the rest.
 * A card that will not lift for a valid drop is worse than one that lifts and is refused, and the
 * refusals now live entirely in {@link canMoveTaskTo}.
 *
 * A UX mirror, not the boundary — the server re-decides on every PATCH.
 */
export function canMoveTask(
  _task: Pick<Task, "assignees" | "status">,
  authority: string,
  _currentUserId: string | null | undefined,
): boolean {
  // A `viewer` reads the board without being on the project — nothing lifts for them.
  return canWorkOnTasks(authority);
}

/**
 * May this person move this task into **this** column? The drop-time half of {@link canMoveTask}.
 *
 * The target decides, not the ownership of the card: the three working columns are open to every
 * member, and {@link OVERSIGHT_TARGETS} needs a Manager or Lead.
 */
export function canMoveTaskTo(
  task: Pick<Task, "assignees" | "status">,
  authority: string,
  currentUserId: string | null | undefined,
  target: TaskStatus,
): boolean {
  if (!canMoveTask(task, authority, currentUserId)) return false;
  // Never by a move: Done is reached only through a review (`canReviewTask`), which the board opens
  // when a card is dropped there (owner rule, 2026-10-16). The server refuses the PATCH outright.
  if (target === "done") return false;
  return OVERSIGHT_TARGETS.includes(target)
    ? isReviewer(authority)
    : MEMBER_TARGETS.includes(target);
}

/**
 * The statuses this person may put a task in from the task form — the same rule as a drop on the
 * board ({@link canMoveTaskTo}): the working columns for anyone on the project, `blocked` for a
 * Manager or Lead, and **`done` for nobody** — it is reached only through a review (owner rule,
 * 2026-10-16). A task already sitting in one of those keeps it as an option, since the server gates
 * only a *change* into them.
 *
 * The form used to offer all five to everyone, so a Member who picked Done lost the whole edit to a
 * 403 (QA audit 2026-10-08, WP-300).
 */
export function settableStatuses(authority: string, current?: TaskStatus): TaskStatus[] {
  const reviewer = isReviewer(authority);
  return [...MEMBER_TARGETS, ...OVERSIGHT_TARGETS].filter(
    (s) =>
      s === current || (s !== "done" && (reviewer || MEMBER_TARGETS.includes(s))),
  );
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
  // A `viewer` deletes nothing, even a task they created while still a member (WP-302).
  if (!canWorkOnTasks(authority)) return false;
  return Boolean(currentUserId && task.createdBy === currentUserId);
}

/**
 * May this person sign off this task?
 *
 * Mirrors `review_task`: `role` is the person's **own** role on the project — their member row, not
 * the resolved `authority`, because an org admin resolves to `manager` everywhere and only the
 * project's own lead or manager reviews (owner rule, 2026-10-16). Then the two row-level rules the
 * role cannot express:
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
export function canReviewTask(
  task: Pick<Task, "status" | "assignees">,
  role: string,
  currentUserId: string | null | undefined,
): boolean {
  if (task.status !== "in_review") return false;
  if (role !== "manager" && role !== "lead") return false;
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

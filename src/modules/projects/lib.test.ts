import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { STATUS_WEIGHT, boardTasks, canDeleteTask, canMoveTask, canMoveTaskTo, canReviewTask, daysUntil, deriveProjectKey, dueLabel, isTaskOverdue, settableStatuses, taskPatchFrom, taskTotals, toAssignees } from "./lib";
import type { Task, TaskStatus } from "./types";
import type { TaskFormValues } from "./forms";
import type { ApiBoardTask } from "./services/projects.service";

/**
 * The delete rule, as an executable statement. It mirrors `projects::delete_task` on the server —
 * if these expectations and the Rust handler ever disagree, the UI is the one that's wrong, since
 * the server re-decides on every DELETE.
 */
describe("canDeleteTask", () => {
  const mine = { createdBy: "u-me" };
  const theirs = { createdBy: "u-someone-else" };

  it("lets a member delete a task they created", () => {
    expect(canDeleteTask(mine, "member", "u-me")).toBe(true);
  });

  it("stops a member deleting someone else's task", () => {
    expect(canDeleteTask(theirs, "member", "u-me")).toBe(false);
  });

  it("lets a lead or manager delete anyone's task", () => {
    expect(canDeleteTask(theirs, "lead", "u-me")).toBe(true);
    expect(canDeleteTask(theirs, "manager", "u-me")).toBe(true);
  });

  /**
   * An org admin holding `projects:manage` isn't a project member at all — the server resolves the
   * override to `manager` and returns that as the project detail's `authority`, which is exactly
   * why this function reads the server's answer instead of re-deriving one from org permissions.
   */
  it("treats the admin override as manager, since that's what the server returns", () => {
    expect(canDeleteTask(theirs, "manager", "u-admin")).toBe(true);
  });

  /**
   * Tasks written before the server recorded `created_by` have no author. Fail closed: the server's
   * `created_by = :me` condition rejects them for a member too, so offering the button would only
   * produce a 403.
   */
  it("treats unknown authorship as not-yours for a member", () => {
    expect(canDeleteTask({ createdBy: null }, "member", "u-me")).toBe(false);
    expect(canDeleteTask({ createdBy: undefined }, "member", "u-me")).toBe(false);
  });

  /** A signed-out/unhydrated caller must never match a task whose author is also absent. */
  it("never matches an unknown caller against an unknown author", () => {
    expect(canDeleteTask({ createdBy: null }, "member", null)).toBe(false);
    expect(canDeleteTask(mine, "member", null)).toBe(false);
  });
});

/**
 * Two people share a task; both did the work; neither may sign it off. The server enforces the same
 * rule against the full assignment set, so a UI that offered the button to the second assignee
 * would only produce a `cannot_review_own_task` conflict.
 */
describe("canMoveTask / canMoveTaskTo", () => {
  const a = (id: string) => ({ userId: id, assignedBy: "u-lead", assignedAt: 1 });
  const task = (status: TaskStatus, ...ids: string[]) => ({
    status,
    assignees: ids.map(a),
  });

  /**
   * **The target column decides, not who owns the card** (owner decision, 2026-09-01).
   *
   * This block used to assert the opposite at every turn: a member could move only their own card,
   * and a lead could pick up someone else's only while it sat in review. The board that produced
   * was one nobody could keep tidy — a member looking at a teammate's finished work stuck in
   * `in_progress` had to go and find that teammate, and "I've picked this up" needed a
   * reassignment before it could be said.
   */
  it("lets any project member move any card between the working columns", () => {
    const theirs = task("in_progress", "u-other");
    expect(canMoveTask(theirs, "member", "u-me")).toBe(true);
    for (const to of ["todo", "in_progress", "in_review"] as TaskStatus[]) {
      expect(canMoveTaskTo(theirs, "member", "u-me", to), to).toBe(true);
    }
  });

  it("stops a member marking anything done or blocked — their own included", () => {
    // Neither is a report of where the work is; both are judgements about it. Marking your own
    // task done is what review exists to prevent, and marking it blocked parks it somewhere it
    // stops counting against the project with nobody asked why.
    for (const owner of ["u-me", "u-other"]) {
      const t = task("in_review", owner);
      expect(canMoveTaskTo(t, "member", "u-me", "done"), owner).toBe(false);
      expect(canMoveTaskTo(t, "member", "u-me", "blocked"), owner).toBe(false);
    }
  });

  it("lets a lead or manager block any card, and nobody move one to Done", () => {
    for (const role of ["lead", "manager", "member"]) {
      for (const from of ["todo", "in_progress", "in_review"] as TaskStatus[]) {
        const t = task(from, "u-other");
        // Done is reached only through a review — the board opens it on a drop (2026-10-16).
        expect(canMoveTaskTo(t, role, "u-me", "done"), `${role}/${from}`).toBe(false);
        expect(canMoveTaskTo(t, role, "u-me", "blocked"), `${role}/${from}`).toBe(role !== "member");
      }
    }
  });

  /**
   * The only door into Done is the review, so "never review your own work" holds there too: a lead
   * can neither drag their own card to Done nor sign it off.
   */
  it("gives a lead no way to finish their own task", () => {
    const mine = task("in_review", "u-lead");
    expect(canMoveTaskTo(mine, "lead", "u-lead", "done")).toBe(false);
    expect(canReviewTask(mine, "lead", "u-lead")).toBe(false);
  });

  /** An unassigned legacy card is still movable — it is the state most in need of correcting. */
  it("moves a card with nobody on it, and refuses a viewer with no project role", () => {
    expect(canMoveTask(task("in_progress"), "member", "u-me")).toBe(true);
    expect(canMoveTask(task("in_progress", "u-me"), "member", null)).toBe(true);
    // No resolved authority means the board never loaded a role — not a member.
    expect(canMoveTask(task("in_progress", "u-me"), "", "u-me")).toBe(false);
  });
});

describe("canReviewTask with several assignees", () => {
  const shared = {
    // `in_review` is the reviewable state since `closed` was retired on 2026-08-31.
    status: "in_review" as const,
    assignees: [
      { userId: "u-a", assignedBy: "u-lead", assignedAt: 1 },
      { userId: "u-b", assignedBy: "u-lead", assignedAt: 2 },
    ],
  };

  it("refuses every assignee, not just the first", () => {
    expect(canReviewTask(shared, "lead", "u-a")).toBe(false);
    expect(canReviewTask(shared, "lead", "u-b")).toBe(false);
  });

  it("still lets an uninvolved lead sign it off", () => {
    expect(canReviewTask(shared, "lead", "u-lead")).toBe(true);
  });

  it("lets anyone review an unassigned task", () => {
    expect(canReviewTask({ status: "in_review", assignees: [] }, "lead", "u-a")).toBe(true);
  });

  it("reviews from `in_review`, not `done` — `done` is the outcome, not the queue", () => {
    const t = (status: string) => ({ status, assignees: [] }) as never;
    expect(canReviewTask(t("in_review"), "lead", "u-lead")).toBe(true);
    // Already signed off: there is nothing left to approve.
    expect(canReviewTask(t("done"), "lead", "u-lead")).toBe(false);
    expect(canReviewTask(t("in_progress"), "lead", "u-lead")).toBe(false);
  });
});

/**
 * The backfill window: tasks written before assignments became their own rows arrive with only
 * `assignee_id`. Dropping that would render them unassigned — and an unassigned task is now
 * *offered to the whole project*, so the fallback is what stops someone else's work appearing in
 * every teammate's desktop picker.
 */
describe("toAssignees", () => {
  it("prefers the assignment rows when present", () => {
    expect(
      toAssignees({
        assignees: [{ user_id: "u-a", assigned_by: "u-lead", assigned_at: 42 }],
        assignee_id: "u-stale",
      }),
    ).toEqual([{ userId: "u-a", assignedBy: "u-lead", assignedAt: 42 }]);
  });

  it("falls back to the legacy single assignee, with no invented assigner", () => {
    expect(toAssignees({ assignee_id: "u-a" })).toEqual([
      { userId: "u-a", assignedBy: "", assignedAt: 0 },
    ]);
  });

  it("reads a genuinely unassigned task as empty", () => {
    expect(toAssignees({})).toEqual([]);
    expect(toAssignees({ assignees: [] })).toEqual([]);
  });
});

describe("taskTotals", () => {
  const t = (status: string) => ({ status }) as never;

  it("excludes done and blocked from the total", () => {
    // `closed` was retired 2026-08-31; `done` is the signed-off state and plays its part here.
    const r = taskTotals([
      t("in_progress"),
      t("done"),
      t("done"),
      t("blocked"),
      t("blocked"),
    ]);
    expect(r.total).toBe(1);
    expect(r.open).toBe(1);
    expect(r.done).toBe(2);
    expect(r.blocked).toBe(2);
  });

  it("keeps total === open, so the card cannot contradict itself", () => {
    const r = taskTotals([t("todo"), t("in_review"), t("done"), t("blocked")]);
    expect(r.total).toBe(r.open);
  });

  it("counts nothing as live work when everything is done or blocked", () => {
    const r = taskTotals([t("done"), t("blocked")]);
    expect(r.total).toBe(0);
  });
});

describe("deriveProjectKey", () => {
  it("keeps the keys the existing projects already show", () => {
    expect(deriveProjectKey("Atlas Migration")).toBe("AM");
    expect(deriveProjectKey("SDE Main Project")).toBe("SM");
    expect(deriveProjectKey("Gen AI Intern Project")).toBe("GA");
    expect(deriveProjectKey("UI/UX Intern Project")).toBe("UI");
  });

  it("never produces a key the server would reject", () => {
    // The server's rule: 2–8 ASCII letters or digits. These names all used to break creation.
    const names = ["A", "A/B", "日本語", "#1 Project", "  ", "!!!", "Q", "x"];
    for (const n of names) {
      const k = deriveProjectKey(n);
      expect(k).toMatch(/^[A-Z0-9]{2,8}$/);
    }
  });

  it("falls back to PRJ when a name has nothing usable in it", () => {
    expect(deriveProjectKey("日本語")).toBe("PRJ");
    expect(deriveProjectKey("!!!")).toBe("PRJ");
  });

  it("pads a single usable character rather than failing", () => {
    expect(deriveProjectKey("A")).toBe("APR");
  });
});

describe("taskTotals — progress vs what's left", () => {
  const t = (status: string) => ({ status }) as never;

  it("counts done as completed for progress, but not in the total", () => {
    // 1 in progress, 2 signed off, 2 blocked.
    const r = taskTotals([
      t("in_progress"),
      t("done"),
      t("done"),
      t("blocked"),
      t("blocked"),
    ]);
    expect(r.total).toBe(1); // what's left to do
    expect(r.completed).toBe(2); // 2 signed off
    expect(r.deliverable).toBe(3); // 2 done + 1 in progress; blocked excluded
    expect(Math.round((r.completed / r.deliverable) * 100)).toBe(67);
  });

  it("signing off work never lowers progress — the bug this exists to prevent", () => {
    // Before: waiting on a reviewer. After: they signed it off.
    const beforeReview = taskTotals([t("in_review")]);
    const afterReview = taskTotals([t("done")]);
    const pct = (r: ReturnType<typeof taskTotals>) =>
      r.deliverable ? Math.round((r.completed / r.deliverable) * 100) : 0;
    expect(pct(beforeReview)).toBe(0); // not finished until someone says so
    expect(pct(afterReview)).toBe(100);
  });

  it("a fully signed-off project reads 100%, not 0%", () => {
    const r = taskTotals([t("done"), t("done"), t("done")]);
    expect(r.total).toBe(0);
    expect(r.completed).toBe(3);
    expect(Math.round((r.completed / r.deliverable) * 100)).toBe(100);
  });
});

describe("weighted progress", () => {
  const t = (status: string) => ({ status }) as never;

  it("scores the ends at 0 and 100", () => {
    expect(taskTotals([t("todo")]).progressPct).toBe(0);
    expect(taskTotals([t("done")]).progressPct).toBe(100);
  });

  it("credits work that has moved but is not finished", () => {
    // The case that prompted this: a board sitting entirely in review used to read 0%, because
    // nothing was signed off. It had visibly moved for a fortnight.
    expect(taskTotals([t("in_review")]).progressPct).toBe(90);
    expect(taskTotals([t("in_progress")]).progressPct).toBe(35);
    expect(taskTotals([t("todo"), t("done")]).progressPct).toBe(50);
  });

  it("leaves blocked work out of the denominator rather than scoring it zero", () => {
    // Blocked cannot be advanced by the team, so counting it would mark them down for something
    // they cannot act on. One done + one blocked is 100%, not 50%.
    expect(taskTotals([t("done"), t("blocked")]).progressPct).toBe(100);
    // ...and a project that is nothing but blocked has no progress to report.
    expect(taskTotals([t("blocked"), t("blocked")]).progressPct).toBe(0);
  });

  it("rounds to nearest, so 2 of 3 done reads 67", () => {
    expect(taskTotals([t("done"), t("done"), t("todo")]).progressPct).toBe(67);
  });

  it("is empty-safe", () => {
    expect(taskTotals([]).progressPct).toBe(0);
  });

  /**
   * The weights are duplicated in `backend/crates/projects/src/features/kpi/data.rs`, because the
   * server computes the same percentage for the project card's bar. This pins the numbers so a
   * change here is a visibly deliberate act that has to be mirrored, rather than a quiet edit that
   * makes one screen disagree with another.
   */
  it("uses the weights the server mirrors", () => {
    expect(STATUS_WEIGHT).toEqual({
      todo: 0,
      in_progress: 35,
      in_review: 90,
      done: 100,
    });
  });
});

/**
 * "Today" is the user's own calendar day, read when asked (WP-304). Built from local-time `Date`s
 * so these hold in whatever zone the suite runs in — the old UTC module constant failed them in
 * most of the world, and failed the rollover everywhere.
 */
describe("due dates against today", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("counts a task due today as today, late into the local evening", () => {
    vi.setSystemTime(new Date(2026, 9, 8, 23, 30));
    expect(daysUntil("2026-10-08")).toBe(0);
    expect(dueLabel("2026-10-08")).toEqual({ text: "Today", overdue: false });
  });

  it("rolls over at local midnight without a reload", () => {
    vi.setSystemTime(new Date(2026, 9, 8, 12, 0));
    expect(daysUntil("2026-10-08")).toBe(0);
    vi.setSystemTime(new Date(2026, 9, 9, 0, 5));
    expect(daysUntil("2026-10-08")).toBe(-1);
    expect(dueLabel("2026-10-08")).toEqual({ text: "1d overdue", overdue: true });
  });

  /** WP-377: signed-off work past its date was finished, not late. */
  it("never calls finished work overdue", () => {
    vi.setSystemTime(new Date(2026, 9, 13, 9, 0));
    expect(dueLabel("2026-10-08", true)).toEqual({ text: "Oct 8", overdue: false });
    expect(isTaskOverdue({ dueDate: "2026-10-08", status: "done" })).toBe(false);
    expect(isTaskOverdue({ dueDate: "2026-10-08", status: "in_review" })).toBe(true);
  });
});

describe("taskPatchFrom — only what the edit changed (WP-301)", () => {
  const before: Task = {
    id: "k1",
    projectId: "p1",
    title: "Ship it",
    description: "",
    status: "in_progress",
    assignees: [
      { userId: "u-a", assignedBy: "u-lead", assignedAt: 1 },
      { userId: "u-b", assignedBy: "u-lead", assignedAt: 2 },
    ],
    priority: "medium",
    dueDate: "2026-10-20",
    estimateHours: 2,
    attachments: [
      { id: "att-1", filename: "a.pdf", contentType: "application/pdf", size: 1 },
      { id: "att-2", filename: "b.png", contentType: "image/png", size: 2 },
    ],
    subtaskProgress: { total: 0, done: 0 },
  };
  const unchanged: TaskFormValues = {
    title: "Ship it",
    description: "",
    status: "in_progress",
    assigneeIds: ["u-a", "u-b"],
    priority: "medium",
    dueDate: "2026-10-20",
    estimateHours: 2,
    attachments: [
      { id: "att-2", filename: "b.png", content_type: "image/png", size: 2 },
      { id: "att-1", filename: "a.pdf", content_type: "application/pdf", size: 1 },
    ],
  };

  it("sends nothing when nothing changed — the server refuses an empty PATCH", () => {
    expect(taskPatchFrom(before, unchanged)).toBeNull();
  });

  /** The bug: a title fix re-sent the stale status, assignees and files from the dialog's snapshot. */
  it("sends a title fix as just the title", () => {
    expect(taskPatchFrom(before, { ...unchanged, title: "Ship it now" })).toEqual({
      title: "Ship it now",
    });
  });

  it("sends the whole set when the assignees or files change, and clears with null", () => {
    expect(
      taskPatchFrom(before, {
        ...unchanged,
        assigneeIds: ["u-b", "u-a"],
        attachments: [],
        dueDate: null,
        estimateHours: null,
      }),
    ).toEqual({
      assignee_ids: ["u-b", "u-a"],
      attachments: [],
      due: null,
      estimate_hours: null,
    });
  });
});

describe("boardTasks", () => {
  const row = (over: Partial<ApiBoardTask> = {}): ApiBoardTask => ({
    id: "k1",
    title: "T",
    priority: "medium",
    review: {
      reviewed_by: "u-lead",
      reviewer_name: "Priya",
      reviewed_at: 1,
      rating: 4,
    },
    ...over,
  });

  /** WP-313: a review left on a reopened row is not a verdict on the work now in progress. */
  it("keeps a review only on a task in Done", () => {
    const [inProgress, done] = boardTasks(
      [
        { status: "in_progress", tasks: [row({ id: "k1" })] },
        { status: "done", tasks: [row({ id: "k2" })] },
      ],
      "p1",
    );
    expect(inProgress.review).toBeNull();
    expect(done.review?.reviewer_name).toBe("Priya");
  });

  it("reads an absent estimate as none, and an unknown priority as medium", () => {
    const [t] = boardTasks([{ status: "todo", tasks: [row({ priority: "urgent" })] }], "p1");
    expect(t.estimateHours).toBeNull();
    expect(t.priority).toBe("medium");
  });
});

describe("settableStatuses (WP-300)", () => {
  it("offers a member the working columns only", () => {
    expect(settableStatuses("member")).toEqual(["todo", "in_progress", "in_review"]);
  });

  it("keeps a member's task's current oversight status selectable", () => {
    expect(settableStatuses("member", "blocked")).toEqual([
      "todo",
      "in_progress",
      "in_review",
      "blocked",
    ]);
  });

  it("offers a lead or manager everything but Done, which only a review reaches", () => {
    for (const role of ["lead", "manager"]) {
      expect(settableStatuses(role)).toEqual(["todo", "in_progress", "in_review", "blocked"]);
    }
  });

  it("keeps Done selectable on a task that is already done, so editing it doesn't reopen it", () => {
    expect(settableStatuses("member", "done")).toContain("done");
    expect(settableStatuses("lead", "done")).toContain("done");
  });
});

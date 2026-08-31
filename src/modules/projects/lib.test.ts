import { describe, expect, it } from "vitest";

import { canDeleteTask, canReviewTask, deriveProjectKey, taskTotals, toAssignees } from "./lib";

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

import { describe, expect, it } from "vitest";

import { canDeleteTask, canReviewTask, toAssignees } from "./lib";

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
    status: "done" as const,
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
    expect(canReviewTask({ status: "done", assignees: [] }, "lead", "u-a")).toBe(true);
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

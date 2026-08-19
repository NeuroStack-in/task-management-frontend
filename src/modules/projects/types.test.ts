import { describe, expect, it } from "vitest";
import {
  FINISHED_TASK_STATUSES,
  TASK_STATUS_ORDER,
  TASK_STATUS_SETTABLE,
  isOpenTaskStatus,
} from "./types";

/**
 * The done/closed distinction, pinned.
 *
 * `closed` is reachable only through the review endpoint, and two dashboard surfaces used to test
 * `status !== "done"` — so a signed-off task stayed in "My tasks" as open work forever and kept
 * appearing under upcoming deadlines. These are cheap tests for an expensive mistake.
 */
describe("isOpenTaskStatus", () => {
  it("treats work in flight as open", () => {
    for (const s of ["todo", "in_progress", "in_review", "blocked"]) {
      expect(isOpenTaskStatus(s), `${s} should be open`).toBe(true);
    }
  });

  it("treats both finished states as closed out — done AND closed", () => {
    expect(isOpenTaskStatus("done")).toBe(false);
    expect(isOpenTaskStatus("closed")).toBe(false);
  });

  it("keeps an unrecognised status visible rather than dropping it", () => {
    // A status this build doesn't know must stay chaseable in the UI; silently hiding it is how a
    // task goes missing with nothing to notice.
    expect(isOpenTaskStatus("archived_by_some_future_build")).toBe(true);
  });

  it("agrees with FINISHED_TASK_STATUSES for every status on the board", () => {
    for (const s of TASK_STATUS_ORDER) {
      expect(isOpenTaskStatus(s)).toBe(!FINISHED_TASK_STATUSES.includes(s));
    }
  });
});

describe("task status catalog", () => {
  it("never offers `closed` as something a person can set by hand", () => {
    // Only `review_task` may set it — offering it in a form or as a drop target would let an
    // assignee approve their own work.
    expect(TASK_STATUS_SETTABLE).not.toContain("closed");
    expect(TASK_STATUS_ORDER).toContain("closed");
  });
});

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

  it("treats done as finished, and in_review as still open", () => {
    // `closed` was retired 2026-08-31: `done` is the signed-off state, and `in_review` is the one
    // waiting on a person — so it is emphatically NOT finished, however complete the work looks.
    expect(isOpenTaskStatus("done")).toBe(false);
    expect(isOpenTaskStatus("in_review")).toBe(true);
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
  it("has retired `closed` from the board entirely", () => {
    expect(TASK_STATUS_ORDER).not.toContain("closed");
    expect(TASK_STATUS_SETTABLE).not.toContain("closed");
  });

  it("offers every remaining column, because who may set `done` is a fact about the person", () => {
    // `done` IS settable — by a Manager or Lead. That is `canSetTaskStatus`, not a list: encoding
    // it here would have to answer "settable by whom", which a catalog cannot.
    expect(TASK_STATUS_SETTABLE).toEqual([...TASK_STATUS_ORDER]);
    expect(TASK_STATUS_SETTABLE).toContain("done");
  });
});

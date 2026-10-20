import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import {
  alsoOff,
  balanceAfter,
  decisionError,
  rangesOverlap,
  sortQueue,
  startsLabel,
} from "./queue";

const item = (
  requestId: string,
  userId: string,
  status: string,
  from: string,
  to = from,
  createdAt = 0,
) => ({ requestId, userId, status, from, to, createdAt });

describe("sortQueue (TIME-10)", () => {
  it("puts pending first, soonest start first, then history newest-first", () => {
    const sorted = sortQueue([
      item("a", "u1", "approved", "2026-09-01"),
      item("b", "u2", "pending", "2026-12-01", "2026-12-01", 1),
      item("c", "u3", "pending", "2026-10-22", "2026-10-22", 5),
      item("d", "u4", "rejected", "2026-11-01"),
      item("e", "u5", "pending", "2026-10-22", "2026-10-23", 2),
    ]);
    expect(sorted.map((x) => x.requestId)).toEqual(["e", "c", "b", "d", "a"]);
  });
});

describe("startsLabel", () => {
  it("says how soon a request starts, in words", () => {
    expect(startsLabel("2026-10-20", "2026-10-20")).toBe("Starts today");
    expect(startsLabel("2026-10-21", "2026-10-20")).toBe("Starts tomorrow");
    expect(startsLabel("2026-11-02", "2026-10-20")).toBe("Starts in 13 days");
    expect(startsLabel("2026-10-19", "2026-10-20")).toBe("Started yesterday");
    expect(startsLabel("2026-10-13", "2026-10-20")).toBe("Started 7 days ago");
  });

  it("crosses a year boundary and refuses junk", () => {
    expect(startsLabel("2027-01-01", "2026-12-31")).toBe("Starts tomorrow");
    expect(startsLabel("nope", "2026-12-31")).toBeNull();
  });
});

describe("rangesOverlap / alsoOff", () => {
  it("treats ranges as inclusive", () => {
    expect(
      rangesOverlap(
        { from: "2026-10-20", to: "2026-10-22" },
        { from: "2026-10-22", to: "2026-10-25" },
      ),
    ).toBe(true);
    expect(
      rangesOverlap(
        { from: "2026-10-20", to: "2026-10-21" },
        { from: "2026-10-22", to: "2026-10-25" },
      ),
    ).toBe(false);
  });

  it("lists other people's approved and pending leave on the same dates only", () => {
    const me = item("me", "u1", "pending", "2026-10-26", "2026-10-28");
    const all = [
      me,
      item("mine-too", "u1", "approved", "2026-10-27"), // the requester's own — not cover
      item("p", "u2", "pending", "2026-10-28", "2026-10-30"),
      item("a", "u3", "approved", "2026-10-20", "2026-10-26"),
      item("r", "u4", "rejected", "2026-10-27"),
      item("c", "u5", "cancelled", "2026-10-27"),
      item("later", "u6", "approved", "2026-10-29"),
    ];
    expect(alsoOff(me, all).map((x) => x.requestId)).toEqual(["a", "p"]);
  });
});

describe("balanceAfter", () => {
  it("shows the balance before and after, and flags what the server would refuse", () => {
    const rows = balanceAfter(
      [["2026", 3]],
      () => ({ allowance: 20, used: 15 }),
      () => 2,
    );
    expect(rows).toEqual([
      {
        year: "2026",
        share: 3,
        allowance: 20,
        left: 5,
        after: 2,
        otherPending: 2,
        over: false,
      },
    ]);
    expect(
      balanceAfter(
        [["2026", 6]],
        () => ({ allowance: 20, used: 15 }),
        () => 0,
      )[0]?.over,
    ).toBe(true);
  });

  it("never flags a type with no fixed allowance, and leaves unknown years unknown", () => {
    expect(
      balanceAfter(
        [["2026", 9]],
        () => ({ allowance: 0, used: 0 }),
        () => 0,
      )[0]?.over,
    ).toBe(false);
    expect(
      balanceAfter(
        [
          ["2026", 3],
          ["2027", 2],
        ],
        (y) => (y === "2026" ? { allowance: 20, used: 0 } : null),
        () => 0,
      )[1],
    ).toBeNull();
  });
});

describe("decisionError", () => {
  const who = { requesterName: "Priya", typeName: "Annual Leave" };

  it("names a balance refusal instead of calling it stale", () => {
    const e = new ApiError("x", 400, "validation", "insufficient_balance");
    expect(decisionError(e, who).title).toMatch(/Not enough leave balance/);
  });

  it("tells a self-approval and an overlap apart from an already-decided request, all 409s", () => {
    expect(
      decisionError(new ApiError("x", 409, "cannot_approve_own_request"), who).title,
    ).toMatch(/your own leave/);
    expect(decisionError(new ApiError("x", 409, "overlapping_leave"), who).title).toMatch(
      /overlaps/,
    );
    const stale = decisionError(new ApiError("x", 409, "not_pending"), who);
    expect(stale.stale).toBe(true);
  });
});

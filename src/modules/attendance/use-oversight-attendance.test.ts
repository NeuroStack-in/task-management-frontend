import { describe, expect, it } from "vitest";

// Pure helpers only — nothing here reaches the services the hook module imports.
import {
  classifyToday,
  dayPoint,
  rangeDays,
  type OversightRow,
  type TodayKind,
} from "./use-oversight-attendance";

const row = (over: Partial<OversightRow> = {}): OversightRow => ({
  userId: "u1",
  name: "Asha",
  dept: "Engineering",
  ...over,
});
/** Epoch ms for a local time on an arbitrary day — classification compares local HH:MM. */
const at = (h: number, m = 0) => new Date(2026, 9, 7, h, m).getTime();

const scheduled: TodayKind = { scheduled: true, holiday: false };
const dayOff: TodayKind = { scheduled: false, holiday: false };
const holiday: TodayKind = { scheduled: true, holiday: true };

describe("classifyToday", () => {
  it("on a scheduled day: no session is absent, a late start is late", () => {
    expect(classifyToday(row(), "09:30", scheduled)).toBe("absent");
    expect(classifyToday(row({ clockIn: at(9, 0) }), "09:30", scheduled)).toBe("present");
    expect(classifyToday(row({ clockIn: at(11, 0) }), "09:30", scheduled)).toBe("late");
  });

  /** WP-254: a Saturday read everyone "Absent" and a volunteer "Late". */
  it("on an unscheduled day: off unless worked, and never late", () => {
    expect(classifyToday(row(), "09:30", dayOff)).toBe("off");
    expect(classifyToday(row({ clockIn: at(11, 0) }), "09:30", dayOff)).toBe("present");
    expect(classifyToday(row({ running: true }), "09:30", dayOff)).toBe("present");
  });

  it("a holiday is a day off even with a session; approved leave still wins", () => {
    expect(classifyToday(row({ clockIn: at(10, 0) }), "09:30", holiday)).toBe("off");
    expect(classifyToday(row({ onLeave: true }), "09:30", holiday)).toBe("leave");
  });

  /** WP-253: a failed read is not an absence. */
  it("gives no verdict for a day that couldn't be read", () => {
    expect(classifyToday(row({ dayUnknown: true }), "09:30", scheduled)).toBeUndefined();
  });
});

describe("rangeDays", () => {
  // Wednesday 7 October 2026.
  const now = { year: 2026, month: 9, day: 7 };

  /** WP-475: the seven days before today, not "this week"; WP-260: weekends included. */
  it("the 7-day range is the seven closed days before today", () => {
    expect(rangeDays("week", now, "", "", now)).toEqual([
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
    ]);
  });

  it("a month covers every closed day — days off too — and stops before today", () => {
    expect(rangeDays("month", { year: 2026, month: 9, day: 1 }, "", "", now)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
    ]);
  });

  /** WP-255: today has no closed record, so it is never fetched as a "day". */
  it("a picked day is fetched only once it has closed", () => {
    expect(rangeDays("day", now, "", "", now)).toEqual([]);
    expect(rangeDays("day", { year: 2026, month: 9, day: 6 }, "", "", now)).toEqual([
      "2026-10-06",
    ]);
  });
});

describe("dayPoint", () => {
  const dir = new Map(
    ["a", "b", "c", "d"].map((id) => [
      id,
      { name: id.toUpperCase(), dept: id === "d" ? "Sales" : "Engineering", active: true },
    ]),
  );

  /** WP-257: an excused day was counted as an absence. */
  it("counts excused and non-working days toward nothing, and skips people outside the roster", () => {
    const p = dayPoint(
      "2026-10-06",
      [
        { user_id: "a", status: "present" },
        { user_id: "b", status: "excused" },
        { user_id: "c", status: "absent" },
        { user_id: "d", status: "non_workday" },
        { user_id: "owner", status: "absent" },
      ],
      dir,
      "all",
    );
    expect(p).toMatchObject({ present: 1, absent: 1, leave: 0, total: 2, rate: 50 });
  });

  it("applies the department filter", () => {
    const p = dayPoint(
      "2026-10-06",
      [
        { user_id: "a", status: "present" },
        { user_id: "d", status: "absent" },
      ],
      dir,
      "Sales",
    );
    expect(p).toMatchObject({ present: 0, absent: 1, total: 1, rate: 0 });
  });
});

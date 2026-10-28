import { describe, expect, it } from "vitest";
import type { ApiRunLine, DayCounts } from "../services/payroll.service";
import { daysSummary, lineNotes, notOnRunReason, unpaidDays } from "./pay-lines";

const DAYS: DayCounts = {
  scheduled: 22,
  worked: 0,
  leave: 0,
  holiday: 0,
  absent: 0,
  before_joining: 0,
  upcoming: 0,
  unrecorded: 0,
};

const line = (over: Partial<ApiRunLine> = {}): ApiRunLine => ({
  user_id: "u1",
  name: "Dhruvesh M",
  pay_type: "salaried",
  rate: 55555,
  worked_secs: 3600,
  gross: 55555,
  deductions: 0,
  net: 55555,
  ...over,
});

describe("daysSummary", () => {
  it("lists the non-zero parts, worked first", () => {
    expect(daysSummary({ ...DAYS, worked: 18, leave: 1, holiday: 1, absent: 2 })).toBe(
      "18 worked · 1 leave · 1 holiday · 2 absent",
    );
    expect(daysSummary({ ...DAYS, absent: 19, upcoming: 3 })).toBe("19 absent · 3 still to come");
    expect(daysSummary({ ...DAYS, scheduled: 0 })).toBe("no scheduled days");
  });
});

describe("lineNotes", () => {
  it("the reported case: absent all month, no time tracked", () => {
    const notes = lineNotes(line({ worked_secs: 0, days: { ...DAYS, absent: 19, upcoming: 3 } }));
    expect(notes.map((n) => n.text)).toEqual([
      "Absent 19 days of 22 — not paid for them",
      "No time tracked this month",
    ]);
    expect(notes[0].tone).toBe("warning");
  });

  it("a mid-month joiner and unrecorded days are information, not warnings", () => {
    const notes = lineNotes(line({ days: { ...DAYS, worked: 10, before_joining: 10, unrecorded: 2 } }));
    expect(notes.map((n) => [n.tone, n.text])).toEqual([
      ["info", "Joined this month — 10 days before joining not paid"],
      ["info", "2 days with no attendance record — paid, worth checking"],
    ]);
  });

  it("a clean line has nothing to say", () => {
    expect(lineNotes(line({ days: { ...DAYS, worked: 22 } }))).toEqual([]);
  });

  it("hourly with no tracked time is told it earns nothing", () => {
    expect(lineNotes(line({ pay_type: "hourly", worked_secs: 0 }))[0].text).toBe(
      "No time tracked this month — nothing to pay",
    );
  });

  it("an older run without days still warns on no tracked time", () => {
    expect(lineNotes(line({ worked_secs: 0 })).map((n) => n.text)).toEqual(["No time tracked this month"]);
  });
});

describe("unpaidDays / notOnRunReason", () => {
  it("counts absent and before-joining days", () => {
    expect(unpaidDays({ ...DAYS, absent: 2, before_joining: 3 })).toBe(5);
  });

  it("explains why someone is not on the run", () => {
    expect(notOnRunReason({ user_id: "a", name: "A" })).toEqual({ text: "Pay not set up", action: "set-pay" });
    expect(notOnRunReason({ user_id: "b", name: "B", pay_type: "hourly", rate: 300 }).action).toBe("redraft");
  });
});

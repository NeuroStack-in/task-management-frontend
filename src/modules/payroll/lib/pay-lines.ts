/**
 * What the payroll page says about each person's line (2026-10-28 rework).
 *
 * Salaried pay is prorated by attendance — loss of pay for absent days (owner decision 2026-10-28) —
 * so a line now carries the days behind its amount, and the page points out what an admin should
 * look at before finalizing: absent days, no tracked time, days with no attendance record, a mid-month
 * start. Pure and unit-tested.
 */
import type { ApiNotOnRun, ApiRunLine, DayCounts } from "../services/payroll.service";

export type Tone = "warning" | "info";

export interface LineNote {
  tone: Tone;
  text: string;
}

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/** Days the salary isn't paid for. */
export function unpaidDays(d: DayCounts): number {
  return d.absent + d.before_joining;
}

/** "18 worked · 1 leave · 1 holiday · 2 absent" — the parts that are non-zero, worked first. */
export function daysSummary(d: DayCounts): string {
  const parts: string[] = [];
  if (d.worked) parts.push(`${d.worked} worked`);
  if (d.leave) parts.push(`${d.leave} leave`);
  if (d.holiday) parts.push(`${d.holiday} ${d.holiday === 1 ? "holiday" : "holidays"}`);
  if (d.absent) parts.push(`${d.absent} absent`);
  if (d.upcoming) parts.push(`${d.upcoming} still to come`);
  return parts.join(" · ") || "no scheduled days";
}

/** What to look at on one line before finalizing, most important first. */
export function lineNotes(l: ApiRunLine): LineNote[] {
  const notes: LineNote[] = [];
  const d = l.days;
  if (d && l.pay_type === "salaried") {
    if (d.absent > 0) {
      notes.push({
        tone: "warning",
        text: `Absent ${days(d.absent)} of ${d.scheduled} — not paid for ${d.absent === 1 ? "it" : "them"}`,
      });
    }
    if (d.before_joining > 0) {
      notes.push({ tone: "info", text: `Joined this month — ${days(d.before_joining)} before joining not paid` });
    }
  }
  if (l.worked_secs === 0 && (!d || d.worked + d.upcoming > 0 || l.pay_type === "hourly")) {
    notes.push({
      tone: "warning",
      text:
        l.pay_type === "hourly"
          ? "No time tracked this month — nothing to pay"
          : "No time tracked this month",
    });
  }
  if (d && d.unrecorded > 0) {
    notes.push({
      tone: "info",
      text: `${days(d.unrecorded)} with no attendance record — paid, worth checking`,
    });
  }
  return notes;
}

/** Why a person isn't on the run, and what fixes it. */
export function notOnRunReason(p: ApiNotOnRun): { text: string; action: "set-pay" | "redraft" } {
  return p.pay_type && p.rate != null
    ? { text: "Pay set after this draft — redraft to include them", action: "redraft" }
    : { text: "Pay not set up", action: "set-pay" };
}

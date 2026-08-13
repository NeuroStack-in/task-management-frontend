"use client";

/**
 * The report library's composition layer — every `ReportDef` built from **real** endpoints.
 *
 * The preview shipped this library with Faker rows. Here each report is composed from the live
 * `insights` / `time-attendance` / `workforce` / `projects` reads, so row counts, column counts, and
 * the CSV/PDF exports are all honest. Where a report needs a signal the backend does not serve, the
 * cell is the em dash `OMITTED` — never a fabricated number.
 *
 * ## Fetch discipline (the two hazards this project already hit)
 *  - **Bounded concurrency (3) + skip-on-fail**, copied from `use-month-attendance`: per-employee and
 *    per-project fan-outs never fire all at once (the 503 throttle hazard), and one failed item
 *    becomes an omission, not a dead report.
 *  - **Fetch once, reuse.** The per-employee timesheet fan-out feeds *three* reports (Timesheet
 *    Summary, Utilization, and the per-project hour rollup) from a single set of requests.
 *
 * ## Window
 * Monitoring/timesheet data lives on completed workdays, so we compose over the **most recent
 * workday** (single-day reports: productivity, leaderboard, anomalies) and the **Mon–Fri week** that
 * ends on it (weekly reports: timesheet, utilization, project, attendance).
 */
import { useCallback, useEffect, useState } from "react";
import { getAttention, getOrgActivity, type OrgActivity } from "./services/insights.service";
import { OMITTED, type ReportDef } from "./lib/report-def";
import {
  getUserTimesheet,
  type ApiGridResponse,
} from "@/modules/time-tracking/services/timesheet.service";
import {
  getDayOversight,
  type AttendanceStatus,
} from "@/modules/attendance/services/attendance.service";
import {
  departmentMap,
  listEmployees,
} from "@/modules/employees/services/employees.service";
import {
  getProject,
  listProjects,
  type ApiProjectDetail,
} from "@/modules/projects/services/projects.service";

/* ------------------------------- concurrency ------------------------------ */

/** Run `fn` over `items` with at most `limit` in flight. Mirrors `use-month-attendance`. */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) || 0 }, () => worker()),
  );
}

/* --------------------------------- dates ---------------------------------- */

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const isWeekday = (d: Date) => d.getDay() >= 1 && d.getDay() <= 5;

/** The most recent completed workday (strictly before today). */
function mostRecentWorkday(from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  while (!isWeekday(d)) d.setDate(d.getDate() - 1);
  return d;
}

/** The Mon–Fri workdays from the Monday of `day`'s week up to and including `day`. */
function workweek(day: Date): string[] {
  const monday = new Date(day);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const out: string[] = [];
  for (const cur = new Date(monday); cur <= day; cur.setDate(cur.getDate() + 1)) {
    if (isWeekday(cur)) out.push(isoOf(cur));
  }
  return out;
}

function prettyShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/* --------------------------------- state ---------------------------------- */

export interface ReportsData {
  reports: ReportDef[];
  loading: boolean;
  /** Set only when the base reads all failed — a single bad fan-out item is swallowed. */
  error: string | null;
  reload: () => void;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function useReportsData(): ReportsData {
  const [reports, setReports] = useState<ReportDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);

    (async () => {
      const day = mostRecentWorkday(new Date());
      const dayIso = isoOf(day);
      const weekIsos = workweek(day);
      const from = weekIsos[0] ?? dayIso;
      const to = weekIsos[weekIsos.length - 1] ?? dayIso;
      const weekLabel = `Week of ${prettyShort(from)}`;
      const dayLabel = prettyShort(dayIso);

      // ── base reads (independent; each degrades to empty, not a total failure) ──
      const [empRes, deptRes, projRes, orgRes, attnRes] = await Promise.allSettled([
        listEmployees(),
        departmentMap(),
        listProjects(),
        getOrgActivity(dayIso),
        getAttention(dayIso),
      ]);
      if (!live) return;

      // Everything the reports lean on failed → surface a real error rather than an empty library.
      if (
        empRes.status === "rejected" &&
        orgRes.status === "rejected" &&
        projRes.status === "rejected"
      ) {
        setError("Couldn't load reports. Check your connection and retry.");
        setLoading(false);
        return;
      }

      const employees = empRes.status === "fulfilled" ? empRes.value : [];
      const deptNames = deptRes.status === "fulfilled" ? deptRes.value : new Map<string, string>();
      const projects = projRes.status === "fulfilled" ? projRes.value : [];
      const org = orgRes.status === "fulfilled" ? orgRes.value : null;
      const attention = attnRes.status === "fulfilled" ? attnRes.value : null;

      const deptName = (id?: string) => (id && deptNames.get(id)) || id || OMITTED;
      const activeEmployees = employees.filter((e) => e.status === "active");

      // ── fan-outs (bounded concurrency 3, skip-on-fail) ──
      // Per-employee timesheets for the week — reused by three reports.
      const timesheets = new Map<string, ApiGridResponse>();
      await mapWithConcurrency(activeEmployees, 3, (e) =>
        getUserTimesheet(e.user_id, from, to).then(
          (g) => void timesheets.set(e.user_id, g),
          () => {},
        ),
      );

      // Attendance status per weekday (a handful of calls covers the whole org).
      const oversightByDay = new Map<string, Map<string, AttendanceStatus>>();
      await mapWithConcurrency(weekIsos, 3, (iso) =>
        getDayOversight(iso).then(
          (r) => void oversightByDay.set(iso, new Map(r.users.map((u) => [u.user_id, u.status]))),
          () => {},
        ),
      );

      // Project detail (for KPI active-member counts).
      const projectDetail = new Map<string, ApiProjectDetail>();
      await mapWithConcurrency(projects, 3, (p) =>
        getProject(p.id).then((d) => void projectDetail.set(p.id, d), () => {}),
      );

      // Per-day org activity across the week — the day-over-day series the productivity report's
      // Trend column needs. Each person's trend is the report day's score vs their average on the
      // preceding days (real, not fabricated; "—" when there's nothing to compare against).
      const activityByDay = new Map<string, OrgActivity>();
      await mapWithConcurrency(weekIsos, 3, (iso) =>
        getOrgActivity(iso).then((r) => void activityByDay.set(iso, r), () => {}),
      );
      const priorScores = new Map<string, number[]>();
      for (const [iso, act] of activityByDay) {
        if (iso >= dayIso) continue; // only days before the report day count as "prior"
        for (const p of act.people) {
          if (p.breakdown) {
            const arr = priorScores.get(p.user_id) ?? [];
            arr.push(p.breakdown.score);
            priorScores.set(p.user_id, arr);
          }
        }
      }
      /** Signed change vs the person's recent average (e.g. "+6", "−4", "0"); "—" with no history. */
      const trendFor = (userId: string, todayScore: number | null): string => {
        if (todayScore === null) return OMITTED;
        const prior = priorScores.get(userId);
        if (!prior || prior.length === 0) return OMITTED;
        const avg = prior.reduce((s, v) => s + v, 0) / prior.length;
        const delta = Math.round(todayScore - avg);
        return delta > 0 ? `+${delta}` : delta < 0 ? `−${-delta}` : "0";
      };

      if (!live) return;

      /* ------------------------------ compose ----------------------------- */

      const out: ReportDef[] = [];

      // productivity — one workday's org activity. Trend = the day's score vs the person's average
      // over the preceding days of the week (real; "—" when there's no prior day to compare).
      out.push({
        id: "productivity",
        name: "Productivity Report",
        description:
          "Per-employee productivity score and active hours for the day. Trend is the change vs the person's average over the earlier days of the week.",
        category: "workforce",
        timeframe: dayLabel,
        columns: ["Employee", "Department", "Active hrs", "Productivity %", "Trend"],
        rows: (org?.people ?? []).map((p) => {
          const score = p.breakdown ? Math.round(p.breakdown.score) : null;
          return [
            p.name,
            deptName(p.department_id),
            p.totals ? round1(p.totals.active_sec / 3600) : OMITTED,
            score ?? OMITTED,
            trendFor(p.user_id, score),
          ];
        }),
      });

      // leaderboard — scored people only, ranked.
      out.push({
        id: "leaderboard",
        name: "Productivity Leaderboard",
        description: "Top 10 performers ranked by productivity score for the day.",
        category: "workforce",
        timeframe: dayLabel,
        columns: ["Rank", "Employee", "Department", "Productivity %"],
        rows: (org?.people ?? [])
          .filter((p) => p.breakdown)
          .sort((a, b) => b.breakdown!.score - a.breakdown!.score)
          .slice(0, 10)
          .map((p, i) => [i + 1, p.name, deptName(p.department_id), Math.round(p.breakdown!.score)]),
      });

      // time — timesheet fan-out. Idle hrs has no real source → OMITTED.
      out.push({
        id: "time",
        name: "Timesheet Summary",
        description:
          "Tracked hours and billable split per employee. Idle time needs the desktop agent's activity capture.",
        category: "time",
        timeframe: weekLabel,
        columns: ["Employee", "Tracked hrs", "Idle hrs", "Billable %"],
        rows: activeEmployees.map((e) => {
          const g = timesheets.get(e.user_id);
          return [
            e.name,
            g ? round1(g.total_secs / 3600) : OMITTED,
            OMITTED,
            g && g.total_secs > 0 ? Math.round((g.billable_secs / g.total_secs) * 100) : OMITTED,
          ];
        }),
      });

      // utilization — reuses the same timesheets. Capacity is a stated 40h assumption.
      out.push({
        id: "utilization",
        name: "Utilization Report",
        description:
          "Billable hours against a standard 40-hour weekly capacity (an assumption, not a per-person contract).",
        category: "time",
        timeframe: weekLabel,
        columns: ["Employee", "Capacity hrs", "Billable hrs", "Utilization %"],
        rows: activeEmployees.map((e) => {
          const g = timesheets.get(e.user_id);
          const billableHrs = g ? g.billable_secs / 3600 : null;
          return [
            e.name,
            40,
            billableHrs === null ? OMITTED : round1(billableHrs),
            billableHrs === null ? OMITTED : Math.round((billableHrs / 40) * 100),
          ];
        }),
      });

      // project — hours summed from the timesheet entries, members from KPI.
      const hoursByProject = new Map<string, number>();
      for (const g of timesheets.values())
        for (const d of g.days)
          for (const entry of d.entries)
            hoursByProject.set(
              entry.project_id,
              (hoursByProject.get(entry.project_id) ?? 0) + (entry.duration_secs ?? 0),
            );
      out.push({
        id: "project",
        name: "Project Time Allocation",
        description: "Hours tracked per project this week, with active members and status.",
        category: "projects",
        timeframe: weekLabel,
        columns: ["Project", "Hours", "Members", "On track"],
        rows: projects.map((p) => {
          const detail = projectDetail.get(p.id);
          const members = detail?.kpi
            ? detail.kpi.active_members
            : detail
              ? detail.members.length
              : OMITTED;
          return [
            p.name,
            round1((hoursByProject.get(p.id) ?? 0) / 3600),
            members,
            p.status === "active" ? "Yes" : p.status,
          ];
        }),
      });

      // attendance — counted from the per-day oversight roster. Late is not on the oversight index.
      out.push({
        id: "attendance",
        name: "Attendance Summary",
        description:
          "Per-employee present / leave / absent days and attendance rate. Late needs a per-day detail the oversight index doesn't project.",
        category: "attendance",
        timeframe: weekLabel,
        columns: ["Employee", "Department", "Present", "Late", "On leave", "Absent", "Rate %"],
        rows: activeEmployees.map((e) => {
          let present = 0;
          let leave = 0;
          let absent = 0;
          let counted = 0;
          for (const iso of weekIsos) {
            const status = oversightByDay.get(iso)?.get(e.user_id);
            if (!status || status === "non_workday") continue;
            counted++;
            if (status === "present" || status === "partial") present++;
            else if (status === "leave") leave++;
            else if (status === "absent") absent++;
          }
          return [
            e.name,
            deptName(e.department_id),
            present,
            OMITTED,
            leave,
            absent,
            counted > 0 ? Math.round((present / counted) * 100) : OMITTED,
          ];
        }),
      });

      // anomalies — the AI attention ranking; honest empty when nothing fired.
      out.push({
        id: "anomalies",
        name: "Anomaly & Risk Report",
        description: "People flagged by anomaly detection, ranked by attention weight.",
        category: "monitoring",
        timeframe: dayLabel,
        columns: ["Employee", "Anomalies", "Severity", "Reasons", "Score"],
        rows: (attention?.people ?? [])
          .filter((p) => p.anomaly_count > 0)
          .map((p) => [
            p.name,
            p.anomaly_count,
            p.top_severity || OMITTED,
            p.reasons.length ? p.reasons.join(", ") : OMITTED,
            Math.round(p.score),
          ]),
      });

      if (!live) return;
      setReports(out);
      setLoading(false);
    })().catch(() => {
      if (!live) return;
      setError("Couldn't load reports. Check your connection and retry.");
      setLoading(false);
    });

    return () => {
      live = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { reports, loading, error, reload };
}

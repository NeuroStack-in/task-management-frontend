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
 * ## Window — the page's date (UX audit 2026-10-16, MON-05)
 * The library follows the date the page is on: single-day reports (productivity, leaderboard,
 * anomalies) cover **that day**, and weekly ones (timesheet, utilization, project, attendance) the
 * org's scheduled days of the week containing it, up to it. It used to compose over "the most recent
 * workday before today" whatever the page said, so a page on 16 Oct showed cards for 15 Oct and the
 * week of 12 Oct, and "Download all" exported that other window without a word. Every card and every
 * exported file now names its window. The schedule is the org's own (`GET /v1/org/working-hours`),
 * not Mon–Fri.
 */
import { useCallback, useEffect, useState } from "react";
import { type OrgActivity } from "./services/insights.service";
import { OMITTED, type ReportDef } from "./lib/report-def";
import { attentionFor, orgActivityFor } from "./lib/day-reads";
import { weekWorkdays } from "./lib/week";
import { UNKNOWN_DEPARTMENT } from "@/lib/format";
import { safeWorkdays, type IsoWeekday } from "@/lib/workdays";
import { useAuthStore } from "@/stores/auth.store";
import {
  getWorkingHours,
  type OrgWorkingHours,
} from "@/modules/settings/services/org.service";
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
  listAllEmployees,
} from "@/modules/employees/services/employees.service";
import {
  getProject,
  listProjects,
  type ApiProject,
  type ApiProjectDetail,
} from "@/modules/projects/services/projects.service";
import { contributorRoleIds } from "@/modules/roles/services/roles.service";

/* ------------------------------- concurrency ------------------------------ */

/**
 * Run `fn` over `items` with at most `limit` in flight. Mirrors `use-month-attendance`.
 *
 * `live` is checked before each request: stepping the page's date past a day mid-composition used
 * to leave that day's fan-out issuing requests for a library nobody would see.
 */
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
  live: () => boolean = () => true,
): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length && live()) {
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

/** `"HH:MM"` → minutes past midnight, `null` when unparseable. */
function hhmmMinutes(v: string | undefined): number | null {
  const m = v ? /^(\d{1,2}):(\d{2})$/.exec(v.trim()) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * The org's expected working day in hours — `(work_end − work_start) − break`, the same figure the
 * scorer uses (`backend/docs/PRODUCTIVITY.md` §1.2). 8 h when the schedule is unknown or nonsensical,
 * which is also the server's default.
 */
function expectedDayHours(h: OrgWorkingHours | null): number {
  const start = hhmmMinutes(h?.work_start);
  const end = hhmmMinutes(h?.work_end);
  if (h == null || start === null || end === null) return 8;
  const minutes = end - start - (h.break_minutes ?? 0);
  return minutes > 0 ? Math.round((minutes / 60) * 10) / 10 : 8;
}

function prettyShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function prettyDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** The windows a library covers for one page date — what every card and exported file names. */
export interface ReportsWindow {
  /** The single day the daily reports cover. */
  day: string;
  /** The weekly reports' scheduled days, `from`…`to`, never past `day`. */
  from: string;
  to: string;
  /** How many scheduled days the weekly window holds. */
  workdays: number;
  dayLabel: string;
  weekLabel: string;
}

/** Pure, so the rule is pinned by a test. `today` marks a window still filling in as "so far". */
export function reportsWindow(
  date: string,
  workdays: readonly IsoWeekday[],
  today: string,
): ReportsWindow {
  const weekIsos = weekWorkdays(date, workdays).filter((d) => d <= date);
  const from = weekIsos[0] ?? date;
  const to = weekIsos[weekIsos.length - 1] ?? date;
  const soFar = (iso: string) => (iso === today ? " (so far)" : "");
  return {
    day: date,
    from,
    to,
    workdays: weekIsos.length,
    dayLabel: `${prettyDay(date)}${soFar(date)}`,
    weekLabel:
      from === to
        ? `${prettyDay(from)}${soFar(to)}`
        : `${prettyShort(from)} – ${prettyShort(to)}${soFar(to)}`,
  };
}

/* --------------------------------- state ---------------------------------- */

export interface ReportsData {
  reports: ReportDef[];
  /** The windows `reports` cover, once composed — `null` before. */
  window: ReportsWindow | null;
  loading: boolean;
  /** Set only when the base reads all failed — a single bad fan-out item is swallowed. */
  error: string | null;
  reload: () => void;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Prettify an enum/code value for display: `on_hold` → `On hold`, `idle_faking` → `Idle faking`.
 *  Leaves already-readable text alone (only swaps underscores and capitalises the first letter). */
const humanize = (s: string): string => {
  const t = s.replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : s;
};

/**
 * Composed libraries, reused for a few minutes — one per page date, the last few kept.
 *
 * Composing is a request per measured person plus one per project — about 70 for a 50-person org,
 * well over 100 at 150 — and it ran again on every visit to the tab (QA audit 2026-10-08, WP-492).
 * Keyed by user and date, so another sign-in in the same tab never sees it, and stepping back to a
 * day just viewed costs nothing; "Try again" drops them all.
 */
const composed = new Map<string, { at: number; reports: ReportDef[]; window: ReportsWindow }>();
const COMPOSE_TTL_MS = 5 * 60_000;
const COMPOSE_KEEP = 6;
/** Wait this long on a new date before composing, so stepping through days composes only the last. */
const COMPOSE_DEBOUNCE_MS = 400;

/** The library for page date `date` (`YYYY-MM-DD`). An empty `date` composes nothing yet. */
export function useReportsData(date: string): ReportsData {
  const [reports, setReports] = useState<ReportDef[]>([]);
  const [reportWindow, setReportWindow] = useState<ReportsWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const userId = useAuthStore((s) => s.user?.id ?? "");

  useEffect(() => {
    if (!date) return;
    let live = true;
    const isLive = () => live;
    const todayIso = isoOf(new Date());
    const cacheKey = `${userId}|${date}`;
    const hit = composed.get(cacheKey);
    if (hit && Date.now() - hit.at < COMPOSE_TTL_MS) {
      setReports(hit.reports);
      setReportWindow(hit.window);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    // Another date's cards must not sit under this one's while it composes.
    setReports([]);
    setReportWindow(null);

    async function compose() {
      // The org's own schedule, not Mon–Fri: a Sun–Thu org got Friday as its "most recent workday"
      // and an empty report, and a six-day org never saw a Saturday (QA audit 2026-10-08, WP-283).
      // A failed read falls back to Mon–Fri — what the server assumes for an unconfigured org.
      const hours = await getWorkingHours().catch(() => null);
      if (!live) return;
      const workdays = safeWorkdays(hours?.workdays);
      const win = reportsWindow(date, workdays, todayIso);
      const dayIso = win.day;
      const weekIsos = weekWorkdays(dayIso, workdays).filter((d) => d <= dayIso);
      const { from, to, weekLabel, dayLabel } = win;
      const dayWindow = { from: dayIso, to: dayIso };
      const weekWindow = { from, to };

      // ── base reads (independent; each degrades to empty, not a total failure) ──
      const [empRes, deptRes, projRes, orgRes, attnRes, contribRes] = await Promise.allSettled([
        listAllEmployees(),
        departmentMap(),
        listProjects(),
        // Shared with the page's "Needs attention" panel and week ranking (see `lib/day-reads`).
        orgActivityFor(userId, dayIso),
        attentionFor(userId, dayIso),
        contributorRoleIds(),
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

      const deptName = (id?: string) =>
        (id && deptNames.get(id)) || (id ? UNKNOWN_DEPARTMENT : OMITTED);
      const activeEmployees = employees.filter((e) => e.status === "active");

      /**
       * Productivity reporting covers the people who are **measured** — those whose role grants
       * `time-tracking:self`, the bit the desktop agent's timer rides on.
       *
       * Admins and managers were listed alongside everyone else, permanently at "—" because they
       * run no agent and produce no activity. A roster of blanks is not a neutral omission: it
       * drags any average taken over the rows, it makes "12 rows" mean nothing, and it invites the
       * reading that an admin scored zero rather than that they were never in scope.
       *
       * `contributorRoleIds` is the same definition the dashboard's "Working now" uses, so the two
       * cannot disagree about who counts. A failed read leaves it `null`, which keeps every row
       * rather than silently emptying the report — a degraded read must not look like an empty org.
       */
      const contributorIds = contribRes.status === "fulfilled" ? contribRes.value : null;
      const roleOf = new Map(employees.map((e) => [e.user_id, e.role_id ?? ""]));
      const isMeasured = (userId: string) =>
        contributorIds === null || contributorIds.has(roleOf.get(userId) ?? "");
      const measuredPeople = (org?.people ?? []).filter((p) => isMeasured(p.user_id));
      /**
       * The same rule for the roster-driven reports.
       *
       * Timesheet and Utilization measure timer output, which a role without `time-tracking:self`
       * cannot produce. Attendance goes the same way for a sharper reason: it is derived from agent
       * sessions, so a manager who runs no agent does not read as "not applicable" — they read as
       * **absent**, every single day.
       */
      const measuredEmployees = activeEmployees.filter((e) => isMeasured(e.user_id));

      // ── fan-outs (bounded concurrency 3, skip-on-fail) ──
      // Per-employee timesheets for the week — reused by three reports. Measured people only: a
      // role without `time-tracking:self` cannot log a timer, so its timesheet is a request for a
      // row no report shows (QA audit 2026-10-08, WP-492).
      const timesheets = new Map<string, ApiGridResponse>();
      await mapWithConcurrency(
        measuredEmployees,
        3,
        (e) =>
          getUserTimesheet(e.user_id, from, to).then(
            (g) => void timesheets.set(e.user_id, g),
            () => {},
          ),
        isLive,
      );

      // Attendance status per weekday (a handful of calls covers the whole org).
      const oversightByDay = new Map<string, Map<string, AttendanceStatus>>();
      await mapWithConcurrency(
        weekIsos,
        3,
        (iso) =>
          getDayOversight(iso).then(
            (r) => void oversightByDay.set(iso, new Map(r.users.map((u) => [u.user_id, u.status]))),
            () => {},
          ),
        isLive,
      );

      // Project detail (for KPI active-member counts).
      const projectDetail = new Map<string, ApiProjectDetail>();
      await mapWithConcurrency(
        projects,
        3,
        (p) => getProject(p.id).then((d) => void projectDetail.set(p.id, d), () => {}),
        isLive,
      );

      // Per-day org activity across the week — the day-over-day series the productivity report's
      // Trend column needs. Each person's trend is the report day's score vs their average on the
      // preceding days (real, not fabricated; "—" when there's nothing to compare against).
      // The report day was already read above; only the earlier days are fetched here.
      const activityByDay = new Map<string, OrgActivity>();
      if (org) activityByDay.set(dayIso, org);
      await mapWithConcurrency(
        weekIsos.filter((iso) => iso !== dayIso),
        3,
        (iso) => orgActivityFor(userId, iso).then((r) => void activityByDay.set(iso, r), () => {}),
        isLive,
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
          "Productivity score and active hours for the day, for people whose role tracks time. Trend is the change vs the person's average over the earlier days of the week.",
        category: "workforce",
        timeframe: dayLabel,
        window: dayWindow,
        columns: ["Employee", "Department", "Active hrs", "Productivity %", "Trend"],
        rows: measuredPeople.map((p) => {
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
        window: dayWindow,
        columns: ["Rank", "Employee", "Department", "Productivity %"],
        rows: measuredPeople
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
        window: weekWindow,
        columns: ["Employee", "Tracked hrs", "Idle hrs", "Billable %"],
        rows: measuredEmployees.map((e) => {
          const g = timesheets.get(e.user_id);
          return [
            e.name,
            g ? round1(g.total_secs / 3600) : OMITTED,
            OMITTED,
            g && g.total_secs > 0 ? Math.round((g.billable_secs / g.total_secs) * 100) : OMITTED,
          ];
        }),
      });

      // utilization — reuses the same timesheets. Capacity is the org's scheduled hours over the days
      // the window actually covers: a partial week was measured against a full 40 h, so a fully
      // billable Tuesday read 20% (QA audit 2026-10-08, WP-283).
      const dayHours = expectedDayHours(hours);
      const capacityHrs = round1(dayHours * weekIsos.length);
      out.push({
        id: "utilization",
        name: "Utilization Report",
        description: `Billable hours against the organization's scheduled hours for the ${weekIsos.length} ${
          weekIsos.length === 1 ? "workday" : "workdays"
        } covered (${dayHours} h a day) — an org-wide assumption, not a per-person contract.`,
        category: "time",
        timeframe: weekLabel,
        window: weekWindow,
        columns: ["Employee", "Capacity hrs", "Billable hrs", "Utilization %"],
        rows: measuredEmployees.map((e) => {
          const g = timesheets.get(e.user_id);
          const billableHrs = g ? g.billable_secs / 3600 : null;
          return [
            e.name,
            capacityHrs,
            billableHrs === null ? OMITTED : round1(billableHrs),
            billableHrs === null || capacityHrs <= 0
              ? OMITTED
              : Math.round((billableHrs / capacityHrs) * 100),
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
      /**
       * "On track" from the signals the server actually has — overdue tasks and the end date. It
       * read "Yes" for every active project whatever its schedule (QA audit 2026-10-08, WP-283);
       * without the project's KPIs there is nothing to judge, so it says so.
       */
      const onTrack = (p: ApiProject, detail?: ApiProjectDetail): string => {
        if (p.status !== "active") return humanize(p.status);
        const kpi = detail?.kpi;
        if (!kpi) return OMITTED;
        if (kpi.overdue_count > 0) return `No — ${kpi.overdue_count} overdue`;
        if (detail?.end_date && detail.end_date < todayIso && kpi.completion_pct < 100) {
          return "No — past end date";
        }
        return "Yes";
      };
      out.push({
        id: "project",
        name: "Project Time Allocation",
        description:
          "Hours tracked per project this week, with active members. On track means no overdue tasks and not past its end date.",
        category: "projects",
        timeframe: weekLabel,
        window: weekWindow,
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
            onTrack(p, detail),
          ];
        }),
      });

      // attendance — counted from the per-day oversight roster. Late is not on the oversight index.
      out.push({
        id: "attendance",
        name: "Attendance Summary",
        description:
          "Present / leave / absent days and attendance rate, for people whose role tracks time. A day counts once attendance closes overnight, so today isn't in it yet. Late needs a per-day detail the oversight index doesn't project.",
        category: "attendance",
        timeframe: weekLabel,
        window: weekWindow,
        columns: ["Employee", "Department", "Present", "Late", "On leave", "Absent", "Rate %"],
        rows: measuredEmployees.map((e) => {
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
        window: dayWindow,
        columns: ["Employee", "Anomalies", "Severity", "Reasons", "Score"],
        rows: (attention?.people ?? [])
          .filter((p) => p.anomaly_count > 0)
          .map((p) => [
            p.name,
            p.anomaly_count,
            p.top_severity ? humanize(p.top_severity) : OMITTED,
            p.reasons.length ? p.reasons.map(humanize).join(", ") : OMITTED,
            Math.round(p.score),
          ]),
      });

      composed.set(cacheKey, { at: Date.now(), reports: out, window: win });
      while (composed.size > COMPOSE_KEEP) {
        const oldest = composed.keys().next().value;
        if (oldest === undefined) break;
        composed.delete(oldest);
      }
      if (!live) return;
      setReports(out);
      setReportWindow(win);
      setLoading(false);
    }

    const timer = setTimeout(() => {
      compose().catch(() => {
        if (!live) return;
        setError("Couldn't load reports. Check your connection and retry.");
        setLoading(false);
      });
    }, COMPOSE_DEBOUNCE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [date, nonce, userId]);

  const reload = useCallback(() => {
    composed.clear();
    setNonce((n) => n + 1);
  }, []);
  return { reports, window: reportWindow, loading, error, reload };
}

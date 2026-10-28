"use client";

/**
 * One employee's rich profile, assembled entirely from the **live backend** — no mock:
 *   - identity / contact / assignment  → `GET /v1/employees/{id}` + department / team / role maps;
 *   - productivity score               → `GET /v1/insights/user/{id}/activity`, last 30 days;
 *   - hours chart                      → `GET /v1/timesheet/user/{id}`, last 30 days (AI-63), with
 *                                        the day's attendance verdict from the activity read;
 *   - projects + per-project KPIs        → `GET /v1/projects/user/{id}` + `GET /v1/projects/{id}`.
 *
 * The output feeds the preview `EmployeeProfileData` shape verbatim. Fields the backend genuinely
 * doesn't carry (`dob`, `address`, `postcode`, `country`) are left `""`, and the page doesn't show
 * them at all — a Country row reading "—" for everyone said nothing (UX audit PEOPLE-15). The photo is not here: the page shows it through `<UserAvatar>` (the shared store).
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { formatDate, UNKNOWN_DEPARTMENT, UNKNOWN_ROLE, UNKNOWN_TEAM } from "@/lib/format";
import { listRoles } from "@/modules/roles/services/roles.service";
import {
  listUserProjects,
  getProject,
} from "@/modules/projects/services/projects.service";
import {
  getUserActivity,
  SCORE_WINDOW_DAYS,
} from "@/modules/insights/services/insights.service";
import { getUserDay } from "@/modules/attendance/services/attendance.service";
import { getUserTimesheet } from "@/modules/time-tracking/services/timesheet.service";
import { hoursFromActivity, hoursFromTimesheet, type HoursDay } from "./lib/hours-chart";
import {
  getEmployeeProfile,
  departmentMap,
  teamMap,
} from "./services/employees.service";

export interface ProjectItem {
  id: string;
  name: string;
  key: string;
  /** The **project's** completion %, `null` when its details couldn't be read (not 0). */
  progress: number | null;
  /** The **project's** task count — everyone's tasks — `null` when unread. */
  tasks: number | null;
  teammates: number;
  active: boolean;
}

export interface EmployeeProfileData {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  team: string;
  /** Raw backend ids (`""` when unset) — the edit dialog patches by id, not display name. */
  departmentId: string;
  teamId: string;
  roleName: string;
  /** Raw role id — needed to ask whether this person is a tracked contributor (`time-tracking:self`). */
  roleId: string;
  status: "active" | "inactive" | "invited" | "suspended";
  /** Excluded from tracking and attendance; still signs in (WP-233). */
  benched: boolean;
  /** `null` = no scored day in the window (agent not reporting) — **not** a score of zero. */
  productivityScore: number | null;
  empCode: string;
  phone: string;
  dob: string;
  hireDate: string;
  country: string;
  cityState: string;
  address: string;
  postcode: string;
  projects: ProjectItem[];
  /** The project list couldn't be read — which is not "on no projects" (WP-229). */
  projectsFailed: boolean;
  /**
   * Hours worked per day over the last 30 days, tagged with the day's attendance status. Only days
   * with time appear; a day with none is absent, never a measured zero.
   *
   * `source` says where the hours came from: the **timesheet** (timer sessions and corrections —
   * AI audit 2026-10-22, AI-63), or the **activity** rollup when the viewer can't read the timesheet,
   * or `null` when neither could be read.
   */
  kpi: { days: HoursDay[]; source: "timesheet" | "activity" | null };
  /** Whether the timesheet behind the chart was read (`forbidden`: no team/org timesheet access). */
  timeStatus: "ok" | "forbidden" | "failed";
  /**
   * Whether the activity behind the score and the chart was read. `forbidden`: the viewer may not
   * read org activity (a different bit from the directory's); `failed`: the read failed. Either way
   * "nothing recorded for this employee" would be a false statement about them (WP-229).
   */
  activityStatus: "ok" | "forbidden" | "failed";
  /**
   * Tasks across the projects they're on — **everyone's** tasks, not theirs: there is no
   * per-assignee read, and this was labelled as if it were theirs (QA audit 2026-10-08, WP-234).
   */
  totalTasks: number;
  /** Mean completion of the projects they're on (`null` when none could be read) — WP-234. */
  avgCompletion: number | null;
  /**
   * **Today's** attendance, live — not a closed verdict.
   *
   * The nightly 00:15 close is what resolves a day, so today's stored status reads `absent` all day
   * long and must never be shown as one. This is derived the way the Attendance page derives its
   * live "today" column (`classifyToday`): approved leave first, then whether a timer session exists
   * at all. Late-vs-on-time is deliberately not split here — that nuance belongs to the Attendance
   * page; a profile badge answers "are they in today".
   *
   * `null` when it could not be read (the caller lacks `AttendanceReadTeam`, or the request failed).
   */
  todayAttendance: "present" | "absent" | "leave" | null;
}

export interface EmployeeProfileState {
  data: EmployeeProfileData | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  reload: () => void;
}

/** `YYYY-MM-DD` in local calendar (the activity endpoint wants local, the server is UTC). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Run `fn` over `items` with a bounded concurrency, so a many-project fan-out can't throttle (503). */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** How many days back the daily hours chart spans. */
const DAILY_CHART_DAYS = 30;

export function useEmployeeProfile(id: string): EmployeeProfileState {
  const [data, setData] = useState<EmployeeProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setNotFound(false);

    (async () => {
      try {
        const now = new Date();
        // Only the days the page uses: the score and the chart both cover the last 30. This asked
        // for 12 months, for a monthly chart that no longer exists (QA audit 2026-10-08, WP-452).
        const days = Math.max(SCORE_WINDOW_DAYS, DAILY_CHART_DAYS);
        const from = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
        const to = ymd(now);

        let activityStatus: EmployeeProfileData["activityStatus"] = "ok";
        let timeStatus: EmployeeProfileData["timeStatus"] = "ok";
        let projectsFailed = false;
        const [p, depts, teams, roles, allProjects, activity, today, timesheet] = await Promise.all([
          getEmployeeProfile(id),
          departmentMap().catch(() => new Map<string, string>()),
          teamMap().catch(() => new Map<string, string>()),
          listRoles().catch(() => []),
          listUserProjects(id).catch(() => {
            projectsFailed = true;
            return [];
          }),
          getUserActivity(id, from, to).catch((e: unknown) => {
            activityStatus = e instanceof ApiError && e.status === 403 ? "forbidden" : "failed";
            return null;
          }),
          // Reads their `TIME#` sessions directly, so unlike the activity rollup it is meaningful
          // for a day that has not closed yet. Best-effort: a reader without `AttendanceReadTeam`
          // simply gets no attendance on the badge.
          getUserDay(id, ymd(now)).catch(() => null),
          // The hours chart's source (AI-63): timer sessions and approved corrections alike. Needs
          // `TimeReadTeam`; without it the chart falls back to the activity rollup.
          getUserTimesheet(id, from, to).catch((e: unknown) => {
            timeStatus = e instanceof ApiError && e.status === 403 ? "forbidden" : "failed";
            return null;
          }),
        ]);
        if (!live) return;

        // Every project this person is a member of (manager OR member) — the real membership scan.
        const memberProjects = allProjects.slice(0, 50); // safety cap on the per-project KPI fan-out
        const details = await mapLimit(memberProjects, 5, (pr) =>
          getProject(pr.id).catch(() => null),
        );
        if (!live) return;

        const projects: ProjectItem[] = memberProjects
          .map((pr, idx) => {
            const detail = details[idx];
            const kpi = detail?.kpi;
            return {
              id: pr.id,
              name: pr.name,
              key: pr.key ?? "",
              // Unknown, not 0%, when the project's details couldn't be read (WP-229).
              progress: kpi ? kpi.completion_pct : null,
              tasks: kpi ? kpi.total_tasks : null,
              teammates: kpi?.active_members ?? detail?.members.length ?? 0,
              active: pr.status === "active",
            };
          })
          .sort(
            (a, b) =>
              Number(b.active) - Number(a.active) || (b.progress ?? -1) - (a.progress ?? -1),
          );

        const known = projects.filter((pr) => pr.progress !== null);
        const totalTasks = projects.reduce((s, pr) => s + (pr.tasks ?? 0), 0);
        const avgCompletion = known.length
          ? Math.round(known.reduce((s, pr) => s + (pr.progress ?? 0), 0) / known.length)
          : null;

        // **The mean of this person's scored days over the last 30** (PRODUCTIVITY.md §3.1) —
        // deliberately *not* `trend.avg_score`, whose window is whatever was fetched. One window,
        // one meaning — the directory column uses the same 30 days.
        //
        // **`null` means "not measured", and it must stay `null`.** Collapsing it to `0` published
        // a fabricated verdict: a confident "0%", and a summary card calling the person a
        // "developing performer, averaging 0% productivity" — a statement about a missing agent
        // feed, not about them.
        const scoreCutoff = ymd(
          new Date(now.getFullYear(), now.getMonth(), now.getDate() - (SCORE_WINDOW_DAYS - 1)),
        );
        const recentScored = (activity?.days ?? []).filter((d) => d.date >= scoreCutoff);
        const productivityScore = recentScored.length
          ? Math.round(recentScored.reduce((s, d) => s + d.score, 0) / recentScored.length)
          : null;
        const chartCutoff = ymd(
          new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAILY_CHART_DAYS - 1)),
        );
        const activityDays = activity?.days ?? [];
        const kpi: EmployeeProfileData["kpi"] = timesheet
          ? {
              days: hoursFromTimesheet(
                timesheet.days,
                new Map(activityDays.map((d) => [d.date, d.attendance])),
                chartCutoff,
              ),
              source: "timesheet",
            }
          : activity
            ? {
                days: hoursFromActivity(
                  activityDays.map((d) => ({
                    date: d.date,
                    activeSec: d.active_sec,
                    workedMinutes: d.worked_minutes,
                    attendance: d.attendance,
                  })),
                  chartCutoff,
                ),
                source: "activity",
              }
            : { days: [], source: null };

        const roleName =
          roles.find((r) => r.id === p.role_id)?.name ??
          (p.role_id ? UNKNOWN_ROLE : "");

        setData({
          id: p.user_id,
          name: p.name,
          email: p.email,
          jobTitle: p.title ?? "",
          department: p.department_id ? (depts.get(p.department_id) ?? UNKNOWN_DEPARTMENT) : "",
          team: p.team_id ? (teams.get(p.team_id) ?? UNKNOWN_TEAM) : "",
          departmentId: p.department_id ?? "",
          teamId: p.team_id ?? "",
          roleName,
          roleId: p.role_id ?? "",
          status: p.status === "deactivated" ? "inactive" : "active",
          benched: p.benched ?? false,
          productivityScore,
          empCode: p.emp_id ?? "",
          phone: p.phone ?? "",
          dob: "", // not carried by the backend
          // The one date notation (UX audit XC-06).
          hireDate: p.joined_at ? formatDate(p.joined_at) : "",
          country: "", // not carried by the backend
          cityState: p.location ?? "",
          address: "", // not carried by the backend
          postcode: "", // not carried by the backend
          projects,
          projectsFailed,
          kpi,
          activityStatus,
          timeStatus,
          todayAttendance: today
            ? today.on_leave
              ? "leave"
              : // No session at all today and no leave ⇒ absent. Mirrors `classifyToday`.
                today.clock_in == null && !today.running
                ? "absent"
                : "present"
            : null,
          totalTasks,
          avgCompletion,
        });
        // No photo patch here any more: `<UserAvatar>` reads it from the shared store. Patching it
        // into `data` a moment after load changed `data`'s identity, which re-seeded an open Edit
        // dialog and wiped what was being typed (QA audit 2026-10-08, WP-454).
      } catch (e) {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [id, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, notFound, reload };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to this profile.";
    return e.message;
  }
  return "Couldn't load this employee. Check your connection and retry.";
}

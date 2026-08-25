"use client";

/**
 * One employee's rich profile, assembled entirely from the **live backend** — no mock:
 *   - identity / contact / assignment  → `GET /v1/employees/{id}` + department / team / role maps;
 *   - productivity score + 6-month trend → `GET /v1/insights/user/{id}/activity` (agent-fed);
 *   - projects + per-project KPIs        → `GET /v1/projects/user/{id}` + `GET /v1/projects/{id}`.
 *
 * The output feeds the preview `EmployeeProfileData` shape verbatim. Fields the backend genuinely
 * doesn't carry (`dob`, `address`, `postcode`, `country`, `avatarUrl`) are left `""` and the UI
 * renders them as an em dash. The KPI series is **avg productive hours / day** per month, derived
 * from the agent's `productive_sec` (a month with no scored day is `null`, never `0`).
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { UNKNOWN_DEPARTMENT, UNKNOWN_ROLE, UNKNOWN_TEAM } from "@/lib/format";
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
import {
  getEmployeeProfile,
  getEmployeeAvatarUrl,
  departmentMap,
  teamMap,
} from "./services/employees.service";

export interface ProjectItem {
  id: string;
  name: string;
  key: string;
  progress: number;
  tasks: number;
  teammates: number;
  active: boolean;
}

export interface EmployeeProfileData {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
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
  /** Hours worked per day over the last 30 days, tagged with the day's attendance status. Only days
   *  with data appear; an unreported day is absent, never a measured zero. */
  kpi: { days: { date: string; label: string; hours: number; status: string }[] };
  totalTasks: number;
  avgCompletion: number;
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

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** `YYYY-MM-DD` in local calendar (the activity endpoint wants local, the server is UTC). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

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

/** `2026-08-05` → `Aug 5` for a compact daily axis label. */
function dayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]} ${d}`;
}

/**
 * The employee's **hours worked per day** over the last {@link DAILY_CHART_DAYS} days, one entry per
 * day that has a recorded summary (oldest→newest), each tagged with the day's attendance status.
 *
 * Replaces the old 12-month "avg productive hours/day" buckets, which were meaningless for anyone
 * with only a few weeks of history: with one month of data the monthly series drew a single point
 * connected to zero — a diagonal ramp implying a trend where there was none. Simple daily bars, one
 * per worked day, show what actually happened; the bar colour is the attendance verdict.
 *
 * Height is the attendance-recorded work time (`worked_minutes`) when the day has closed, falling
 * back to tracked active time for a day the close cron hasn't resolved yet — so a bar always reflects
 * real time on the clock. **Only days with data appear** — an unreported day is absent, never a
 * measured zero.
 */
function buildDailyHours(
  days: { date: string; activeSec: number; workedMinutes: number; attendance: string }[],
  now: Date,
): { date: string; label: string; hours: number; status: string }[] {
  const cutoff = ymd(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DAILY_CHART_DAYS - 1)),
  );
  return days
    .filter((d) => d.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      label: dayLabel(d.date),
      hours: round1(d.workedMinutes > 0 ? d.workedMinutes / 60 : d.activeSec / 3600),
      status: d.attendance || "unknown",
    }));
}

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
        const from = ymd(new Date(now.getFullYear(), now.getMonth() - 11, 1));
        const to = ymd(now);

        const [p, depts, teams, roles, allProjects, activity, today] = await Promise.all([
          getEmployeeProfile(id),
          departmentMap().catch(() => new Map<string, string>()),
          teamMap().catch(() => new Map<string, string>()),
          listRoles().catch(() => []),
          listUserProjects(id).catch(() => []),
          getUserActivity(id, from, to).catch(() => null),
          // Reads their `TIME#` sessions directly, so unlike the activity rollup it is meaningful
          // for a day that has not closed yet. Best-effort: a reader without `AttendanceReadTeam`
          // simply gets no attendance on the badge.
          getUserDay(id, ymd(now)).catch(() => null),
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
              progress: kpi?.completion_pct ?? 0,
              tasks: kpi?.total_tasks ?? 0,
              teammates: kpi?.active_members ?? detail?.members.length ?? 0,
              active: pr.status === "active",
            };
          })
          .sort((a, b) => Number(b.active) - Number(a.active) || b.progress - a.progress);

        const totalTasks = projects.reduce((s, pr) => s + pr.tasks, 0);
        const avgCompletion = projects.length
          ? Math.round(projects.reduce((s, pr) => s + pr.progress, 0) / projects.length)
          : 0;

        // **The mean of this person's scored days over the last 30** (PRODUCTIVITY.md §3.1) —
        // deliberately *not* `trend.avg_score`, which covers the whole 12-month fetch. That fetch
        // stays because the KPI chart below genuinely needs a year of buckets; the headline number
        // does not, and a year-long average beside someone's name is both stale and unlike every
        // other surface. One window, one meaning — the directory column uses the same 30 days.
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
        const kpi = {
          days: buildDailyHours(
            (activity?.days ?? []).map((d) => ({
              date: d.date,
              activeSec: d.active_sec,
              workedMinutes: d.worked_minutes,
              attendance: d.attendance,
            })),
            now,
          ),
        };

        const roleName =
          roles.find((r) => r.id === p.role_id)?.name ??
          (p.role_id ? UNKNOWN_ROLE : "");

        setData({
          id: p.user_id,
          name: p.name,
          email: p.email,
          avatarUrl: undefined, // filled in below by `GET /v1/users/{id}/avatar`
          jobTitle: p.title ?? "",
          department: p.department_id ? (depts.get(p.department_id) ?? UNKNOWN_DEPARTMENT) : "",
          team: p.team_id ? (teams.get(p.team_id) ?? UNKNOWN_TEAM) : "",
          departmentId: p.department_id ?? "",
          teamId: p.team_id ?? "",
          roleName,
          roleId: p.role_id ?? "",
          status: p.status === "deactivated" ? "inactive" : "active",
          productivityScore,
          empCode: p.emp_id ?? "",
          phone: p.phone ?? "",
          dob: "", // not carried by the backend
          hireDate: p.joined_at ? fmtDate(p.joined_at) : "",
          country: "", // not carried by the backend
          cityState: p.location ?? "",
          address: "", // not carried by the backend
          postcode: "", // not carried by the backend
          projects,
          kpi,
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

        // The photo, second and separately. It is a presigned URL that expires, it is cosmetic,
        // and it needs its own permission (`employees:read`) — so it must never be able to fail
        // the page. Patched in when it lands; until then the card renders initials, which is the
        // correct empty state for someone who has not uploaded one.
        getEmployeeAvatarUrl(p.user_id)
          .then((url) => {
            if (live && url) setData((d) => (d ? { ...d, avatarUrl: url } : d));
          })
          .catch(() => {
            /* cosmetic — initials are a correct fallback */
          });
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

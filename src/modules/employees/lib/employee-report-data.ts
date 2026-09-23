/**
 * Collect everything a single employee's PDF report shows — **fetched at the moment of the click**,
 * never reused from what the profile page already rendered.
 *
 * Why re-fetch. The profile view loads once and can sit open for hours; a report downloaded from a
 * stale view would carry yesterday's hours under today's timestamp, which is the one thing an
 * exported file must not do (it gets forwarded, and nobody re-checks it against the app). So every
 * section here is read again through its module service, and the header stamps the instant it ran.
 *
 * Partial access is normal and is reported, not hidden. A manager may hold `activity:read` but not
 * `leave:manage`; the server answers 403 for the rest. Each optional source is therefore wrapped in
 * {@link section}, which turns a refusal into `{ ok: false, reason }` so the PDF can print "not
 * included — you don't have access to leave balances" instead of an empty table that reads as "this
 * person has none".
 */
import { ApiError } from "@/lib/api";
import { isoDay } from "@/lib/format";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  getEmployeeProfile,
  departmentMap,
  teamMap,
  type ApiEmployeeProfile,
} from "../services/employees.service";
import { listRoles } from "@/modules/roles/services/roles.service";
import {
  listUserProjects,
  getProject,
  type ApiProject,
  type ApiProjectDetail,
} from "@/modules/projects/services/projects.service";
import {
  getUserActivity,
  getUserAppUsage,
  SCORE_WINDOW_DAYS,
  type SelfActivity,
  type AppUsage,
} from "@/modules/insights/services/insights.service";
import {
  getUserTimesheet,
  type ApiGridResponse,
} from "@/modules/time-tracking/services/timesheet.service";
import {
  getUserDay,
  type ApiUserDayDetail,
} from "@/modules/attendance/services/attendance.service";
import {
  getOrgBalances,
  type ApiTypeBalance,
} from "@/modules/leave/services/leave.service";

/** How far back the report looks for day-level detail. 92 days is the server's timesheet cap. */
export const REPORT_WINDOW_DAYS = 90;
/** How far back the trend section looks. */
export const TREND_WINDOW_DAYS = 180;

/** A section that may be refused: either the data, or why it is absent. */
export type Section<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export interface ReportProgress {
  /** What is being fetched right now, phrased for a progress toast. */
  label: string;
  done: number;
  total: number;
}

export interface EmployeeReportData {
  generatedAt: Date;
  window: { from: string; to: string; days: number };
  profile: ApiEmployeeProfile;
  departmentName: string;
  teamName: string;
  roleName: string;
  today: Section<ApiUserDayDetail>;
  activity: Section<SelfActivity>;
  trend: Section<SelfActivity>;
  apps: Section<AppUsage>;
  timesheet: Section<ApiGridResponse>;
  leave: Section<ApiTypeBalance[]>;
  projects: Section<{ project: ApiProject; detail: ApiProjectDetail | null }[]>;
}

/** Run one optional source; a refusal becomes a printable reason rather than an exception. */
async function section<T>(label: string, run: () => Promise<T>): Promise<Section<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 403) return { ok: false, reason: `not included — you don't have access to ${label}` };
      if (e.status === 404) return { ok: false, reason: `no ${label} recorded` };
      return { ok: false, reason: `${label} unavailable (${e.message})` };
    }
    return { ok: false, reason: `${label} unavailable` };
  }
}

function daysBack(n: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (n - 1));
  return { from: isoDay(from), to: isoDay(to) };
}

/**
 * Gather the report. `onProgress` fires before each step so the caller can keep the "preparing"
 * toast honest about what is taking the time (the projects step is the slow one — one read per
 * project, bounded to 3 in flight).
 */
export async function collectEmployeeReport(
  userId: string,
  onProgress?: (p: ReportProgress) => void,
): Promise<EmployeeReportData> {
  const total = 6;
  let done = 0;
  const step = (label: string) => onProgress?.({ label, done: done++, total });

  const window = daysBack(REPORT_WINDOW_DAYS);
  const trendWindow = daysBack(TREND_WINDOW_DAYS);
  const today = isoDay(new Date());

  step("profile");
  const [profile, deptNames, teamNames, roles] = await Promise.all([
    getEmployeeProfile(userId),
    departmentMap().catch(() => new Map<string, string>()),
    teamMap().catch(() => new Map<string, string>()),
    listRoles().catch(() => []),
  ]);

  step("attendance");
  const [todayDetail, timesheet] = await Promise.all([
    section("today's attendance", () => getUserDay(userId, today)),
    section("timesheet", () => getUserTimesheet(userId, window.from, window.to)),
  ]);

  step("productivity");
  const [activity, trend] = await Promise.all([
    section("activity", () => getUserActivity(userId, window.from, window.to)),
    section("activity trend", () => getUserActivity(userId, trendWindow.from, trendWindow.to)),
  ]);

  step("apps and websites");
  const apps = await section("app usage", () => getUserAppUsage(userId, window.from, window.to));

  step("leave balances");
  const leave = await section("leave balances", async () => {
    const org = await getOrgBalances();
    const row = org.employees.find((e) => e.user_id === userId);
    if (!row) throw new ApiError("No leave ledger for this employee", 404);
    return row.balances;
  });

  step("projects and tasks");
  const projects = await section("projects", async () => {
    const list = await listUserProjects(userId);
    // One detail read per project for its KPIs; bounded so a member of twenty projects does not
    // open twenty sockets. A project that refuses (deleted, or not visible) degrades to null.
    const details = await mapWithConcurrency(list, 3, (p) =>
      getProject(p.id).catch(() => null),
    );
    return list.map((project, i) => ({ project, detail: details[i] }));
  });

  onProgress?.({ label: "building the PDF", done: total, total });

  return {
    generatedAt: new Date(),
    window: { ...window, days: REPORT_WINDOW_DAYS },
    profile,
    departmentName: profile.department_id ? deptNames.get(profile.department_id) ?? "—" : "—",
    teamName: profile.team_id ? teamNames.get(profile.team_id) ?? "—" : "—",
    roleName: roles.find((r) => r.id === profile.role_id)?.name ?? "—",
    today: todayDetail,
    activity,
    trend,
    apps,
    timesheet,
    leave,
    projects,
  };
}

/** The scoring window the productivity figure uses, for the PDF's method note. */
export const SCORE_WINDOW = SCORE_WINDOW_DAYS;

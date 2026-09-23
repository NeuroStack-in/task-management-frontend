/**
 * Collect everything the employee profile shows — **for the person's whole history**, fetched at
 * the moment of the click.
 *
 * Why re-fetch. The profile view loads once and can sit open for hours; a report downloaded from a
 * stale view would carry yesterday's hours under today's timestamp, which is the one thing an
 * exported file must not do (it gets forwarded, and nobody re-checks it against the app).
 *
 * Why chunk. Every history endpoint is range-capped server-side, and the caps differ:
 *   - timesheet     `MAX_DAYS = 92`      (`time-attendance/timesheet_grid/dto.rs`)
 *   - app usage     `MAX_RANGE_DAYS = 62`, and only the **top 15** apps + 15 sites per call
 *   - daily scores  `MAX_ROWS = 500` rows per query (`insights/activity_read/data.rs`)
 * So "all of it" means walking the range in chunks that respect each cap and merging the pieces —
 * which is what {@link chunks} and the `merge*` helpers below do. Requests run three at a time so a
 * two-year history doesn't open thirty sockets.
 *
 * Partial access is normal and is reported, not hidden. A manager may hold `activity:read` but not
 * `leave:manage`; the server answers 403. Each optional source is wrapped in {@link section}, which
 * turns a refusal into `{ ok: false, reason }` so the PDF prints why a section is missing instead of
 * an empty table that would read as "this person has none".
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
  type DayScore,
  type AppUsageRow,
} from "@/modules/insights/services/insights.service";
import {
  getUserTimesheet,
  type ApiGridResponse,
  type ApiDayRow,
} from "@/modules/time-tracking/services/timesheet.service";
import {
  getUserDay,
  type ApiUserDayDetail,
} from "@/modules/attendance/services/attendance.service";
import {
  getOrgBalances,
  type ApiTypeBalance,
} from "@/modules/leave/services/leave.service";

/** Server range caps, mirrored here so each walk asks for the most it is allowed in one call. */
const TIMESHEET_MAX_DAYS = 92;
const APPS_MAX_DAYS = 62;
const ACTIVITY_MAX_DAYS = 365;

/**
 * How far back to look when the employee record carries no join date.
 *
 * Three years, not "forever": the walk is bounded by wall-clock requests, and WorkPulse itself has
 * no data older than its first deploy. A person whose `joined_at` is set is walked from that date,
 * however long ago it is.
 */
const FALLBACK_HISTORY_DAYS = 3 * 365;

/** A section that may be refused: either the data, or why it is absent. */
export type Section<T> = { ok: true; data: T } | { ok: false; reason: string };

export interface ReportProgress {
  /** What is being fetched right now, phrased for a progress toast. */
  label: string;
  done: number;
  total: number;
}

/** One app or site, summed across every chunk of the person's history. */
export interface AppTotal extends AppUsageRow {
  kind: "App" | "Website";
}

export interface EmployeeReportData {
  generatedAt: Date;
  /** The full history actually walked, and whether its start was the join date or the fallback. */
  history: { from: string; to: string; days: number; anchoredOnJoinDate: boolean };
  profile: ApiEmployeeProfile;
  departmentName: string;
  teamName: string;
  roleName: string;
  today: Section<ApiUserDayDetail>;
  /** Every scored day the server holds, ascending, with a trend recomputed over all of them. */
  activity: Section<{ days: DayScore[]; trend: SelfActivity["trend"]; recentAvg: number | null }>;
  /** Every app/site total, merged across chunks. `truncated` = at least one chunk hit the top-N cap. */
  apps: Section<{ rows: AppTotal[]; truncated: boolean }>;
  /** Every day with recorded time, ascending, plus lifetime totals. */
  timesheet: Section<ApiGridResponse>;
  /** Leave ledger per year, newest year first. */
  leave: Section<{ year: string; balances: ApiTypeBalance[] }[]>;
  projects: Section<{ project: ApiProject; detail: ApiProjectDetail | null }[]>;
}

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

const dayMs = 86_400_000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
const shift = (iso: string, days: number) => isoDay(new Date(parse(iso) + days * dayMs));

/** Split `[from, to]` into inclusive windows of at most `size` days, oldest first. */
export function chunks(from: string, to: string, size: number): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  let cursor = from;
  while (parse(cursor) <= parse(to)) {
    const end = shift(cursor, size - 1);
    const clamped = parse(end) > parse(to) ? to : end;
    out.push({ from: cursor, to: clamped });
    cursor = shift(clamped, 1);
  }
  return out;
}

/** Fetch every window and concatenate, three requests in flight. A 403 on any window throws. */
async function walk<T>(
  windows: { from: string; to: string }[],
  run: (w: { from: string; to: string }) => Promise<T>,
  onChunk?: (done: number, total: number) => void,
): Promise<T[]> {
  let done = 0;
  return mapWithConcurrency(windows, 3, async (w) => {
    const r = await run(w);
    onChunk?.(++done, windows.length);
    return r;
  });
}

/** Merge day rows from several windows: dedupe by date, ascending, totals re-summed. */
function mergeTimesheet(parts: ApiGridResponse[], from: string, to: string): ApiGridResponse {
  const byDate = new Map<string, ApiDayRow>();
  for (const p of parts) for (const d of p.days) byDate.set(d.date, d);
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    from,
    to,
    days,
    total_secs: days.reduce((s, d) => s + d.total_secs, 0),
    billable_secs: days.reduce((s, d) => s + d.billable_secs, 0),
  };
}

/** Merge scored days and recompute the trend over the **whole** history, not per chunk. */
function mergeActivity(parts: SelfActivity[]): {
  days: DayScore[];
  trend: SelfActivity["trend"];
  recentAvg: number | null;
} {
  const byDate = new Map<string, DayScore>();
  for (const p of parts) for (const d of p.days) byDate.set(d.date, d);
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const scored = days.filter((d) => (d as unknown as { score?: number }).score != null);
  const scoreOf = (d: DayScore) => (d as unknown as { score: number }).score;
  const mean = (xs: DayScore[]) =>
    xs.length ? xs.reduce((s, d) => s + scoreOf(d), 0) / xs.length : null;
  const best = scored.reduce<DayScore | null>((b, d) => (!b || scoreOf(d) > scoreOf(b) ? d : b), null);
  const worst = scored.reduce<DayScore | null>((w, d) => (!w || scoreOf(d) < scoreOf(w) ? d : w), null);
  // The headline figure stays the product's 30-day window so the PDF agrees with the app.
  const cutoff = shift(isoDay(new Date()), -(SCORE_WINDOW_DAYS - 1));
  return {
    days,
    trend: {
      days_scored: scored.length,
      avg_score: mean(scored),
      best: best ? { date: best.date, score: scoreOf(best) } : null,
      worst: worst ? { date: worst.date, score: scoreOf(worst) } : null,
      // Baselines are per-response org figures; the most recent chunk's is the current one.
      baseline: parts.at(-1)?.trend.baseline ?? null,
    },
    recentAvg: mean(scored.filter((d) => d.date >= cutoff)),
  };
}

/** Merge app/site rows across chunks by name+kind, summing seconds. */
function mergeApps(parts: { apps: AppUsageRow[]; sites: AppUsageRow[]; truncated: boolean }[]): {
  rows: AppTotal[];
  truncated: boolean;
} {
  const acc = new Map<string, AppTotal>();
  const add = (row: AppUsageRow, kind: AppTotal["kind"]) => {
    const key = `${kind}::${row.name}`;
    const cur = acc.get(key);
    if (cur) cur.seconds += row.seconds;
    else acc.set(key, { ...row, kind });
  };
  for (const p of parts) {
    for (const a of p.apps) add(a, "App");
    for (const s of p.sites) add(s, "Website");
  }
  return {
    rows: [...acc.values()].sort((a, b) => b.seconds - a.seconds),
    truncated: parts.some((p) => p.truncated),
  };
}

/**
 * Gather the whole report. `onProgress` fires as each source starts and as long walks advance, so
 * the "preparing" toast can say what is taking the time.
 */
export async function collectEmployeeReport(
  userId: string,
  onProgress?: (p: ReportProgress) => void,
): Promise<EmployeeReportData> {
  const total = 6;
  let done = 0;
  const step = (label: string) => onProgress?.({ label, done: done++, total });
  const chunkStep = (label: string) => (n: number, of: number) =>
    onProgress?.({ label: of > 1 ? `${label} (${n}/${of})` : label, done, total });

  const today = isoDay(new Date());

  step("profile");
  const [profile, deptNames, teamNames, roles] = await Promise.all([
    getEmployeeProfile(userId),
    departmentMap().catch(() => new Map<string, string>()),
    teamMap().catch(() => new Map<string, string>()),
    listRoles().catch(() => []),
  ]);

  // History starts the day this person joined; without that date, three years back.
  const anchoredOnJoinDate = profile.joined_at != null;
  const start = anchoredOnJoinDate
    ? isoDay(new Date(profile.joined_at as number))
    : shift(today, -FALLBACK_HISTORY_DAYS);
  const from = parse(start) > parse(today) ? today : start;
  const history = {
    from,
    to: today,
    days: Math.round((parse(today) - parse(from)) / dayMs) + 1,
    anchoredOnJoinDate,
  };

  step("today's attendance");
  const todayDetail = await section("today's attendance", () => getUserDay(userId, today));

  step("timesheet history");
  const timesheet = await section("timesheet", async () =>
    mergeTimesheet(
      await walk(
        chunks(from, today, TIMESHEET_MAX_DAYS),
        (w) => getUserTimesheet(userId, w.from, w.to),
        chunkStep("timesheet history"),
      ),
      from,
      today,
    ),
  );

  step("daily scores");
  const activity = await section("activity", async () =>
    mergeActivity(
      await walk(
        chunks(from, today, ACTIVITY_MAX_DAYS),
        (w) => getUserActivity(userId, w.from, w.to),
        chunkStep("daily scores"),
      ),
    ),
  );

  step("apps and websites");
  const apps = await section("app usage", async () =>
    mergeApps(
      await walk(
        chunks(from, today, APPS_MAX_DAYS),
        (w) => getUserAppUsage(userId, w.from, w.to),
        chunkStep("apps and websites"),
      ),
    ),
  );

  step("leave and projects");
  const [leave, projects] = await Promise.all([
    // One ledger per calendar year the person has been here — the endpoint is year-scoped.
    section("leave balances", async () => {
      const years: string[] = [];
      for (let y = new Date(parse(from)).getFullYear(); y <= new Date().getFullYear(); y++) {
        years.push(String(y));
      }
      const ledgers = await mapWithConcurrency(years, 3, async (year) => {
        const org = await getOrgBalances(year);
        const row = org.employees.find((e) => e.user_id === userId);
        return row ? { year, balances: row.balances } : null;
      });
      const held = ledgers.filter((l): l is { year: string; balances: ApiTypeBalance[] } => l != null);
      if (held.length === 0) throw new ApiError("No leave ledger for this employee", 404);
      return held.reverse();
    }),
    section("projects", async () => {
      const list = await listUserProjects(userId);
      const details = await mapWithConcurrency(list, 3, (p) => getProject(p.id).catch(() => null));
      return list.map((project, i) => ({ project, detail: details[i] }));
    }),
  ]);

  onProgress?.({ label: "building the PDF", done: total, total });

  return {
    generatedAt: new Date(),
    history,
    profile,
    departmentName: profile.department_id ? deptNames.get(profile.department_id) ?? "—" : "—",
    teamName: profile.team_id ? teamNames.get(profile.team_id) ?? "—" : "—",
    roleName: roles.find((r) => r.id === profile.role_id)?.name ?? "—",
    today: todayDetail,
    activity,
    apps,
    timesheet,
    leave,
    projects,
  };
}

/** The scoring window the headline productivity figure uses, for the PDF's method note. */
export const SCORE_WINDOW = SCORE_WINDOW_DAYS;

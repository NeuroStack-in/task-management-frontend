/**
 * The org dashboard's data contract.
 *
 * The types below are the exact shape the (verbatim) preview widgets consume; the values are now
 * assembled from the **live backend** by `use-dashboard-data.ts` (was a seeded mock builder). Where a
 * source needs the desktop agent that isn't reporting yet (heatmap, screenshots, per-person scores),
 * the field degrades honestly to 0 / empty and its widget shows a "waiting on the agent" state — no
 * fabricated numbers.
 */
import type { User } from "@/types/user";

/* --------------------------------- filters -------------------------------- */

export type DashboardRange = "today" | "7d" | "30d" | "range";

/**
 * The single day a range covers, or `null` when it covers more than one.
 *
 * **A one-day custom range is a day.** Picking "Aug 15 – Aug 15" and being told narratives only
 * exist per day/week/month was a property of the picker's mode, not of the data — a daily narrative
 * for that date exists, and refusing it is why a Saturday chosen by hand looked like it had no
 * dashboard at all.
 *
 * Extracted from the summary widget so the rule is testable: it was previously an inline expression
 * that could only be checked by reading it, and reading it is what let the original bug ship.
 */
/** Monday of the ISO week containing `iso`, as `YYYY-MM-DD`. */
function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  // getDay(): 0 = Sunday. Shift so Monday is the first day, matching the ISO week the rest of the
  // product reports on (the weekly AI report, the attendance week).
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/**
 * Fold daily trend points into one bar per ISO week.
 *
 * A month drawn per-day is ~22 bars in a card a few hundred pixels wide: the labels collide, every
 * bar is a sliver, and the shape of the month — which is the only thing anyone reads a month view
 * for — is lost in the noise. Weeks are the unit the rest of the product already reports a month in
 * (the monthly AI report narrates the month's *weeklies*), so this matches it rather than inventing
 * a third granularity.
 *
 * Hours are **summed**, not averaged: the bar's height stays "hours tracked", exactly as it means on
 * a daily bar. Averaging would silently change what the y-axis measures halfway through the range
 * picker.
 */
export function foldToWeeks(points: TrendPoint[]): TrendPoint[] {
  const byWeek = new Map<string, TrendPoint>();
  for (const p of points) {
    const start = weekStart(p.iso);
    const acc = byWeek.get(start);
    if (acc) {
      acc.productiveH += p.productiveH;
      acc.neutralH += p.neutralH;
      acc.distractingH += p.distractingH;
      acc.unclassifiedH += p.unclassifiedH;
      // Coverage is people, not hours, so it cannot be summed — the same person reporting Monday
      // and Tuesday is one person, and adding would claim ten reporters in a team of five. The peak
      // day is the best available answer from daily counts, and it is the same choice
      // `org_period::org_totals` makes server-side (`peak_people_with_data`).
      acc.reported = Math.max(acc.reported, p.reported);
    } else {
      const d = new Date(`${start}T00:00:00`);
      byWeek.set(start, {
        ...p,
        iso: start,
        // The week's Monday — "Aug 3" reads as a week when the axis says so, and stays short enough
        // not to collide at five or six bars.
        label: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
      });
    }
  }
  return [...byWeek.values()]
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .map((p) => ({
      ...p,
      productiveH: Math.round(p.productiveH * 10) / 10,
      neutralH: Math.round(p.neutralH * 10) / 10,
      distractingH: Math.round(p.distractingH * 10) / 10,
      unclassifiedH: Math.round(p.unclassifiedH * 10) / 10,
    }));
}

export function singleDayOf(
  range: DashboardRange,
  days: string[] | undefined,
): string | null {
  return range === "range" && days?.length === 1 ? days[0] : null;
}

export const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Week" },
  { value: "30d", label: "Month" },
  { value: "range", label: "Custom" },
];

export interface DashboardFilters {
  range: DashboardRange;
  /**
   * `"all"` or a **`department_id`**.
   *
   * It holds the id, not the display name, deliberately. Matching on the label meant the filter
   * broke in three ways: two departments sharing a name silently merged; a department whose label
   * was missing from `GET /v1/departments` fell back to its raw UUID and appeared in the dropdown as
   * one; and a rename mid-session stopped matching entirely. The id is also what the server's
   * `?dept=` query wants, which is what makes the roster properly paginated.
   */
  team: string;
  /** ISO "YYYY-MM-DD" bounds, only used when range === "range". */
  start?: string;
  end?: string;
}

/** One entry in the dashboard's department ("team") filter — id for matching, label for display. */
export interface TeamOption {
  id: string;
  label: string;
}

/**
 * Headcount buckets the **server can actually distinguish** — deliberately *not*
 * `Record<UserStatus, number>`.
 *
 * `UserStatus` is the mock/seed vocabulary (`active | inactive | invited | suspended`). The real
 * `workforce` context only ever produces three states, and they don't line up with it:
 *
 * | Server | Where it lives | Here |
 * |---|---|---|
 * | `active` | `USER#` row | `active` |
 * | `deactivated` | `USER#` row | `inactive` (the UI's word — normalised at the service seam) |
 * | `invited` | an `INVITE#` row, **not** in the directory | `invited` |
 * | — | there is no suspended state | *(dropped)* |
 *
 * The third row is the trap: `create_invite` writes `INVITE#`/`EMAILREF#` items and **no `USER#`
 * row**, so an invited person is absent from `GET /v1/employees` entirely. Counting the directory
 * alone can never produce a non-zero `invited` — it has to come from `GET /v1/employees/invites`.
 */
export interface HeadcountCounts {
  active: number;
  /** Employment ended — the server's `deactivated`. */
  inactive: number;
  /** Invite sent, not yet accepted, not yet expired. */
  invited: number;
}

/* ------------------------------- shared types ----------------------------- */

export interface KpiSeries {
  value: number;
  deltaPct: number;
  trend: number[];
}

export interface TrendPoint {
  label: string;
  /** `YYYY-MM-DD` this point covers — the key the weekly fold buckets on. */
  iso: string;
  /**
   * Active hours split by how the agent classified the apps in use. `productive`/`neutral`/
   * `distracting` come from the agent's classified spans; `unclassified` is active time no span
   * covered — the honest "we tracked time but couldn't say what it was" band. Together the four sum
   * to the day's active hours, so the stacked bar's height *is* hours tracked.
   *
   * This replaced a dual-axis line (a black-box 0–100 "score" beside a percentage). The score sat at
   * ~50 on any day the agent hadn't classified apps — a partial score (quality term dropped,
   * `q_measured:false`) rendered as if it were real. Concrete hours can't lie that way: a day with no
   * classification simply shows as the faded `unclassified` band, and a day with nothing at all is
   * an empty column, not a confident 50.
   */
  productiveH: number;
  neutralH: number;
  distractingH: number;
  unclassifiedH: number;
  /**
   * How many in-scope people reported activity that day (coverage). `0` means nobody's agent
   * reported — the column is genuinely empty, not "0 hours worked". Surfaced in the tooltip so a low
   * bar reads as "few reported", not "little work".
   */
  reported: number;
}

/**
 * One day on the **Productivity trends** line widget — the trend restored with *actual* values, made
 * honest. Both series are `null` (a gap, `connectNulls={false}`) on any day the value couldn't be
 * genuinely measured, so the line breaks rather than inventing a point:
 *
 * - `score` — the 0–100 composite, averaged **only over people whose quality was actually measured**
 *   (`breakdown.q_measured`). A partial score (quality dropped, the ~50 the old card showed) is never
 *   plotted; a day with no fully-measured person is a gap.
 * - `share` — productive % of active time, only when apps were classified at all (else `null`, not a
 *   misleading 0%).
 */
export interface ScoreTrendPoint {
  label: string;
  score: number | null;
  share: number | null;
  /** People contributing a genuinely-measured score that day — shown in the tooltip as coverage. */
  measured: number;
}

/**
 * Attendance buckets for the donut. These are the real `time-attendance` statuses the oversight
 * endpoint serves (`present` / `partial` / `absent` / `leave`); `non_workday` is excluded from the
 * tally and there is no per-person `late` on that index, so it isn't invented here.
 */
export type AttendanceStatus = "present" | "partial" | "leave" | "absent";

/** A ranked performer for the Top performers widget — the lean shape it actually needs. */
export interface Performer {
  id: string;
  name: string;
  department: string;
  productivityScore: number;
  avatarUrl?: string;
}

export interface DashboardData {
  range: DashboardRange;
  team: string;
  rangeLabel: string;
  /**
   * The days the KPIs actually cover, resolved. Carried so widgets can tell a **one-day** custom
   * range from a three-month one: "Aug 15 – Aug 15" is a day, and refusing it a daily narrative
   * because the picker mode happens to be "Custom" is a limitation of the picker, not of the data.
   */
  days: string[];
  /**
   * The window the trend chart actually draws, which is **not** always `days`: a single-day
   * selection widens to a rolling week, because one point is not a trend. Labelling that chart with
   * the KPI range made it claim to show one day while showing seven.
   */
  trendLabel: string;
  kpis: {
    productivity: KpiSeries;
    // Point-in-time (shown for the "Today" range)
    active: KpiSeries;
    inactive: KpiSeries;
    timers: KpiSeries;
    // Period aggregates (shown for 7d / 30d / range)
    hours: KpiSeries;
    attendance: KpiSeries;
    newHires: KpiSeries;
  };
  productivityTrend: TrendPoint[];
  productivityScoreTrend: ScoreTrendPoint[];
  teamData: { team: string; score: number }[];
  screenshotCount: number;
  /**
   * `true` when at least one day in the window hit the screenshot grid's page cap, so
   * `screenshotCount` is a **floor**, not a total. Render it as "1,234+" rather than a precise
   * figure — silently publishing a capped count as exact is how a filtered view ends up quietly
   * under-reporting.
   */
  screenshotCountPartial: boolean;
  screenshotsTrend: number[];
  /**
   * Distinct employees with at least one capture over the range — "is monitoring actually reaching
   * the team", the question a bare total can't answer. `0` when nothing was captured.
   */
  screenshotsCoverage: number;
  /** Captures worth a review (a distracting-app frame, `ShotRow.flagged`) — the actionable queue. */
  screenshotsFlagged: number;
  /**
   * Server-classified split of the range's captures, for the on-task bar. All zero when the agent's
   * captures are unclassified (older frames), which the widget renders as an honest "unclassified".
   */
  screenshotsSplit: { productive: number; neutral: number; distracting: number };
  topPerformers: Performer[];
  billing: { plan: string; seatsUsed: number; seatsTotal: number };
  heatmap: number[][];
  attendanceCounts: Record<AttendanceStatus, number>;
  /**
   * How many **closed** days in the window actually carry attendance statuses.
   *
   * `0` means the rate is not measurable yet, not that it is zero — today's statuses don't exist
   * until the 00:15 close cron runs. Consumers must render an absence, never `0%`, or the card
   * reads "nobody attended" next to a live productivity score built from those same people.
   */
  attendanceResolvedDays: number;
  /**
   * How many of the trackable team actually produced a score, for the best-covered day in the
   * window. The productivity score divides by `team`, so this is what makes a low number readable:
   * "4% · 1 of 14 reporting" is thin coverage, not a collapsed workforce.
   */
  productivityCoverage: { scored: number; team: number };
  statusCounts: HeadcountCounts;
  /**
   * Directory headcount — **employment status**, not "working right now".
   *
   * The KPI strip's live pair (`kpis.active` / `kpis.inactive`) counts *running timers* and is
   * labelled "Working now / Not working" for exactly this reason: both facts used to be called
   * "active" and rendered on the same screen with different values.
   */
  activeCount: number;
  inactiveCount: number;
}

/* --------------------------------- helpers -------------------------------- */

/** Distinct departments (the dashboard's "team" axis), sorted. */
export function teamsOf(users: User[]): string[] {
  return Array.from(new Set(users.map((u) => u.department))).sort();
}

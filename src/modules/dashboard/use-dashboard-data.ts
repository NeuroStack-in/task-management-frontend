"use client";

/**
 * The org dashboard's data — assembled from the **live backend**, honestly.
 *
 * Given the active filters (`range` + optional `team` department + custom bounds) this resolves the
 * window's dates, then fans out the per-day monitoring reads (bounded, skip-on-fail — an unbounded
 * burst throttles the Lambda and 503s the page) and joins them with the directory / roles / billing:
 *
 *   - productivity, hours, top performers, team comparison  ← `getOrgActivity(day)` per day
 *   - attendance rate + the attendance donut                ← `getDayOversight(day)` per day
 *   - screenshots                                           ← `getScreenshots(day)` per day
 *   - active / inactive / headcount                         ← `getEmployees()` directory
 *   - running timers                                        ← `getFleet()` online devices
 *   - billing seats                                         ← `getBillingOverview()`
 *
 * Everything the desktop agent must feed (scores, hours, screenshots, heatmap) is **0 / empty until an
 * agent reports** — a gap, never a fabricated number.
 *
 * Two notes that were wrong here and misled a later reader into thinking the heatmap was unwired:
 *
 *  - **The heatmap is real.** It is built below from screenshot capture density (weekday × 2-hour
 *    buckets, normalised to the window's busiest cell), not from a per-hour score endpoint — there
 *    is none, because the scorer stores daily totals. It is empty only when the window genuinely
 *    holds no captures. Its widget is titled "Activity heatmap" for that reason: capture density is
 *    *when work happened*, never how productive it was.
 *  - **`deltaPct` is 0 because nothing renders it.** No StatCard on the dashboard passes `delta`, so
 *    the field is unused rather than a 0% that reads as "no change". If a card ever wants one, the
 *    prior window has to be fetched and the type widened to `number | null` — a computed 0 and an
 *    uncomputed one must not look alike.
 */
import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { ApiError } from "@/lib/api";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  listAllEmployees,
  listInvites,
  departmentMap,
} from "@/modules/employees/services/employees.service";
import { contributorRoleIds } from "@/modules/roles/services/roles.service";
import { getUserDay } from "@/modules/attendance/services/attendance.service";
import { todayIso, UNKNOWN_DEPARTMENT } from "@/lib/format";
import { getBillingOverview } from "@/modules/billing/services/billing.service";
// The local-day filter the heatmap needs: screenshots are partitioned by UTC date.
import { localDateOf } from "@/lib/local-day";
import {
  getOrgActivity,
  getScreenshots,
  type OrgActivity,
} from "@/modules/insights/services/insights.service";
import {
  getDayOversight,
  type ApiDayResponse,
} from "@/modules/attendance/services/attendance.service";
import { foldToWeeks } from "./lib/dashboard-data";
import type {
  DashboardData,
  DashboardFilters,
  LiveTimer,
  Performer,
  ScoreTrendPoint,
  TeamOption,
  TrendPoint,
} from "./lib/dashboard-data";

/** Bounded per-day fan-out — a small cap so a month window doesn't burst the Lambda. */
const DAY_FANOUT = 3;
/** Screenshots are paginated; a page is plenty to count activity for a day. */
const SHOT_PAGE = 200;
/** Hard ceiling on days fanned out for a custom range, so a huge window can't storm the API. */
const MAX_DAYS = 62;

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Resolve the filter window to a list of `YYYY-MM-DD` days in the client's local calendar. */
function resolveDays(f: DashboardFilters): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (f.range === "today") return [isoOf(today)];

  if (f.range === "7d") {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      return isoOf(d);
    });
  }

  if (f.range === "30d") {
    // "Month" = the 1st of the current month through today.
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const days: string[] = [];
    for (let d = new Date(first); d <= today; d.setDate(d.getDate() + 1)) {
      days.push(isoOf(new Date(d)));
    }
    return days;
  }

  // Custom range — needs both bounds; enumerate inclusively, capped.
  if (!f.start || !f.end) return [];
  const s = new Date(`${f.start}T00:00:00`);
  const e = new Date(`${f.end}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return [];
  const days: string[] = [];
  for (
    let d = new Date(s);
    d <= e && days.length < MAX_DAYS;
    d.setDate(d.getDate() + 1)
  ) {
    days.push(isoOf(new Date(d)));
  }
  return days;
}

function rangeLabelFor(f: DashboardFilters, days: string[]): string {
  if (f.range === "today") return "today";
  if (f.range === "7d") return "this week";
  if (f.range === "30d") return "this month";
  if (days.length === 0) return "selected range";
  const s = new Date(`${days[0]}T00:00:00`);
  const e = new Date(`${days[days.length - 1]}T00:00:00`);
  return `${SHORT_MONTH[s.getMonth()]} ${s.getDate()} – ${SHORT_MONTH[e.getMonth()]} ${e.getDate()}`;
}

/** Compact per-day label for the trend chart: weekday for short windows, else M/D. */
function dayLabel(iso: string, shortWindow: boolean): string {
  const d = new Date(`${iso}T00:00:00`);
  return shortWindow ? SHORT_DAY[d.getDay()] : `${d.getMonth() + 1}/${d.getDate()}`;
}

interface DayBundle {
  iso: string;
  activity: OrgActivity | null;
  oversight: ApiDayResponse | null;
  shots: number;
  /** The day's grid was cut off at `SHOT_PAGE`, so `shots` is a floor, not a total. */
  shotsTruncated: boolean;
  /** In-scope screenshot counts bucketed by local hour-of-day (0..23) — feeds the heatmap. */
  hourly: number[];
  /** Captures worth a review this day (`ShotRow.flagged`). */
  flagged: number;
  /** Server-classified category tallies for the day's in-scope captures. */
  productive: number;
  neutral: number;
  distracting: number;
  /** Distinct employees seen in this day's captures — unioned across the range for coverage. */
  userIds: string[];
}

export interface DashboardDataState {
  data: DashboardData | null;
  teams: TeamOption[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useDashboardData(filters: DashboardFilters): DashboardDataState {
  const [data, setData] = useState<DashboardData | null>(null);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Live: a quiet background re-fetch every 30 s, so time on screen keeps up with what the
  // agents have uploaded. `reload` stays the visible path; the poll uses `refresh`.
  const { nonce, reload, isBackground } = useLiveRefresh();
  const { range, team, start, end } = filters;

  useEffect(() => {
    let live = true;
    if (!isBackground()) setLoading(true);
    setError(null);

    (async () => {
      try {
        const days = resolveDays({ range, team, start, end });

        // Range-independent org context. Billing/roles are best-effort (a 403 must not blank the board).
        //
        // `listAllEmployees` (not `listEmployees`) is load-bearing: the bare directory call returns
        // the alphabetically-first 50 people with **no cursor to page past them**, so departments
        // sorting late simply never appeared in the filter below. A filter missing its options reads
        // as "filtering is broken", which is exactly what it was.
        const [roster, deptNames, contributorIds, invites] = await Promise.all([
          listAllEmployees(),
          departmentMap().catch(() => new Map<string, string>()),
          // A failed roles read must not empty the KPI — fall back to counting everyone.
          contributorRoleIds().catch(() => null),
          // Invited people are **not** directory rows (see `HeadcountCounts`), so the only way to
          // count them is the invites list. Needs a higher permission than the dashboard does, so a
          // 403 degrades to "no invites known" rather than blanking the board.
          listInvites().catch(() => []),
        ]);
        const billing = await getBillingOverview().catch(() => null);
        if (!live) return;

        // The filter matches on `department_id`; the label is display-only (see DashboardFilters).
        const deptLabel = (id: string) =>
          deptNames.get(id) ?? (id ? UNKNOWN_DEPARTMENT : "");
        const teamList: TeamOption[] = Array.from(
          new Set(roster.map((e) => e.department_id).filter(Boolean)),
        )
          .map((id) => ({ id, label: deptLabel(id) }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setTeams(teamList);

        // A `team` that no longer exists (renamed away, or a stale selection) scopes to nobody
        // rather than silently reverting to the whole org — an empty board is honest, a full one
        // pretending to be filtered is not.
        const scopeUserIds =
          team === "all"
            ? null
            : new Set(
                roster.filter((e) => e.department_id === team).map((e) => e.user_id),
              );
        const inScopeUser = (id: string) => scopeUserIds === null || scopeUserIds.has(id);

        /**
         * Who the **attendance** figures are about — people who can actually clock in.
         *
         * An Owner/Admin holds no `TimeTrackSelf`, never starts a timer, and so §7 resolves them to
         * `absent` on every scheduled workday. Counting them put a permanent, unreachable ceiling on
         * the org attendance rate and inflated the donut's Absent slice — the same reason the
         * "working now" roster below already excludes them, and the same rule
         * `useOversightAttendance` applies on the Attendance page.
         *
         * This is a deliberate reversal of the note in `insights::shared::contributors`, which said
         * the contributor filter must not be used for attendance because "admins are real employees:
         * they attend, they take leave". True of the *concept*, false of the *measurement*: nothing
         * records an admin attending, so the only value the system can compute for them is `absent`.
         * Decision taken 2026-08-19 — the dashboard now agrees with the Attendance page.
         *
         * Fails OPEN: with no roles read we cannot tell, and filtering everyone out would report an
         * empty org rather than an unfiltered one.
         */
        const trackedUserIds = new Set(
          roster.filter((e) => e.role_id && contributorIds?.has(e.role_id)).map((e) => e.user_id),
        );
        const isTracked = (id: string) => contributorIds === null || trackedUserIds.has(id);
        const inScopeDept = (id: string) => team === "all" || id === team;

        // Directory-derived headcount (dept-filtered) — **employment status**, not "working now".
        // `inactive` is the server's `deactivated`, matched explicitly rather than as
        // `!== "active"`: the catch-all silently swept up any future status the server adds, and it
        // is what made an invited person count as "inactive".
        const scopedRoster = roster.filter((e) => inScopeUser(e.user_id));
        const activeCount = scopedRoster.filter((e) => e.status === "active").length;
        const inactiveCount = scopedRoster.filter((e) => e.status === "deactivated").length;

        // Pending invites, scoped to the selected department. Expiry is lazy server-side, so a
        // `pending` row whose `expires_at` (epoch **seconds**) has passed is really expired.
        const nowSec = Date.now() / 1000;
        const invitedCount = invites.filter(
          (i) =>
            i.status === "pending" &&
            i.expires_at > nowSec &&
            inScopeDept(i.department_id),
        ).length;

        /**
         * Who is actually working right now — the same derivation `/attendance` uses, deliberately.
         *
         * The KPI cards link to that roster, so a card reading 14 above a table listing 1 is the
         * card being wrong, not a difference of opinion. Two things have to match for the numbers
         * to agree:
         *
         *  - **Who counts.** Only people who can run a timer. An Owner/Admin holds no
         *    `TimeTrackSelf` by construction, so counting them makes everyone permanently "not
         *    working". This is why the roster says 12 where the directory says 14.
         *  - **What "working" means.** A running timer, read per-user off the same endpoint the
         *    roster reads. Device presence is a different fact and disagreed with it constantly.
         *
         * Bounded fan-out, skip-on-failure: one call per timer-holding employee. A failed row
         * counts as not-working rather than failing the dashboard.
         */
        const timerHolders = scopedRoster.filter(
          (e) =>
            e.status === "active" &&
            (contributorIds === null || contributorIds.has(e.role_id ?? "")),
        );
        const todayForTimers = todayIso();
        const todayStatus = await mapWithConcurrency(timerHolders, 4, (e) =>
          getUserDay(e.user_id, todayForTimers).then(
            // `present` = has clocked in at all today (a live signal — the attendance *verdict* only
            // exists after the nightly close), so the Attendance donut has something truthful to show
            // for the Today range instead of a blank "resolved tomorrow".
            (d) => ({
              employee: e,
              running: d.running === true,
              present: Boolean(d.clock_in),
              // A running session we can tick live: only when today is a SINGLE session, so `clock_in`
              // IS the open session's own start. Then `now − start` is exact — there is no closed time
              // to double-count (`tracked_sec` is 0 for such a user) and no earlier break to overstate.
              liveStart:
                d.running === true && d.entry_count === 1 && typeof d.clock_in === "number"
                  ? d.clock_in
                  : null,
            }),
            () => ({
              employee: e,
              running: false,
              present: false,
              liveStart: null as number | null,
            }),
          ),
        );
        const workingNow = todayStatus.filter((s) => s.running).length;
        // The per-employee "who is tracking right now" list the Working-now widget renders and ticks
        // live. Longest-running first (earliest start), the not-precisely-tickable rows last.
        const liveTimers: LiveTimer[] = todayStatus
          .filter((s) => s.running)
          .map((s) => ({
            userId: s.employee.user_id,
            name: s.employee.name,
            department: deptLabel(s.employee.department_id),
            liveStart: s.liveStart,
          }))
          .sort((a, b) => {
            if (a.liveStart === null) return b.liveStart === null ? 0 : 1;
            if (b.liveStart === null) return -1;
            return a.liveStart - b.liveStart;
          });
        const notWorkingNow = timerHolders.length - workingNow;
        const presentToday = todayStatus.filter((s) => s.present).length;
        // Starts of the running sessions the KPI can accrue in real time (see `liveStart`). Only
        // added when the selected window actually contains today.
        const runningStarts = todayStatus
          .map((s) => s.liveStart)
          .filter((v): v is number => v !== null);
        const rangeIncludesToday = days.includes(todayForTimers);

        // Per-day monitoring reads — bounded + skip-on-fail. A day with no agent data just contributes
        // nothing (nulls), never a seeded number.
        const bundles = await mapWithConcurrency<string, DayBundle>(
          days,
          DAY_FANOUT,
          async (iso) => {
            const [activity, oversight, grid] = await Promise.all([
              getOrgActivity(iso).catch(() => null),
              getDayOversight(iso).catch(() => null),
              getScreenshots(iso, { limit: SHOT_PAGE }).catch(() => null),
            ]);
            // ⚠️ One page only, and `SHOT_PAGE` is already the server's `MAX_LIMIT`. Following the
            // cursor here would mean up to 62 days × N pages of sequential requests, which is
            // exactly the fan-out that throttles the Lambda. So the count can be a floor — and when
            // it is, say so (`shotsTruncated`) rather than publish a precise-looking undercount.
            // Filtering by team makes this sharper: the scoped user's frames may sit past the cut.
            const scopedShots = grid
              ? grid.shots.filter((s) => inScopeUser(s.user_id))
              : [];
            // Prefer the server's EXACT day total (a `Select=COUNT`) when we're org-wide — so the
            // tile shows "247", not a "200+" page floor. The total is org-wide, so a department
            // filter can't use it (it would over-count); that case keeps the page-length floor,
            // which is at least honest about being one.
            const exactTotal =
              team === "all" && grid && typeof grid.total === "number"
                ? grid.total
                : null;
            const shots = exactTotal ?? scopedShots.length;
            const shotsTruncated =
              exactTotal !== null
                ? false
                : grid
                  ? Boolean(grid.cursor) || grid.shots.length >= SHOT_PAGE
                  : false;
            // One pass over the day's in-scope frames: the activity-heatmap bucket, review flags,
            // the productive/neutral/distracting split, and who was captured — all from data
            // already fetched, no extra request.
            //
            // **Filtered to the local day first, and that filter covers every counter here.** The
            // endpoint partitions on the UTC date, so at any non-zero offset this page's frames
            // straddle two local days. Bucketing them all by local hour attributed the neighbouring
            // day's captures to this weekday's row — and because the heatmap's columns start at
            // 8am, the ones that wrapped past local midnight fell outside every column and were
            // **silently dropped**. Same mismatch as the hourly chart (`lib/local-day`), quieter
            // because nothing appeared out of place. The counts below are per-day figures reported
            // against `iso`, so they need the same cut for the same reason.
            const hourly = new Array(24).fill(0);
            let flagged = 0;
            let productive = 0;
            let neutral = 0;
            let distracting = 0;
            const seen = new Set<string>();
            for (const s of scopedShots) {
              if (localDateOf(s.captured_at) !== iso) continue;
              const h = new Date(s.captured_at).getHours();
              if (h >= 0 && h < 24) hourly[h] += 1;
              if (s.flagged) flagged += 1;
              if (s.category === "productive") productive += 1;
              else if (s.category === "distracting") distracting += 1;
              else neutral += 1;
              seen.add(s.user_id);
            }
            return {
              iso,
              activity,
              oversight,
              shots,
              shotsTruncated,
              hourly,
              flagged,
              productive,
              neutral,
              distracting,
              userIds: [...seen],
            };
          },
        );
        if (!live) return;

        // ── Productivity + hours + trend, over the whole trackable team (dept-aware). ──
        //
        // **The denominator is who reported, and coverage travels beside the number**
        // (PRODUCTIVITY.md §3.2). This divided by the whole trackable team for a while, on the
        // reasoning that org-wide "nobody logged productive time" is itself an outcome. That reads
        // well until you see what it produced: with 5 of 14 agents reporting, the same day showed
        // ~24% here and ~66% on Insights, both labelled a productivity score. A number that halves
        // because two laptops were switched off is measuring *reporting*, not productivity — and
        // the fix for "the score doesn't say how many it covers" is to show the coverage, which
        // this already does, not to fold the gap into the score itself.
        //
        // A coverage-adjusted figure is a legitimate metric; if it comes back it carries its own
        // name (§3.2), never the label "productivity score".
        //
        // Who counts is the same rule this file already applies to "working now": active employees
        // holding a contributor role. An Owner/Admin cannot run the agent by construction, so
        // including them would cap the achievable score below 100% forever.
        const trackableIds = new Set(timerHolders.map((e) => e.user_id));
        // §3.3 — pooled person-days, not a mean of daily means: a Saturday with one reporter must
        // not weigh as much as a Tuesday with fourteen.
        // KPI aggregates over the **selected range** (§3.3 pooled person-days).
        let scoreSum = 0;
        let scoredPersonDays = 0;
        let trackedSecTotal = 0;
        let coverageScored = 0;
        let coverageTeam = 0;
        // People who DID report, whether or not the day cleared the volume floor. `breakdown` is
        // withheld below 30 minutes of active time (MIN_ACTIVE_SEC_TO_SCORE) while `totals` is
        // always set, so this is the only way to tell "no agent running" from "agent running, too
        // little activity to score" — two states the tile used to describe with one sentence.
        let coverageReported = 0;
        for (const b of bundles) {
          const people = (b.activity?.people ?? []).filter(
            (p) => inScopeDept(p.department_id) && trackableIds.has(p.user_id),
          );
          const scored = people.filter((p) => p.breakdown);
          scoreSum += scored.reduce((s, p) => s + (p.breakdown?.score ?? 0), 0);
          scoredPersonDays += scored.length;
          // Period headcounts are the **peak day** (§3.3): per-day rollups cannot be de-duplicated
          // into distinct people across a window.
          coverageScored = Math.max(coverageScored, scored.length);
          coverageTeam = Math.max(coverageTeam, people.length);
          coverageReported = Math.max(
            coverageReported,
            people.filter((p) => p.totals).length,
          );
          // "Hours Tracked" is the **logged timer time** (`tracked_sec`, from the TIME# sessions) —
          // what the label and the /time-tracking link mean. It is present even for a contributor
          // with no summary yet, and it is NOT `active_sec` (input activity): a timer left running
          // logs hours while active input stays near zero, so the old active-sec number read as "0h"
          // beside a full day of tracked work.
          trackedSecTotal += people.reduce((s, p) => s + (p.tracked_sec ?? 0), 0);
        }
        const productivityValue = scoredPersonDays
          ? Math.round(scoreSum / scoredPersonDays)
          : 0;
        // Snapshot of live-running seconds at fetch time, so the KPI is already correct before the
        // first `useNow` tick and the assistant reads a truthful figure. The view re-derives this
        // live from `hoursLive` on an interval. `Date.now()` here is in the data effect, not a render
        // path — no hydration concern.
        const runningSnapSec = rangeIncludesToday
          ? runningStarts.reduce((s, st) => s + Math.max(0, (Date.now() - st) / 1000), 0)
          : 0;
        const hoursTrackedSec = trackedSecTotal + runningSnapSec;
        // One decimal below 10h so a live-accruing morning (0.4h) isn't floored to "0h"; whole hours
        // above, where a tenth is noise.
        const hoursTracked =
          hoursTrackedSec >= 36000
            ? Math.round(hoursTrackedSec / 3600)
            : Math.round((hoursTrackedSec / 3600) * 10) / 10;

        // ── Productivity trend (the chart): a real multi-day line. A single "today" point is not a
        // trend, so when the selected range is one day, draw a rolling 7-day window fetched just for
        // the chart — the KPI numbers above stay scoped to the selected range. ──
        let trendBundles: { iso: string; activity: OrgActivity | null }[] = bundles;
        if (days.length < 2) {
          const trendDays = resolveDays({ range: "7d", team, start, end });
          trendBundles = await mapWithConcurrency(trendDays, DAY_FANOUT, async (iso) => ({
            iso,
            activity: await getOrgActivity(iso).catch(() => null),
          }));
          if (!live) return;
        }
        const trendShort = trendBundles.length <= 8;
        const SEC_PER_H = 3600;
        // The KPI stat card's sparkline still tracks the composite score; collected here (unreported
        // days dropped) so the *card* below can move to concrete hours without disturbing the KPI.
        const dayScores: number[] = [];
        // The honest line-trend widget: real score only where quality was measured, each day, with
        // gaps where it wasn't.
        const productivityScoreTrend: ScoreTrendPoint[] = [];
        const productivityTrend: TrendPoint[] = trendBundles.map((b) => {
          const people = (b.activity?.people ?? []).filter(
            (p) => inScopeDept(p.department_id) && trackableIds.has(p.user_id),
          );
          const scored = people.filter((p) => p.breakdown);
          if (scored.length) {
            dayScores.push(
              Math.round(
                scored.reduce((s, p) => s + (p.breakdown?.score ?? 0), 0) / scored.length,
              ),
            );
          }

          const t = people.reduce(
            (acc, p) => {
              acc.active += p.totals?.active_sec ?? 0;
              acc.prod += p.totals?.productive_sec ?? 0;
              acc.neut += p.totals?.neutral_sec ?? 0;
              acc.dist += p.totals?.distracting_sec ?? 0;
              return acc;
            },
            { active: 0, prod: 0, neut: 0, dist: 0 },
          );

          // The agent's classified spans (`top_apps`) can exceed active time — overlapping windows or
          // multiple monitors — so the three classified categories are scaled to fit inside active
          // time. This keeps every bar's height equal to hours *tracked* (never overstating), and the
          // remainder is the honest "unclassified" band. When classification fits, `scale` is 1.
          const classified = t.prod + t.neut + t.dist;
          const scale = classified > t.active && classified > 0 ? t.active / classified : 1;
          const prodSec = t.prod * scale;
          const neutSec = t.neut * scale;
          const distSec = t.dist * scale;
          const unclSec = Math.max(0, t.active - (prodSec + neutSec + distSec));

          const h = (sec: number) => Math.round((sec / SEC_PER_H) * 10) / 10; // one decimal

          // Honest score for the trend line, same day. Score averages people whose quality was
          // measured, so a partial ~50 score (quality dropped) is never plotted. `q_measured` is
          // optional: `false` = explicitly dropped; **absent OR `true` = measured** (rollup/older
          // payloads omit the flag — see ScoreBreakdown). So exclude only explicit `false`; treating
          // absent as unmeasured wrongly showed "not measured" on a day that was in fact scored.
          const qScored = people.filter((p) => p.breakdown && p.breakdown.q_measured !== false);
          const label = dayLabel(b.iso, trendShort);
          productivityScoreTrend.push({
            label,
            score: qScored.length
              ? Math.round(
                  qScored.reduce((s, p) => s + (p.breakdown?.score ?? 0), 0) / qScored.length,
                )
              : null,
            measured: qScored.length,
          });

          return {
            label,
            iso: b.iso,
            productiveH: h(prodSec),
            neutralH: h(neutSec),
            distractingH: h(distSec),
            unclassifiedH: h(unclSec),
            reported: people.length,
          };
        });
        // A month per-day is ~22 slivers with colliding labels; weeks are the unit the monthly AI
        // report already narrates in, so the chart matches it instead of inventing a third
        // granularity. Day-level ranges are untouched.
        const trendPoints =
          range === "30d" ? foldToWeeks(productivityTrend) : productivityTrend;

        const productivityTrendSeries = dayScores;

        // ── Attendance rate over the window (dept-aware) + the latest closed-day counts for the donut. ──
        let presentSum = 0;
        let countedSum = 0;
        let latestCounts = { present: 0, partial: 0, leave: 0, absent: 0 };
        // **Closed days only.** Attendance statuses are stamped by the 00:15 close cron, so today
        // has no attendance record yet — every user comes back unresolved and counts as "not
        // present". Including today therefore reported `0 present` next to a live productivity
        // score built from the very same people's agent activity: two clocks, shown as one fact.
        // `use-oversight-attendance` and `use-month-attendance` already fetch closed days only;
        // this is the dashboard catching up to them.
        const today = todayIso();
        const closedBundles = bundles.filter((b) => b.iso < today);
        for (const b of closedBundles) {
          const users = (b.oversight?.users ?? []).filter(
            (u) => inScopeUser(u.user_id) && isTracked(u.user_id),
          );
          const counted = users.filter((u) => u.status !== "non_workday");
          const present = users.filter(
            (u) => u.status === "present" || u.status === "partial",
          ).length;
          presentSum += present;
          countedSum += counted.length;
          if (counted.length > 0) {
            latestCounts = {
              present: users.filter((u) => u.status === "present").length,
              partial: users.filter((u) => u.status === "partial").length,
              leave: users.filter((u) => u.status === "leave").length,
              absent: users.filter((u) => u.status === "absent").length,
            };
          }
        }
        // Live fallback: when no closed day in the window carries resolved statuses (the Today range
        // always, plus any window whose close cron hasn't produced statuses), fall back to who has
        // clocked in **today** from the live per-user reads — so the donut shows real presence instead
        // of a blank "resolved tomorrow". `present` = clocked in; `absent` = active but not; partial /
        // leave only exist after the close, so they stay 0 here.
        const attendanceTotal =
          latestCounts.present + latestCounts.partial + latestCounts.leave + latestCounts.absent;
        if (attendanceTotal === 0 && timerHolders.length > 0) {
          latestCounts = {
            present: presentToday,
            partial: 0,
            leave: 0,
            absent: timerHolders.length - presentToday,
          };
        }

        // ── Activity heatmap (capture density, not a score): weekday (Mon..Sun) × 2-hour workday buckets (8a..8p), 0..100 intensity,
        // derived from screenshot capture density (no dedicated hourly endpoint). Empty only when there
        // is genuinely no capture activity in the window. ──
        const HEAT_COLS = 6; // matches HEATMAP_HOURS: 8a, 10a, 12p, 2p, 4p, 6p
        const HEAT_START_HOUR = 8;
        const heatCounts = Array.from({ length: 7 }, () => new Array(HEAT_COLS).fill(0));
        for (const b of bundles) {
          const weekday = (new Date(`${b.iso}T00:00:00`).getDay() + 6) % 7; // Mon = 0
          for (let h = 0; h < 24; h++) {
            const col = Math.floor((h - HEAT_START_HOUR) / 2);
            if (col >= 0 && col < HEAT_COLS) heatCounts[weekday][col] += b.hourly[h];
          }
        }
        const heatMax = Math.max(1, ...heatCounts.flat());
        const heatmap = heatCounts.flat().some((v) => v > 0)
          ? heatCounts.map((row) => row.map((v) => Math.round((v / heatMax) * 100)))
          : [];

        const attendanceRate = countedSum
          ? Math.round((presentSum / countedSum) * 100)
          : 0;
        // Days that actually produced statuses. 0 => not measurable yet (see DashboardData) — the
        // consumer renders an absence rather than this 0.
        const attendanceResolvedDays = closedBundles.filter(
          (b) =>
            (b.oversight?.users ?? []).filter(
              (u) =>
                inScopeUser(u.user_id) &&
                // Same population as the rate this gates — a day where only untracked admins have a
                // status was not measured for anyone the figure is about.
                isTracked(u.user_id) &&
                u.status !== "non_workday",
            ).length > 0,
        ).length;

        // ── Latest day with scored people → team comparison + top performers. ──
        //
        // **Scope first, then pick the day.** This used to find the newest day with *anybody* in it
        // and only then filter by department — so if the most recent reporting day happened to hold
        // no one from the selected team, Top performers came back empty even though that team had
        // plenty of data earlier in the same window. Switching teams appeared to blank the widget at
        // random. The day now has to be the newest one that carries someone *in scope*.
        const latestScopedPeople =
          [...bundles]
            .reverse()
            .map((b) =>
              (b.activity?.people ?? []).filter(
                (p) => inScopeDept(p.department_id) && p.breakdown,
              ),
            )
            .find((people) => people.length > 0) ?? [];

        // Department comparison is deliberately the **cross-department** view and stays org-wide
        // even when one is selected — otherwise the comparison renders a single bar. It reads off the
        // newest day with any scored person, independent of the filter. The widget says so in its
        // description, because a chart ignoring the active filter is otherwise indistinguishable
        // from a bug.
        const latestAnyPeople =
          [...bundles]
            .reverse()
            .map((b) => (b.activity?.people ?? []).filter((p) => p.breakdown))
            .find((people) => people.length > 0) ?? [];

        const byDept = new Map<string, number[]>();
        for (const p of latestAnyPeople) {
          if (!p.breakdown) continue;
          const label = deptLabel(p.department_id);
          const arr = byDept.get(label) ?? [];
          arr.push(p.breakdown.score);
          byDept.set(label, arr);
        }
        const teamData = [...byDept.entries()]
          .map(([dept, scores]) => ({
            team: dept.split(" ")[0],
            score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 7);

        const topPerformers: Performer[] = [...latestScopedPeople]
          .sort((a, b) => (b.breakdown?.score ?? 0) - (a.breakdown?.score ?? 0))
          .slice(0, 5)
          .map((p) => ({
            id: p.user_id,
            name: p.name,
            department: deptLabel(p.department_id),
            productivityScore: Math.round(p.breakdown?.score ?? 0),
          }));

        // ── Screenshots over the window (agent-dependent — 0 is honest). ──
        const screenshotsTrend = bundles.map((b) => b.shots);
        const screenshotCount = screenshotsTrend.reduce((a, b) => a + b, 0);
        const screenshotCountPartial = bundles.some((b) => b.shotsTruncated);
        // Meaningful cuts of the same frames: how many need a look, how work-time split, and how many
        // employees were actually reached — the three things a raw total can't tell an admin.
        const screenshotsFlagged = bundles.reduce((a, b) => a + b.flagged, 0);
        const screenshotsSplit = {
          productive: bundles.reduce((a, b) => a + b.productive, 0),
          neutral: bundles.reduce((a, b) => a + b.neutral, 0),
          distracting: bundles.reduce((a, b) => a + b.distracting, 0),
        };
        const screenshotsCoverage = new Set(bundles.flatMap((b) => b.userIds)).size;

        // ── Billing seats. ──
        const seatsTotal =
          billing && billing.seat_cap > 0 ? billing.seat_cap : roster.length || 1;
        const billingBlock = {
          plan: billing?.plan ?? "—",
          seatsUsed: roster.filter((e) => e.status === "active").length,
          seatsTotal,
        };

        // ── Headcount by status. See `HeadcountCounts` for why `invited` can't come from the
        // directory, and why there is no `suspended`. ──
        const statusCounts = {
          active: activeCount,
          inactive: inactiveCount,
          invited: invitedCount,
        };

        // No cheap prior-window comparison → deltas stay 0 (honest, not seeded). Trends are the real
        // per-day series where one exists (productivity), empty otherwise so the sparkline is omitted.
        const flat = (
          value: number,
        ): { value: number; deltaPct: number; trend: number[] } => ({
          value,
          deltaPct: 0,
          trend: [],
        });

        // New hires = roster members whose join date (epoch ms) falls within the selected period,
        // scoped to the department filter. The directory now carries `joined_at` (enriched from the
        // base user item), so this is real instead of the old hardcoded 0. `newHiresTracked` stays
        // false only for a legacy org where no one has a join date — there the tile still shows the
        // honest "—", never a confident "0".
        const daySet = new Set(days);
        const localDay = (ms: number) =>
          `${new Date(ms).getFullYear()}-${String(new Date(ms).getMonth() + 1).padStart(2, "0")}-${String(new Date(ms).getDate()).padStart(2, "0")}`;
        const newHiresTracked = roster.some((e) => typeof e.joined_at === "number");
        const newHiresCount = roster.filter(
          (e) =>
            inScopeUser(e.user_id) &&
            typeof e.joined_at === "number" &&
            daySet.has(localDay(e.joined_at)),
        ).length;

        const built: DashboardData = {
          range,
          team,
          // Display label for the selected department, so the AI summary can name it ("the
          // Engineering team"). Undefined for "all" → the summary says "the organization".
          teamLabel: team === "all" ? undefined : deptLabel(team),
          rangeLabel: rangeLabelFor({ range, team, start, end }, days),
          days,
          // The chart's own window. When a one-day selection widened to a rolling week above, say
          // so — the card used to carry the KPI range and quietly misdescribe itself.
          trendLabel:
            range === "30d"
              ? "this month, by week"
              : trendBundles.length > days.length && trendBundles.length > 1
                ? `last ${trendBundles.length} days`
                : rangeLabelFor({ range, team, start, end }, days),
          kpis: {
            productivity: {
              value: productivityValue,
              deltaPct: 0,
              trend: productivityTrendSeries,
            },
            // Working-now, not headcount — see the derivation above. `activeCount`/`inactiveCount`
            // remain directory headcount further down, because the status ring widget means that.
            active: flat(workingNow),
            inactive: flat(notWorkingNow),
            timers: flat(workingNow),
            hours: flat(hoursTracked),
            attendance: flat(attendanceRate),
            newHires: flat(newHiresCount),
          },
          productivityTrend: trendPoints,
          productivityScoreTrend,
          teamData,
          screenshotCount,
          screenshotCountPartial,
          screenshotsTrend,
          screenshotsCoverage,
          screenshotsFlagged,
          screenshotsSplit,
          topPerformers,
          liveTimers,
          billing: billingBlock,
          heatmap, // weekday × 2-hour intensity from screenshot capture density (empty if none).
          attendanceCounts: latestCounts,
          attendanceResolvedDays,
          newHiresTracked,
          hoursLive: {
            closedSec: trackedSecTotal,
            runningStarts,
            includesToday: rangeIncludesToday,
          },
          productivityCoverage: {
            scored: coverageScored,
            team: coverageTeam,
            reported: coverageReported,
          },
          statusCounts,
          activeCount,
          inactiveCount,
        };

        setData(built);
      } catch (e) {
        if (live) setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [range, team, start, end, nonce, isBackground]);

  return { data, teams, loading, error, reload };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to the dashboard.";
    return e.message;
  }
  return "Couldn't load the dashboard. Check your connection and retry.";
}

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
 * agent reports** — a gap, never a fabricated number. There is no per-hour productivity endpoint, so
 * the heatmap is always empty (its widget shows an honest "needs the agent" state), and no cheap
 * prior-window comparison exists, so KPI `deltaPct` stays 0 rather than seeded.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  listAllEmployees,
  listInvites,
  departmentMap,
} from "@/modules/employees/services/employees.service";
import { contributorRoleIds } from "@/modules/roles/services/roles.service";
import { getUserDay } from "@/modules/attendance/services/attendance.service";
import { todayIso } from "@/lib/format";
import { getBillingOverview } from "@/modules/billing/services/billing.service";
import {
  getOrgActivity,
  getScreenshots,
  type OrgActivity,
} from "@/modules/insights/services/insights.service";
import {
  getDayOversight,
  type ApiDayResponse,
} from "@/modules/attendance/services/attendance.service";
import type {
  DashboardData,
  DashboardFilters,
  Performer,
  TeamOption,
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
  const [nonce, setNonce] = useState(0);

  const { range, team, start, end } = filters;

  useEffect(() => {
    let live = true;
    setLoading(true);
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
        const deptLabel = (id: string) => deptNames.get(id) ?? id;
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
            (d) => ({ running: d.running === true, present: Boolean(d.clock_in) }),
            () => ({ running: false, present: false }),
          ),
        );
        const workingNow = todayStatus.filter((s) => s.running).length;
        const notWorkingNow = timerHolders.length - workingNow;
        const presentToday = todayStatus.filter((s) => s.present).length;

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
            const shots = scopedShots.length;
            const shotsTruncated = grid
              ? Boolean(grid.cursor) || grid.shots.length >= SHOT_PAGE
              : false;
            // Bucket the day's frames by local hour — the raw material for the productivity heatmap
            // (activity intensity by hour), derived from the capture cadence rather than a new endpoint.
            const hourly = new Array(24).fill(0);
            for (const s of scopedShots) {
              const h = new Date(s.captured_at).getHours();
              if (h >= 0 && h < 24) hourly[h] += 1;
            }
            return { iso, activity, oversight, shots, shotsTruncated, hourly };
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
        let activeSecTotal = 0;
        let coverageScored = 0;
        let coverageTeam = 0;
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
          activeSecTotal += people.reduce((s, p) => s + (p.totals?.active_sec ?? 0), 0);
        }
        const productivityValue = scoredPersonDays
          ? Math.round(scoreSum / scoredPersonDays)
          : 0;
        const hoursTracked = Math.round(activeSecTotal / 3600);

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
        const productivityTrend = trendBundles.map((b) => {
          const people = (b.activity?.people ?? []).filter(
            (p) => inScopeDept(p.department_id) && trackableIds.has(p.user_id),
          );
          const scored = people.filter((p) => p.breakdown);
          // A day nobody reported stays `null` (an unknown), rendered as 0 on the line but never
          // dragging an average — the chart just shows a low point for an unreported day.
          const dayScore = scored.length
            ? scored.reduce((s, p) => s + (p.breakdown?.score ?? 0), 0) / scored.length
            : null;
          const dt = people.reduce(
            (acc, p) => {
              acc.active += p.totals?.active_sec ?? 0;
              acc.productive += p.totals?.productive_sec ?? 0;
              return acc;
            },
            { active: 0, productive: 0 },
          );
          return {
            label: dayLabel(b.iso, trendShort),
            active: Math.round(dayScore ?? 0),
            productive: dt.active ? Math.round((dt.productive / dt.active) * 100) : 0,
          };
        });
        const productivityTrendSeries = productivityTrend.map((t) => t.active);

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
          const users = (b.oversight?.users ?? []).filter((u) => inScopeUser(u.user_id));
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

        // ── Productivity heatmap: weekday (Mon..Sun) × 2-hour workday buckets (8a..8p), 0..100 intensity,
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
              (u) => inScopeUser(u.user_id) && u.status !== "non_workday",
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

        // Team comparison is deliberately the **cross-team** view and stays org-wide even when a
        // team is selected — otherwise "compare teams" would render a single bar. It reads off the
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

        const built: DashboardData = {
          range,
          team,
          rangeLabel: rangeLabelFor({ range, team, start, end }, days),
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
            newHires: flat(0), // directory list carries no join date → honest 0 (see hint).
          },
          productivityTrend,
          teamData,
          screenshotCount,
          screenshotCountPartial,
          screenshotsTrend,
          topPerformers,
          billing: billingBlock,
          heatmap, // weekday × 2-hour intensity from screenshot capture density (empty if none).
          attendanceCounts: latestCounts,
          attendanceResolvedDays,
          productivityCoverage: { scored: coverageScored, team: coverageTeam },
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
  }, [range, team, start, end, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
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

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
  listEmployees,
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
import type { DashboardData, DashboardFilters, Performer } from "./lib/dashboard-data";

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
}

export interface DashboardDataState {
  data: DashboardData | null;
  teams: string[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useDashboardData(filters: DashboardFilters): DashboardDataState {
  const [data, setData] = useState<DashboardData | null>(null);
  const [teams, setTeams] = useState<string[]>([]);
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
        const [roster, deptNames, contributorIds] = await Promise.all([
          listEmployees(),
          departmentMap().catch(() => new Map<string, string>()),
          // A failed roles read must not empty the KPI — fall back to counting everyone.
          contributorRoleIds().catch(() => null),
        ]);
        const billing = await getBillingOverview().catch(() => null);
        if (!live) return;

        // department_id → label, and the reverse (the `team` filter carries a department *name*).
        const deptLabel = (id: string) => deptNames.get(id) ?? id;
        const teamList = Array.from(
          new Set(roster.map((e) => deptLabel(e.department_id))),
        ).sort();
        setTeams(teamList);

        const selectedDeptIds =
          team === "all"
            ? null
            : new Set(
                roster
                  .filter((e) => deptLabel(e.department_id) === team)
                  .map((e) => e.department_id),
              );
        const scopeUserIds =
          team === "all"
            ? null
            : new Set(
                roster
                  .filter((e) => selectedDeptIds!.has(e.department_id))
                  .map((e) => e.user_id),
              );
        const inScopeUser = (id: string) => scopeUserIds === null || scopeUserIds.has(id);
        const inScopeDept = (id: string) =>
          selectedDeptIds === null || selectedDeptIds.has(id);

        // Directory-derived KPIs (dept-filtered). Real the moment the roster loads.
        const scopedRoster = roster.filter((e) => inScopeUser(e.user_id));
        const activeCount = scopedRoster.filter((e) => e.status === "active").length;
        const inactiveCount = scopedRoster.filter((e) => e.status !== "active").length;

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
        const runningFlags = await mapWithConcurrency(timerHolders, 4, (e) =>
          getUserDay(e.user_id, todayForTimers).then(
            (d) => d.running === true,
            () => false,
          ),
        );
        const workingNow = runningFlags.filter(Boolean).length;
        const notWorkingNow = timerHolders.length - workingNow;

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
            const shots = grid
              ? grid.shots.filter((s) => inScopeUser(s.user_id)).length
              : 0;
            return { iso, activity, oversight, shots };
          },
        );
        if (!live) return;

        const shortWindow = days.length <= 8;

        // ── Productivity + hours + trend, from each day's scored people (dept-aware). ──
        let scoreSum = 0;
        let scoredDayCount = 0;
        let activeSecTotal = 0;
        const productivityTrend = bundles.map((b) => {
          const people = (b.activity?.people ?? []).filter((p) =>
            inScopeDept(p.department_id),
          );
          const scored = people.filter((p) => p.breakdown);
          const dayScore = scored.length
            ? scored.reduce((s, p) => s + (p.breakdown?.score ?? 0), 0) / scored.length
            : null;
          const daytotals = people.reduce(
            (acc, p) => {
              acc.active += p.totals?.active_sec ?? 0;
              acc.productive += p.totals?.productive_sec ?? 0;
              return acc;
            },
            { active: 0, productive: 0 },
          );
          activeSecTotal += daytotals.active;
          if (dayScore !== null) {
            scoreSum += dayScore;
            scoredDayCount += 1;
          }
          return {
            label: dayLabel(b.iso, shortWindow),
            active: Math.round(dayScore ?? 0),
            productive: daytotals.active
              ? Math.round((daytotals.productive / daytotals.active) * 100)
              : 0,
          };
        });
        const productivityValue = scoredDayCount
          ? Math.round(scoreSum / scoredDayCount)
          : 0;
        const productivityTrendSeries = productivityTrend.map((t) => t.active);
        const hoursTracked = Math.round(activeSecTotal / 3600);

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
        const latestActivity =
          [...bundles].reverse().find((b) => (b.activity?.people?.length ?? 0) > 0)
            ?.activity ??
          bundles[bundles.length - 1]?.activity ??
          null;
        const latestPeople = latestActivity?.people ?? [];

        // Team comparison stays global across departments (it is the cross-team view).
        const byDept = new Map<string, number[]>();
        for (const p of latestPeople) {
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

        const topPerformers: Performer[] = latestPeople
          .filter((p) => p.breakdown && inScopeDept(p.department_id))
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

        // ── Billing seats. ──
        const seatsTotal =
          billing && billing.seat_cap > 0 ? billing.seat_cap : roster.length || 1;
        const billingBlock = {
          plan: billing?.plan ?? "—",
          seatsUsed: roster.filter((e) => e.status === "active").length,
          seatsTotal,
        };

        // ── Headcount by status (directory: active | deactivated). ──
        const statusCounts = {
          active: activeCount,
          inactive: inactiveCount,
          invited: 0,
          suspended: 0,
        } as const;

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
          screenshotsTrend,
          topPerformers,
          billing: billingBlock,
          heatmap: [], // no per-hour productivity endpoint — the widget shows an honest empty state.
          attendanceCounts: latestCounts,
          attendanceResolvedDays,
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

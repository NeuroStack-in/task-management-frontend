"use client";

import { useEffect, useState } from "react";
import {
  Gauge,
  Users,
  Clock,
  Camera,
  CalendarCheck,
  CalendarRange,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import { UpgradeStatCard } from "@/components/shared/upgrade-stat-card";
import { useIsFeatureAllowed, useIsFeatureOn } from "@/hooks/use-features";
import { useNow } from "@/hooks/use-now";
import { useDashboardStore } from "@/stores/dashboard.store";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { GreetingHeader } from "./greeting-header";
import { TourOfferCard } from "./tour-offer-card";
import { DashboardControls } from "./dashboard-controls";
import { CustomizableDashboard } from "./customizable-dashboard";
import { PersonalDashboard } from "./personal-dashboard";
import { MyTasksCardSelf } from "./my-tasks-card";
import { useRouter } from "next/navigation";
import { useIsPersonalDashboard } from "@/modules/dashboard/scope";
import { useIsSurfaceOn } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import { useIsOpsOnly } from "@/modules/ops/use-platform-admin";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { ATTENDANCE_LOG_ANCHOR } from "@/modules/attendance/components/attendance-log";
import { MAX_DAYS, useDashboardData } from "../use-dashboard-data";
import type { DashboardRange } from "../lib/dashboard-data";

export function DashboardView() {
  const router = useRouter();
  // A dedicated support operator has no customer dashboard — send them to the support desk instead
  // of an empty personal board.
  const { opsOnly } = useIsOpsOnly();
  useEffect(() => {
    if (opsOnly) router.replace("/ops/support");
  }, [opsOnly, router]);

  // Self-scoped roles (Employee) get a personal dashboard, never org aggregates.
  const personal = useIsPersonalDashboard();

  if (opsOnly) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Opening the support desk…" />
      </div>
    );
  }

  if (personal) {
    return (
      <div className="space-y-4 pt-1">
        <GreetingHeader />
        <TourOfferCard />
        <PersonalDashboard />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      <GreetingHeader />
      <TourOfferCard />
      <OrgDashboard />
    </div>
  );
}

/** The org (admin/owner/lead) view — the exact preview UI, on real backend data. */
function OrgDashboard() {
  // Projects is an org-gated surface (entitlement / tracking mode) — the same rule the personal
  // dashboard applies, so "My tasks" disappears along with the rest of Projects rather than
  // sitting there empty.
  const isSurfaceOn = useIsSurfaceOn();
  const showProjects = isSurfaceOn("projects");
  // …and on whether this person is a CONTRIBUTOR at all. "My tasks" answers "what am I personally
  // working on", which is not a question an oversight role is on this page to ask — an Owner got a
  // permanent "You're all caught up" card telling them nothing.
  //
  // Gated on the contributor-only bit rather than on a role id, because that is the distinction the
  // permission model already draws: `time-tracking:self` (wp-contracts bit 110, `TimeTrackSelf`) is
  // one of the bits `is_owner` deliberately does NOT grant — it means "I personally do this", not "I
  // may oversee it". `canAccess` refuses to let the wildcard grant it, so Owner and Admin drop the
  // card by default while an admin who *is* also a contributor (a custom role granting the bit)
  // keeps it. Hardcoding "not owner, not admin" would have got that last case wrong.
  const { can } = usePermissions();
  const isContributor = can("time-tracking:self");
  // "Today" by default: the dashboard answers "what is happening right now", and a 7-day default
  // buried today's numbers in a week's average. The LLD does not fix a page-level default (§3 is
  // layout persistence; `date-range` there is per-widget config), so this is a product choice.
  const isFeatureAllowed = useIsFeatureAllowed();
  // The server's own gate on the monitoring routes (plan + the org's toggle, owner exempt from the
  // toggle) — what decides whether a read would be refused, as opposed to which tile to show.
  const isFeatureOn = useIsFeatureOn();
  // Ticks every ~30s so "Hours Tracked" accrues live while timers run (see useNow / data.hoursLive).
  const now = useNow();
  const [range, setRange] = useState<DashboardRange>("today");
  const [team, setTeam] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  // **Only read what this board can show.** Screenshot pages feed the "today" tile and the heatmap
  // widget, billing feeds its widget — so a hidden widget, a plan without the feature or a viewer
  // without the permission costs no request (QA audit 2026-10-08, WP-193).
  const widgets = useDashboardStore((s) => s.widgets);
  const isShown = (type: string) => widgets.some((w) => w.type === type && w.visible);
  const awaitingDates = range === "range" && (!start || !end);
  const { data, teams, loading, error, reload } = useDashboardData(
    { range, team, start, end },
    {
      // The org rollup needs `ActivityReadOrg`, the screenshot grid `ScreenshotsRead` — without
      // them each read is a certain 403, which already rendered as "nothing", every 30 s.
      activity: isFeatureOn("monitoring.activity") && can("activity:view"),
      screenshots:
        isFeatureOn("monitoring.screenshots") &&
        can("screenshots:view") &&
        (range === "today" || isShown("org_activity.heatmap")),
      billing: can("billing:view") && isShown("billing_summary"),
    },
  );

  // Stamp the time of the last load that **landed** — keyed on the data alone. It also moved on a
  // filter change, so a switch that failed still read "Updated 3:45 PM" (QA audit 2026-10-08, WP-198).
  // Set on the client so the SSR HTML never diverges from the client render.
  useEffect(() => {
    if (!data) return;
    setLastUpdated(
      new Date().toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  }, [data]);

  // Live "Hours Tracked": settled tracked time + elapsed of each currently-running session, ticking
  // via `useNow`. Rendered `HH:MM:SS` like every other duration in the product — which also retires
  // the tenth-of-an-hour rounding this used to need so that a live morning read "0.4h" and not a
  // floored "0h". A clock has no such floor: it reads `00:24:31` from the first minute. Computed
  // here, above the early returns, because the assistant is told this same figure.
  const liveHoursSec = data
    ? data.hoursLive.closedSec +
      (data.hoursLive.includesToday
        ? data.hoursLive.runningStarts.reduce((s, st) => s + Math.max(0, (now - st) / 1000), 0)
        : 0)
    : 0;
  const liveHoursText = formatDuration(liveHoursSec);

  // Publish the board's on-screen figures to the assistant so "explain this dashboard" and questions
  // about the numbers here resolve against the same values the user sees. Called unconditionally
  // (empty until data lands) to keep the hook above the early returns; the server still authorizes
  // every follow-up read. Date-scoped only when the window is a single day.
  const top = data?.topPerformers[0];
  useAssistantPageContext({
    date: data && data.days.length === 1 ? data.days[0] : null,
    facts: data
      ? [
          { label: "View", value: data.rangeLabel },
          ...(team !== "all" && data.teamLabel
            ? [{ label: "Department filter", value: data.teamLabel }]
            : []),
          {
            label: "Productivity score",
            // Same three states as the tile above — this line is the exported/copied summary, and
            // it stating "no agent reported" while the tile says "2 reporting" would be worse than
            // either being wrong alone.
            value:
              data.productivityCoverage.scored === 0
                ? data.productivityCoverage.reported > 0
                  ? `no score (${data.productivityCoverage.reported} reporting, too little activity)`
                  : "no agent reported"
                : `${data.kpis.productivity.value}% (${data.productivityCoverage.scored} of ${data.productivityCoverage.team} reporting)`,
          },
          ...(range === "today"
            ? [
                {
                  label: "Working now",
                  value: `${data.kpis.active.value} of ${data.kpis.active.value + data.kpis.inactive.value}`,
                },
                // The tile's own live figure. This published `kpis.hours`, rounded to whole hours
                // above ten, so the assistant was told "12:00:00" beside a tile reading 12:29:40.
                ...(data.hoursAvailable
                  ? [{ label: "Hours tracked today", value: liveHoursText }]
                  : []),
                ...(isFeatureAllowed("monitoring.screenshots")
                  ? [
                      {
                        label: "Screenshots today",
                        value: data.screenshotCountPartial
                          ? `at least ${data.screenshotCount.toLocaleString()}`
                          : data.screenshotCount.toLocaleString(),
                      },
                    ]
                  : []),
              ]
            : [
                ...(data.hoursAvailable ? [{ label: "Hours tracked", value: liveHoursText }] : []),
                {
                  label: "Attendance rate",
                  value:
                    data.attendanceResolvedDays === 0
                      ? "awaiting nightly close"
                      : `${data.kpis.attendance.value}%`,
                },
              ]),
          ...(data.screenshotsFlagged > 0
            ? [
                {
                  label: "Screenshots needing review",
                  // Counted over the one page read per day — a floor when the day held more.
                  value: data.screenshotsSampled
                    ? `at least ${data.screenshotsFlagged}`
                    : String(data.screenshotsFlagged),
                },
              ]
            : []),
          ...(top
            ? [{ label: "Top performer", value: `${top.name} (${top.productivityScore}%)` }]
            : []),
        ]
      : [],
  });

  if (loading && !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading dashboard…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-5">
        {/* No PageHeader here: `GreetingHeader` above already gives the page its one <h1> and its
            navbar title, and a second would make two (SHELL-07). */}
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const controls = (
    <DashboardControls
      range={range}
      onRangeChange={setRange}
      team={team}
      onTeamChange={setTeam}
      teams={teams}
      lastUpdated={lastUpdated}
      loading={loading}
      onRefresh={reload}
      start={start}
      end={end}
      onStartChange={setStart}
      onEndChange={setEnd}
    />
  );

  // "Custom" with a date still missing is not a range yet. Nothing is read for it, and the board is
  // not shown: it used to load zero days and present all-zero KPIs for "selected range", beside an
  // AI summary of some other day (QA audit 2026-10-08, WP-432).
  if (awaitingDates || !data) {
    return (
      <div className="space-y-4">
        {controls}
        {awaitingDates ? (
          <div className="flex flex-col items-center gap-2 rounded-[1.4rem] border border-dashed px-6 py-14 text-center">
            <span className="bg-muted flex size-10 items-center justify-center rounded-md">
              <CalendarRange className="text-muted-foreground size-5" />
            </span>
            <p className="text-sm font-medium">Choose a start and an end date</p>
            <p className="text-muted-foreground max-w-sm text-xs">
              The dashboard shows the range once both dates are set — up to {MAX_DAYS} days.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  const { kpis, rangeLabel } = data;

  return (
    <div className="space-y-4">
      {controls}

      {/* A load that failed after the board had data. The board stays — it is still true of the
          window it was read for — but it no longer pretends to be the one now selected. */}
      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-dashed px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" />
            <span>
              {error}{" "}
              <span className="text-muted-foreground">
                Still showing the figures for {data.rangeLabel}
                {data.teamLabel ? ` · ${data.teamLabel}` : ""}.
              </span>
            </span>
          </span>
          <Button variant="outline" size="sm" onClick={reload} className="shrink-0">
            Retry
          </Button>
        </div>
      ) : null}

      {/* While a range switch refetches, dim the stale numbers (with the "Updating…" flag in the
          controls) so the change isn't silent — the old data lingering with no signal read as "did my
          click do anything?". */}
      <div
        aria-busy={loading}
        className={cn(
          "space-y-6 transition-opacity",
          loading && "pointer-events-none opacity-50",
        )}
      >
      {/* KPI strip — reactive to the active range/team. The "Today" range shows point-in-time counts;
          longer ranges show period aggregates. Deltas are omitted (no cheap real prior-window compare —
          a seeded % would be fabricated); sparklines render only where a real per-day series exists. */}
      {/* **Plan, not failure.** A Free org has no `monitoring.*` entitlement, so nothing is ever
          captured — and the monitoring tiles rendered "— no agent reported", "0h" and "0 captured",
          which tells an owner their agents are broken. They were never sold the feature. Where the
          plan excludes it, the same slot carries an upgrade card instead of a zero.

          `useIsFeatureAllowed` (the PLAN ceiling), not `useIsFeatureOn` (ceiling + org toggle): a
          feature the org owns and switched off is a Settings problem, and telling them to buy what
          they already have would be wrong. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="dash:kpis">
        {/* The score covers the whole trackable team, so state how much of it actually reported —
            otherwise a low number reads as "the org collapsed" when it means "one agent is on". */}
        {/* PRODUCTIVITY.md §3.2: the score is the mean over **those who reported**, and its
            coverage is always adjacent — a score without coverage is a misleading number.
            When nobody reported, there is no score: render the absence, never a confident 0%. */}
        {!isFeatureAllowed("monitoring.activity") ? (
          <UpgradeStatCard
            label="Productivity Score"
            description="Activity monitoring scores each day 0–100."
            featured
          />
        ) : (
        <StatCard
          label="Productivity Score"
          value={
            data.productivityCoverage.scored === 0
              ? "—"
              : `${kpis.productivity.value}%`
          }
          icon={Gauge}
          hint={
            // Three states, not two. A score of "—" used to always read "no agent reported",
            // which is false whenever an agent IS running but the day fell under the 30-minute
            // volume floor (MIN_ACTIVE_SEC_TO_SCORE) — the score is withheld as unreliable, not
            // missing. Saying "no agent reported" there sends people to check installs and
            // enrolment for a fleet that is working, which is the most expensive kind of wrong
            // copy: it describes a different problem confidently.
            data.productivityCoverage.scored === 0
              ? data.productivityCoverage.reported > 0
                ? `${data.productivityCoverage.reported} reporting, too little activity to score · ${rangeLabel}`
                : `no agent reported · ${rangeLabel}`
              : `${data.productivityCoverage.scored} of ${data.productivityCoverage.team} reporting · ${rangeLabel}`
          }
          trend={kpis.productivity.trend}
          href="/insights/reports"
          featured
        />
        )}
        {/* **Stable slots** (UX audit 2026-10-16, SHELL-14): Productivity, then Hours Tracked, in
            the same two places for every range — Hours used to jump from the third slot to the
            second when the range changed, so the eye lost it. Only the last two slots change, from
            today's live counts (Working now, Screenshots) to the period's (Attendance, New hires). */}
        {range === "today" ? (
          <>
            {/* Two genuinely distinct dimensions the trio never showed: total effort (active hours)
                and monitoring volume (screenshots) — both real, today-scoped, and drilling to their
                canonical pages. */}
            {/* Not plan-gated: logged hours are `time.tracking`, which every plan has. It was an
                "Upgrade to see" card on Free while Time Tracking showed the same hours one click
                away (QA audit 2026-10-08, WP-199). Today is always readable — see `hoursAvailable`. */}
            <StatCard
              label="Hours Tracked"
              value={liveHoursText}
              icon={Clock}
              hint="logged today"
              href="/time-tracking"
            />
            {/* One "Working now" card folds in the old Working-now / Not-working / Running-timers
                trio — they were the same running-timer fact (working = running-timers) plus its
                complement. Value is working / team; the hint carries the idle count. Links straight
                to the attendance-log roster where you see *who*. */}
            <StatCard
              label="Working now"
              value={`${kpis.active.value} / ${kpis.active.value + kpis.inactive.value}`}
              icon={Users}
              hint={`${kpis.inactive.value} not tracking · today`}
              href={`/attendance#${ATTENDANCE_LOG_ANCHOR}`}
            />
            {!isFeatureAllowed("monitoring.screenshots") ? (
              <UpgradeStatCard
                label="Screenshots"
                description="Periodic screen captures, with AI review."
              />
            ) : (
              <StatCard
                label="Screenshots"
                // With a department filter the count is a floor — one page per day is read, and
                // the department's frames may sit past it. Said even at 0, the case that used to
                // read as a confident "none" (QA audit 2026-10-08, WP-197).
                value={`${data.screenshotCount.toLocaleString()}${
                  data.screenshotCountPartial ? "+" : ""
                }`}
                icon={Camera}
                hint={data.screenshotCountPartial ? "at least · captured today" : "captured today"}
                href="/insights/screenshots"
              />
            )}
          </>
        ) : (
          <>
            {/* Logged hours are on every plan, so never an upgrade card. A window longer than today
                on a plan without the activity rollup has no source on this board: say where the
                hours are rather than print a zero (QA audit 2026-10-08, WP-199). */}
            {data.hoursAvailable ? (
              <StatCard
                label="Hours Tracked"
                value={liveHoursText}
                icon={Clock}
                hint={rangeLabel}
                href="/time-tracking"
              />
            ) : (
              <StatCard
                label="Hours Tracked"
                value="—"
                icon={Clock}
                hint={`${rangeLabel} · open Time Tracking`}
                href="/time-tracking"
              />
            )}
            {/* An unresolved rate is an absence, not a zero: statuses are stamped by the nightly
                close, so a window covering only today has nothing to measure. Showing 0% there put
                "nobody attended" beside a live productivity score for the same people. */}
            <StatCard
              label="Attendance Rate"
              value={
                data.attendanceResolvedDays === 0 ? "—" : `${kpis.attendance.value}%`
              }
              icon={CalendarCheck}
              hint={
                data.attendanceResolvedDays === 0 ? "awaiting nightly close" : rangeLabel
              }
              href="/attendance"
            />
            {/* Join dates now ride the directory list, so this is a real count of people who joined
                within the selected window. Only a legacy org with no join dates on record falls back
                to the honest "—" — never a confident "0" that reads as "nobody was hired". */}
            <StatCard
              label="New Hires"
              value={data.newHiresTracked ? kpis.newHires.value.toLocaleString() : "—"}
              icon={UserPlus}
              hint={data.newHiresTracked ? rangeLabel : "join date not tracked yet"}
              href="/employees"
            />
          </>
        )}
      </div>

      <CustomizableDashboard data={data} />

      {/* An org-scoped role never renders `PersonalDashboard`, and the widget catalog has no
          my-tasks entry — so a task assigned to an org-scoped CONTRIBUTOR would appear nowhere.
          That is what this covers, and only that: `isContributor` keeps it off the dashboard of a
          pure oversight role (Owner/Admin), where it could only ever render an empty state. */}
      {showProjects && isContributor && <MyTasksCardSelf />}
      </div>
    </div>
  );
}

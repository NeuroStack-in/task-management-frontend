"use client";

import { useMemo } from "react";
import { Clock, BadgeDollarSign, Activity } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { UpgradeStatCard } from "@/components/shared/upgrade-stat-card";
import { useIsFeatureAllowed } from "@/hooks/use-features";
import { useNow } from "@/hooks/use-now";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { formatHours } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TimesheetGrid, runningHours } from "./timesheet-grid";
import type { Period } from "../use-team-timesheet";
import type { ProjectTimesheet, TeamMemberTime } from "../types";

export function TeamTimeView({
  rows,
  projectRows,
  dates,
  weekLabel,
  weekOffset,
  onWeekOffsetChange,
  period,
  onPeriodChange,
  updating = false,
}: {
  rows: TeamMemberTime[];
  projectRows: ProjectTimesheet[];
  dates: string[];
  weekLabel: string;
  weekOffset: number;
  onWeekOffsetChange: (offset: number) => void;
  period: Period;
  onPeriodChange: (p: Period) => void;
  /** Another period is loading; these figures are the previous one's until it lands. */
  updating?: boolean;
}) {
  const isFeatureAllowed = useIsFeatureAllowed();
  // Same cadence as the grid's own live top-up, so the cards and the footer tick together.
  const now = useNow();

  // **The cards total the grid's own rows** — the people in view, plus the live elapsed of any
  // session still running, exactly as the grid's footer does. They used to total settled seconds
  // for everyone fetched, so at 11:00 on a Monday they read 00:00:00 above a footer of 20:00:00
  // (QA audit 2026-10-08, WP-196).
  const totals = useMemo(() => {
    const perDay = new Array(dates.length).fill(0) as number[];
    let billable = 0;
    for (const r of rows) {
      r.days.forEach((h, i) => (perDay[i] += h + runningHours(r.dayEntries[i], now)));
      billable +=
        r.billableHrs + r.dayEntries.reduce((s, d) => s + runningHours(d, now, true), 0);
    }
    return { perDay, hours: perDay.reduce((s, h) => s + h, 0), billable };
  }, [rows, dates.length, now]);
  const teamHours = totals.hours;
  const billablePct = Math.round((totals.billable / (teamHours || 1)) * 100);
  // Averaged over the people the agent actually scored. A 0 for everyone unscored read two people
  // at 80 among ten as "16%".
  const scored = rows.filter((r): r is TeamMemberTime & { activity: number } => r.activity !== null);
  const avgActivity = scored.length
    ? Math.round(scored.reduce((s, r) => s + r.activity, 0) / scored.length)
    : null;
  const activityInPlan = isFeatureAllowed("monitoring.activity");

  // Publish the team timesheet's week totals to the assistant.
  useAssistantPageContext({
    facts: [
      { label: "Week", value: weekLabel },
      { label: "Team hours", value: formatHours(teamHours) },
      { label: "Billable", value: `${billablePct}%` },
      ...(activityInPlan
        ? [
            {
              label: "Avg activity",
              value:
                avgActivity === null
                  ? "not scored"
                  : `${avgActivity}% (${scored.length} of ${rows.length} scored)`,
            },
          ]
        : []),
      { label: "Team members", value: String(rows.length) },
    ],
  });

  return (
    <div
      aria-busy={updating}
      className={cn("space-y-5 transition-opacity", updating && "opacity-60")}
    >
      {/* Manager-side counterpart of PersonalTimeView's `time:sessions` — same tour step, whichever
          branch of /time-tracking this role renders. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-tour="time:sessions">
        {/* `trend` is the real Mon–Sun hours from `teamWeekly`; the mock `delta` seeds on the
            Billable/Activity cards were fabricated and are dropped — the values are real. */}
        <StatCard
          label="Team hours"
          value={formatHours(teamHours)}
          icon={Clock}
          // The card totals whichever week the grid is showing, so it must not claim "this week"
          // once you page back — that read as a live figure for a historical range.
          // Names the span it is actually totalling. It said "this week" regardless, so a month
          // view would have labelled a month's hours as a week's.
          hint={
            weekOffset === 0 ? (period === "month" ? "this month" : "this week") : weekLabel
          }
          trend={totals.perDay}
          featured
        />
        <StatCard label="Billable" value={`${billablePct}%`} icon={BadgeDollarSign} />
        {/* Plan, not failure: without `monitoring.activity` there is no score to average, and every
            per-person read would only be refused. */}
        {!activityInPlan ? (
          <UpgradeStatCard
            label="Avg activity"
            description="Activity monitoring scores each day 0–100."
          />
        ) : (
          <StatCard
            label="Avg activity"
            value={avgActivity === null ? "—" : `${avgActivity}%`}
            icon={Activity}
            hint={
              avgActivity === null
                ? "no scored days in view"
                : `${scored.length} of ${rows.length} scored`
            }
          />
        )}
      </div>

      <TimesheetGrid
        personRows={rows}
        projectRows={projectRows}
        dates={dates}
        weekLabel={weekLabel}
        weekOffset={weekOffset}
        onWeekOffsetChange={onWeekOffsetChange}
        period={period}
        onPeriodChange={onPeriodChange}
        updating={updating}
      />
    </div>
  );
}

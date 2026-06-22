import type { Metadata } from "next";
import { Gauge, Users, UserMinus, Timer } from "lucide-react";
import { users } from "@/lib/data";
import { StatCard } from "@/components/shared/stat-card";
import { GreetingHeader } from "@/modules/dashboard/components/greeting-header";
import { TeamComparisonChart } from "@/modules/dashboard/components/team-comparison-chart";
import {
  TopEmployeesWidget,
  ScreenshotsWidget,
  AiSummaryWidget,
  AlertsWidget,
  DeadlineWidget,
  UpcomingTasksWidget,
  BillingWidget,
} from "@/modules/dashboard/components/widgets";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  const active = users.filter((u) => u.status === "active").length;
  const inactive = users.filter((u) => u.status === "inactive").length;
  const avgProductivity = Math.round(
    users.reduce((sum, u) => sum + u.productivityScore, 0) / users.length,
  );
  const runningTimers = Math.round(active * 0.42);

  const topPerformers = [...users]
    .sort((a, b) => b.productivityScore - a.productivityScore)
    .slice(0, 5);

  // Average productivity per department, for Team Comparison.
  const byDept = new Map<string, number[]>();
  for (const u of users) {
    const arr = byDept.get(u.department) ?? [];
    arr.push(u.productivityScore);
    byDept.set(u.department, arr);
  }
  const teamData = [...byDept.entries()]
    .map(([dept, scores]) => ({
      team: dept.split(" ")[0],
      score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);

  return (
    <div className="space-y-5 pt-1">
      <GreetingHeader />

      {/* KPI widgets */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Productivity Score"
          value={`${avgProductivity}%`}
          icon={Gauge}
          hint="this week"
          trend={[64, 66, 63, 70, 72, 69, 74]}
          featured
        />
        <StatCard
          label="Active Users"
          value={active}
          icon={Users}
          delta={4}
          trend={[58, 62, 60, 68, 64, 72, 78]}
        />
        <StatCard
          label="Inactive Users"
          value={inactive}
          icon={UserMinus}
          delta={-2}
          trend={[30, 28, 33, 27, 31, 26, 24]}
        />
        <StatCard
          label="Running Timers"
          value={runningTimers}
          icon={Timer}
          hint="live now"
          trend={[12, 18, 22, 19, 26, 24, 31]}
        />
      </div>

      {/* Team comparison + screenshots */}
      <div className="grid gap-4 xl:grid-cols-3">
        <TeamComparisonChart data={teamData} />
        <ScreenshotsWidget
          count={1284}
          trend={[180, 210, 240, 220, 260, 250, 284]}
        />
      </div>

      {/* People · AI · Billing */}
      <div className="grid gap-4 xl:grid-cols-3">
        <TopEmployeesWidget people={topPerformers} />
        <AiSummaryWidget />
        <BillingWidget plan="Business" seatsUsed={active} seatsTotal={120} />
      </div>

      {/* Alerts · Deadlines · Tasks */}
      <div className="grid gap-4 xl:grid-cols-3">
        <AlertsWidget />
        <DeadlineWidget />
        <UpcomingTasksWidget />
      </div>
    </div>
  );
}

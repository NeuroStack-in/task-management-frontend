import type { Metadata } from "next";
import { users } from "@/lib/data";
import { DashboardView } from "@/modules/dashboard/components/dashboard-view";
import {
  statusCounts,
  attendanceCounts,
  productivityHeatmap,
} from "@/lib/mock-metrics";
import { GreetingHeader } from "@/modules/dashboard/components/greeting-header";
import { DashboardView } from "@/modules/dashboard/components/dashboard-view";
import type { DashboardData } from "@/modules/dashboard/widget-registry";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardView users={users} />;
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

  const data: DashboardData = {
    teamData,
    screenshotCount: 1284,
    screenshotsTrend: [180, 210, 240, 220, 260, 250, 284],
    topPerformers,
    billing: { plan: "Business", seatsUsed: active, seatsTotal: 120 },
    heatmap: productivityHeatmap(),
    attendanceCounts: attendanceCounts(users),
    statusCounts: statusCounts(users),
    activeCount: active,
    inactiveCount: inactive,
  };

  return (
    <div className="space-y-5 pt-1">
      <GreetingHeader />
      <DashboardView
        data={data}
        kpis={{ avgProductivity, active, inactive, runningTimers }}
      />
    </div>
  );
}

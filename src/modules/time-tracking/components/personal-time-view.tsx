"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Clock, CalendarDays, BadgeDollarSign, Activity, Download } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDuration } from "@/lib/format";
import {
  TODAYS_ENTRIES,
  WEEKLY_HOURS,
  formatHours,
  summarize,
  type TimeEntry,
} from "@/lib/mock-time";
import { cn } from "@/lib/utils";
import { TimerHero } from "./timer-hero";
import { WeeklyHoursChart } from "./weekly-hours-chart";

export function PersonalTimeView({ canExport }: { canExport: boolean }) {
  const [entries, setEntries] = useState<TimeEntry[]>(TODAYS_ENTRIES);
  const summary = useMemo(() => summarize(entries, WEEKLY_HOURS), [entries]);

  const handleLogged = (entry: TimeEntry) => setEntries((prev) => [...prev, entry]);

  const exportCsv = () => {
    const csv = Papa.unparse(
      entries.map((e) => ({
        Task: e.task,
        Project: e.project,
        Start: e.start,
        End: e.end ?? "",
        Duration: formatDuration(e.durationSec),
        Billable: e.billable ? "Yes" : "No",
        "Activity %": e.activity,
      })),
    );
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-timesheet.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Timesheet exported", { description: "my-timesheet.csv" });
  };

  return (
    <div className="space-y-6">
      <TimerHero onLogged={handleLogged} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today"
          value={formatDuration(summary.todaySec)}
          icon={Clock}
          hint="tracked"
          trend={summary.trends.today}
          featured
        />
        <StatCard
          label="This week"
          value={formatHours(summary.weekHours)}
          icon={CalendarDays}
          delta={6}
          trend={summary.trends.week}
        />
        <StatCard
          label="Billable"
          value={`${summary.billablePct}%`}
          icon={BadgeDollarSign}
          delta={3}
          trend={summary.trends.billable}
        />
        <StatCard
          label="Avg activity"
          value={`${summary.avgActivity}%`}
          icon={Activity}
          hint="today"
          trend={summary.trends.activity}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <WeeklyHoursChart data={WEEKLY_HOURS} />
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today at a glance</CardTitle>
            <CardDescription>
              {entries.length} entries · {formatDuration(summary.todaySec)} tracked
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SummaryRow
              label="Billable today"
              value={formatHours(
                entries.filter((e) => e.billable).reduce((s, e) => s + e.durationSec, 0) /
                  3600,
              )}
            />
            <SummaryRow label="Focus (avg activity)" value={`${summary.avgActivity}%`} />
            <SummaryRow
              label="Longest session"
              value={formatDuration(
                entries.reduce((m, e) => Math.max(m, e.durationSec), 0),
              )}
            />
            <SummaryRow
              label="Projects touched"
              value={String(new Set(entries.map((e) => e.project)).size)}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Today&apos;s timesheet</CardTitle>
            <CardDescription>Every tracked segment, newest at the bottom.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!canExport}>
            <Download className="size-4" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="w-40">Activity</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.task}</span>
                        {e.billable ? <Badge variant="secondary">Billable</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.project}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                      {e.start} – {e.end ?? "…"}
                    </TableCell>
                    <TableCell>
                      <ActivityBar value={e.activity} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatDuration(e.durationSec)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ActivityBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            value >= 75 ? "bg-success" : value >= 50 ? "bg-primary" : "bg-warning",
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{value}%</span>
    </div>
  );
}

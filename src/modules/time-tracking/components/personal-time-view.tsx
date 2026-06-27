"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Clock,
  CalendarDays,
  BadgeDollarSign,
  Activity,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
  const totalSec = useMemo(
    () => entries.reduce((s, e) => s + e.durationSec, 0),
    [entries],
  );
  // Resolve the date on the client to avoid an SSR/hydration mismatch.
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    );
  }, []);

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
    <div className="space-y-4">
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

      <WeeklyHoursChart data={WEEKLY_HOURS} />

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s timesheet</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-1.5">
            <CalendarDays className="size-3.5" />
            <span className="font-medium text-foreground">
              {today || "Today"}
            </span>
            <span>
              · {entries.length} {entries.length === 1 ? "entry" : "entries"} ·{" "}
              {formatDuration(totalSec)} tracked
            </span>
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!canExport}
            >
              <Download className="size-4" /> Export CSV
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="py-2 pl-4 text-xs font-medium uppercase tracking-wide">
                    Task
                  </TableHead>
                  <TableHead className="py-2 text-xs font-medium uppercase tracking-wide">
                    Project
                  </TableHead>
                  <TableHead className="py-2 text-xs font-medium uppercase tracking-wide">
                    Time
                  </TableHead>
                  <TableHead className="w-36 py-2 text-xs font-medium uppercase tracking-wide">
                    Activity
                  </TableHead>
                  <TableHead className="py-2 pr-4 text-right text-xs font-medium uppercase tracking-wide">
                    Duration
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="py-2 pl-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{e.task}</span>
                        {e.billable ? <Badge variant="secondary" className="px-1.5 py-0 text-[0.65rem]">Billable</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-sm text-muted-foreground">{e.project}</TableCell>
                    <TableCell className="py-2 font-mono text-xs tabular-nums text-muted-foreground">
                      {e.start} – {e.end ?? "…"}
                    </TableCell>
                    <TableCell className="py-2">
                      <ActivityBar value={e.activity} />
                    </TableCell>
                    <TableCell className="py-2 pr-4 text-right font-mono tabular-nums">
                      {formatDuration(e.durationSec)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="py-2 pl-4 font-medium">
                    Total
                  </TableCell>
                  <TableCell className="py-2 pr-4 text-right font-mono font-semibold tabular-nums">
                    {formatDuration(totalSec)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
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

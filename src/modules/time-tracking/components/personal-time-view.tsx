"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  CalendarDays,
  BadgeDollarSign,
  Clock,
  Download,
  Timer,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTimerStore } from "@/stores/timer.store";
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
  TASK_OPTIONS,
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
  const dayStats = useMemo(
    () => ({
      billable: formatHours(
        entries.filter((e) => e.billable).reduce((s, e) => s + e.durationSec, 0) / 3600,
      ),
      focus: `${summary.avgActivity}%`,
      longest: formatDuration(entries.reduce((m, e) => Math.max(m, e.durationSec), 0)),
      projects: String(new Set(entries.map((e) => e.project)).size),
      tasks: String(new Set(entries.map((e) => e.task)).size),
    }),
    [entries, summary.avgActivity],
  );

  // Seed the per-task day clocks from today's logged time once, so restarting a
  // task resumes from its full day total (matching its Today's sessions row).
  // Keyed by taskId; no-op after the first run on a given day (see the store).
  const seedDay = useTimerStore((s) => s.seedDay);
  useEffect(() => {
    const totals: Record<string, number> = {};
    for (const e of TODAYS_ENTRIES) {
      const opt = TASK_OPTIONS.find(
        (o) => o.taskTitle === e.task && o.projectName === e.project,
      );
      if (opt) totals[opt.taskId] = (totals[opt.taskId] ?? 0) + e.durationSec;
    }
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    seedDay(totals, day);
  }, [seedDay]);

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
    <div className="space-y-6">
      <TimerHero entries={entries} onLogged={handleLogged} />

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
              {dayStats.focus} focus
            </span>
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!canExport}
            >
              <Download className="size-4" /> Download CSV
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border sm:grid-cols-4 sm:divide-y-0">
            <SummaryCell
              icon={BadgeDollarSign}
              label="Billable today"
              value={dayStats.billable}
              tone="success"
            />
            <SummaryCell
              icon={Clock}
              label="Total tracked"
              value={formatDuration(totalSec)}
            />
            <SummaryCell
              icon={Timer}
              label="Longest session"
              value={dayStats.longest}
            />
            <SummaryCell
              icon={ListChecks}
              label="Tasks tracked"
              value={dayStats.tasks}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-6 text-xs font-medium uppercase tracking-wide">
                    Task
                  </TableHead>
                  <TableHead className="text-center text-xs font-medium uppercase tracking-wide">
                    Project
                  </TableHead>
                  <TableHead className="text-center text-xs font-medium uppercase tracking-wide">
                    Time
                  </TableHead>
                  <TableHead className="w-40 text-center text-xs font-medium uppercase tracking-wide">
                    Activity
                  </TableHead>
                  <TableHead className="text-center text-xs font-medium uppercase tracking-wide">
                    Duration
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.task}</span>
                        {e.billable ? <Badge variant="secondary">Billable</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{e.project}</TableCell>
                    <TableCell className="text-center font-mono text-xs tabular-nums text-muted-foreground">
                      {e.start} – {e.end ?? "…"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <ActivityBar value={e.activity} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono tabular-nums">
                      {formatDuration(e.durationSec)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-6 font-medium">Total</TableCell>
                  <TableCell colSpan={3} />
                  <TableCell className="text-center font-mono font-semibold tabular-nums">
                    {formatDuration(totalSec)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <WeeklyHoursChart />
    </div>
  );
}

function SummaryCell({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div className="flex items-center gap-3 bg-card px-4 py-3.5">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          tone === "success"
            ? "bg-success/10 text-success"
            : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-[1.15rem]" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-lg font-semibold leading-tight tabular-nums">{value}</p>
      </div>
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

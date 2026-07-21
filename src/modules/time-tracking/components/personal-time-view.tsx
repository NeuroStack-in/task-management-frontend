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
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatHours } from "@/lib/mock-time";
import { cn } from "@/lib/utils";
import { useTimesheet } from "../use-timesheet";
import { TimerHero } from "./timer-hero";
import { WeeklyHoursChart } from "./weekly-hours-chart";
import { PayrollWidget } from "./payroll-widget";

/**
 * Today's timesheet — **the first screen on the real backend** (`GET /v1/me/timesheet/today`).
 *
 * Two things the mock showed that the server does not serve, and which are therefore gone rather
 * than zero-filled (a zero in a percentage column reads as a measurement):
 *   - the **Activity %** column — no built read joins activity samples onto a time entry;
 *   - the **focus** summary derived from it.
 *
 * The timer above is still local demo state. LLD §4 is explicit that the timer is a desktop-agent
 * module and every entry is `source: agent` — there is no manual write path, so time started here
 * cannot reach the server and will not survive a reload. That gap is a product decision, not
 * something to paper over; the table below shows only what the backend actually has.
 */
export function PersonalTimeView({ canExport }: { canExport: boolean }) {
  const { rows, totalSec, billableSec, running, loading, error, reload } =
    useTimesheet();

  const dayStats = useMemo(
    () => ({
      billable: formatHours(billableSec / 3600),
      longest: formatDuration(rows.reduce((m, e) => Math.max(m, e.durationSec), 0)),
      projects: String(new Set(rows.map((e) => e.project)).size),
      tasks: String(new Set(rows.map((e) => e.task)).size),
    }),
    [rows, billableSec],
  );

  // The open session, if any, comes straight from the server's timesheet — the row with no end.
  // The web only *shows* it (LLD §4); the desktop agent owns start/stop.
  const runningRow = rows.find((r) => r.running) ?? null;

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

  const exportCsv = () => {
    const csv = Papa.unparse(
      rows.map((e) => ({
        Task: e.task,
        Project: e.project,
        Start: e.start,
        End: e.end ?? "",
        Duration: e.running ? "" : formatDuration(e.durationSec),
        Billable: e.billable ? "Yes" : "No",
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
      <TimerHero
        running={
          runningRow
            ? {
                // Same precedence as the table: the typed description is what the person
                // recognises; the task title is the fallback, and only then a neutral placeholder.
                task: runningRow.description || runningRow.task || "No description",
                project: runningRow.project,
                start: runningRow.start,
              }
            : null
        }
        todayTotalSec={totalSec}
      />

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s timesheet</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-1.5">
            <CalendarDays className="size-3.5" />
            <span className="font-medium text-foreground">
              {today || "Today"}
            </span>
            <span>
              · {rows.length} {rows.length === 1 ? "entry" : "entries"}
            </span>
            {running ? (
              <Badge variant="secondary" className="gap-1.5">
                <span className="size-1.5 animate-pulse rounded-full bg-success" />
                Session running
              </Badge>
            ) : null}
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!canExport || loading || rows.length === 0}
            >
              <Download className="size-4" /> Download CSV
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-5">
          {error ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
              <TriangleAlert className="size-5 text-warning" />
              <div>
                <p className="text-sm font-medium">Couldn&apos;t load your timesheet</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={reload}>
                Retry
              </Button>
            </div>
          ) : (
            <>
          <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border sm:grid-cols-4 sm:divide-y-0">
            <SummaryCell
              icon={BadgeDollarSign}
              label="Billable today"
              value={dayStats.billable}
              tone="success"
              loading={loading}
            />
            <SummaryCell
              icon={Clock}
              label="Total tracked"
              value={formatDuration(totalSec)}
              loading={loading}
            />
            <SummaryCell
              icon={Timer}
              label="Longest session"
              value={dayStats.longest}
              loading={loading}
            />
            <SummaryCell
              icon={ListChecks}
              label="Tasks tracked"
              value={dayStats.tasks}
              loading={loading}
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
                  <TableHead className="text-center text-xs font-medium uppercase tracking-wide">
                    Duration
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-6" colSpan={4}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No time tracked today. Sessions appear here once the desktop
                      agent syncs them.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-6">
                        {/* Two distinct facts, stacked rather than competing for one label: the
                            **description** is what the person typed and is the thing they recognise,
                            so it leads; the **task** is the assignment it was booked against and is
                            optional (a project-only session has none). Showing whichever happened to
                            be present made one row read "New One" and the next "Api testing", which
                            looks like inconsistent data rather than two different fields. */}
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {e.description || e.task || "No description"}
                          </span>
                          {e.billable ? <Badge variant="secondary">Billable</Badge> : null}
                          {/* The task was deleted or unassigned by the time the session folded.
                              The entry still counts — the time was really worked (LLD §4). */}
                          {e.taskInvalid ? (
                            <Badge variant="outline" className="gap-1 text-warning">
                              <TriangleAlert className="size-3" /> Task removed
                            </Badge>
                          ) : null}
                        </div>
                        {/* Only when it adds something the line above doesn't already say. */}
                        {e.task && e.description ? (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {e.task}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{e.project}</TableCell>
                      <TableCell className="text-center font-mono text-xs tabular-nums text-muted-foreground">
                        {e.start} – {e.end ?? "…"}
                      </TableCell>
                      <TableCell className="text-center font-mono tabular-nums">
                        {/* A running session has no duration yet — not a zero-length one. */}
                        {e.running ? (
                          <span className="text-muted-foreground">Running</span>
                        ) : (
                          formatDuration(e.durationSec)
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-6 font-medium">Total</TableCell>
                  <TableCell colSpan={2} />
                  <TableCell className="text-center font-mono font-semibold tabular-nums">
                    {formatDuration(totalSec)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Weekly hours (stacked bar + week arrows) alongside personal payroll */}
      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <WeeklyHoursChart />
        <PayrollWidget />
      </div>
    </div>
  );
}

function SummaryCell({
  icon: Icon,
  label,
  value,
  tone = "default",
  loading = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "default" | "success";
  loading?: boolean;
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
        {loading ? (
          <Skeleton className="mt-1 h-5 w-16" />
        ) : (
          <p className="text-lg font-semibold leading-tight tabular-nums">{value}</p>
        )}
      </div>
    </div>
  );
}

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
import { formatHours } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTrackingMode } from "@/hooks/use-features";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { useOrgHolidays } from "@/hooks/use-org-holidays";
import { HolidayBadge } from "@/components/shared/holiday-badge";
import { useRunningSeconds } from "@/hooks/use-live-refresh";
import { useTimesheet } from "../use-timesheet";
import { TimesheetHistory } from "./timesheet-history";
import { TimerHero } from "./timer-hero";
import { WeeklyHoursChart } from "./weekly-hours-chart";
import { RefreshButton } from "@/components/shared/refresh-button";
import { PageActions } from "@/components/shared/page-actions";
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
  const { rows, totalSec: settledSec, billableSec, running, loading, error, reload } =
    useTimesheet();

  // ── One definition of "today", and it ticks ─────────────────────────────────────────────────
  //
  // `useTimesheet`'s `totalSec` is **settled** time: a running session contributes nothing until it
  // ends. Reading it as the day's total is why this page showed 1:50:30 while the dashboard showed
  // 2.4h — same data, two different questions, no way for a reader to tell which was wrong.
  //
  // The day's total is settled + the open session's elapsed, everywhere. Derived from the running
  // row's own start stamp on a local 1 Hz re-render — the same mechanism as every other live clock
  // in the app. Nothing polls per second.
  // The open session, if any, comes straight from the server's timesheet — the row with no end.
  // The web only *shows* it (LLD §4); the desktop agent owns start/stop.
  const runningRow = rows.find((r) => r.running) ?? null;
  const liveSec = useRunningSeconds(runningRow ? runningRow.startMs : null);
  const totalSec = settledSec + liveSec;
  // Machine-mode orgs track laptop uptime, not projects: no task/project/billable, and the timer is a
  // background service (§8 Ph5). The web still only *mirrors* — start/stop lives on the device.
  const isMachine = useTrackingMode() === "machine";

  const dayStats = useMemo(
    () => ({
      // Billable counts the open session too when it is billable — it is being worked now, and a
      // "billable today" that ignores the current session understates the day all day.
      billable: formatHours(
        (billableSec + (runningRow?.billable ? liveSec : 0)) / 3600,
      ),
      // The running session can be the longest one; it was excluded because its `durationSec` is 0
      // until it ends, so a day whose longest stretch was still in progress reported the second
      // longest.
      longest: formatDuration(
        Math.max(rows.reduce((m, e) => Math.max(m, e.durationSec), 0), liveSec),
      ),
      projects: String(new Set(rows.map((e) => e.project)).size),
      tasks: String(new Set(rows.map((e) => e.task)).size),
    }),
    [rows, billableSec, liveSec, runningRow],
  );

  const holidays = useOrgHolidays();

  // Resolve the date on the client to avoid an SSR/hydration mismatch.
  const [today, setToday] = useState("");
  // `YYYY-MM-DD` for today (local), resolved client-side too — used to flag a holiday.
  const [todayIso, setTodayIso] = useState("");
  useEffect(() => {
    const now = new Date();
    setToday(
      now.toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    );
    const p = (n: number) => String(n).padStart(2, "0");
    setTodayIso(`${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`);
  }, []);
  const todayHoliday = todayIso ? holidays.nameFor(todayIso) : undefined;

  // Publish today's timesheet totals to the assistant so "how much have I tracked" resolves against
  // exactly what this page shows.
  useAssistantPageContext({
    date: todayIso || null,
    facts: [
      { label: "Tracked today", value: formatHours(totalSec / 3600) },
      ...(isMachine ? [] : [{ label: "Billable today", value: dayStats.billable }]),
      { label: "Timer running", value: running ? "yes" : "no" },
      ...(isMachine
        ? []
        : [
            { label: "Projects touched", value: dayStats.projects },
            { label: "Tasks touched", value: dayStats.tasks },
          ]),
    ],
  });

  const exportCsv = () => {
    // Machine mode drops Project/Task/Billable (they don't exist for a device) — one union header.
    const csv = Papa.unparse(
      rows.map((e) =>
        isMachine
          ? {
              Start: e.start,
              End: e.end ?? "",
              Duration: formatDuration(e.running ? liveSec : e.durationSec),
            }
          : {
              Task: e.task,
              Project: e.project,
              Start: e.start,
              End: e.end ?? "",
              Duration: formatDuration(e.running ? liveSec : e.durationSec),
              Billable: e.billable ? "Yes" : "No",
            },
      ),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
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
            ? isMachine
              ? {
                  kind: "machine",
                  start: runningRow.start,
                  startMs: runningRow.startMs,
                }
              : {
                  kind: "task",
                  // Same precedence as the table: the typed description is what the person
                  // recognises; the task title is the fallback, and only then a neutral placeholder.
                  task: runningRow.description || runningRow.task || "No description",
                  project: runningRow.project,
                  start: runningRow.start,
                  startMs: runningRow.startMs,
                }
            : null
        }
        todayTotalSec={totalSec}
      />

      {/* `time:sessions` is marked in BOTH branches of /time-tracking — PersonalTimeView here and
          TeamTimeView for anyone who can manage a team. A marker in only one is invisible to half
          the roles, which is how the dashboard steps broke. */}
      <Card data-tour="time:sessions">
        <CardHeader>
          <CardTitle>Today&apos;s timesheet</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-1.5">
            <CalendarDays className="size-3.5" />
            <span className="text-foreground font-medium">{today || "Today"}</span>
            <span>
              · {rows.length} {rows.length === 1 ? "entry" : "entries"}
            </span>
            {running ? (
              <Badge variant="secondary" className="gap-1.5">
                <span className="bg-success size-1.5 animate-pulse rounded-full" />
                Session running
              </Badge>
            ) : null}
            {todayHoliday ? <HolidayBadge name={todayHoliday} /> : null}
          </CardDescription>
          <CardAction>
            {/* Refetch today's timesheet in place — no page reload. Refresh goes to the top-navbar
                action slot (the app-wide fixed spot); the page-specific export stays on the card. */}
            <PageActions>
              <RefreshButton onRefresh={reload} refreshing={loading} />
            </PageActions>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={!canExport || loading || rows.length === 0}
              >
                <Download className="size-4" /> Download CSV
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-5">
          {error ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-10 text-center">
              <TriangleAlert className="text-warning size-5" />
              <div>
                <p className="text-sm font-medium">Couldn&apos;t load your timesheet</p>
                <p className="text-muted-foreground text-sm">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={reload}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <div
                className="divide-border grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border sm:grid-cols-4 sm:divide-y-0"
                data-tour="time:totals"
              >
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
                      <TableHead className="pl-6 text-xs font-medium tracking-wide uppercase">
                        Task
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium tracking-wide uppercase">
                        Project
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium tracking-wide uppercase">
                        Time
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium tracking-wide uppercase">
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
                          className="text-muted-foreground py-10 text-center text-sm"
                        >
                          No time tracked today. Sessions appear here once the desktop
                          agent syncs them.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="pl-6">
                            {/* Two distinct facts, stacked rather than competing for one label — but
                            the **task** leads now, not the description. The task is what the work
                            *is*; the description is what was said about it. With the description on
                            top, a day read as rows of free text with the actual task nowhere on
                            screen, and the TASK column was named after the one thing it wasn't
                            showing. A project-only session still has no task, so the description
                            remains the fallback. */}
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {e.task || e.description || "No description"}
                              </span>
                              {e.billable ? (
                                <Badge variant="secondary">Billable</Badge>
                              ) : null}
                              {/* The task was deleted or unassigned by the time the session folded.
                              The entry still counts — the time was really worked (LLD §4). */}
                              {e.taskInvalid ? (
                                <Badge variant="outline" className="text-warning gap-1">
                                  <TriangleAlert className="size-3" /> Task removed
                                </Badge>
                              ) : null}
                            </div>
                            {/* Only when it adds something the line above doesn't already say. */}
                            {e.task && e.description && e.description !== e.task ? (
                              <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                                {e.description}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-center">
                            {e.project}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-center font-mono text-xs tabular-nums">
                            {e.start} – {e.end ?? "…"}
                          </TableCell>
                          <TableCell className="text-center font-mono tabular-nums">
                            {/* A running session has no duration yet — not a zero-length one. */}
                            {e.running ? (
                              // The elapsed time, ticking — not the word "Running". The row is
                              // the only thing on the page that changes while you watch it, and a
                              // static label made the day's most current row its least informative.
                              <span className="text-primary font-medium tabular-nums">
                                {formatDuration(liveSec)}
                              </span>
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

      {/* Previous days sit directly under today: today stays the primary view, and history is one
          date-pick away rather than a separate page. */}
      <TimesheetHistory />

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
    <div className="bg-card flex items-center gap-3 px-4 py-3.5">
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
        <p className="text-muted-foreground truncate text-[0.7rem] font-medium tracking-wide uppercase">
          {label}
        </p>
        {loading ? (
          <Skeleton className="mt-1 h-5 w-16" />
        ) : (
          <p className="text-lg leading-tight font-semibold tabular-nums">{value}</p>
        )}
      </div>
    </div>
  );
}

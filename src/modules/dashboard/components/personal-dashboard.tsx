"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  ListChecks,
  FolderKanban,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { TimerStatCard } from "./timer-stat-card";
import { MeetingHoursCard } from "@/modules/integrations/components/meeting-hours-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/shared/loader";
import { TASK_STATUS_META, type TaskStatus } from "@/modules/projects/types";
import { useMyWork } from "../use-my-work";
import { useMyAttendance, ymd } from "@/modules/attendance/use-my-attendance";
import { useIsSurfaceOn } from "@/hooks/use-features";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/12 text-primary",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/12 text-success",
  negative: "bg-destructive/12 text-destructive",
};

const ATTENDANCE: Record<string, { dot: string; label: string }> = {
  present: { dot: "bg-success", label: "Present" },
  partial: { dot: "bg-warning", label: "Partial" },
  leave: { dot: "bg-primary", label: "On leave" },
  absent: { dot: "bg-destructive", label: "Absent" },
  non_workday: { dot: "bg-muted-foreground/40", label: "Non-working day" },
};
const attMeta = (s: string) => ATTENDANCE[s] ?? { dot: "bg-muted-foreground/40", label: s };

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTH = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDue(iso: string | null): string {
  if (!iso) return "No due date";
  const [, m, d] = iso.split("-").map(Number);
  return `${SHORT_MONTH[m - 1]} ${d}`;
}

export function PersonalDashboard() {
  const { openTasks, doneCount, myProjects, loading } = useMyWork();
  const isSurfaceOn = useIsSurfaceOn();
  // These surfaces are gated: Time Tracking (the timer tile) and Projects (task/project cards + the
  // work sections below). Hidden when the org switched the feature off, or its tracking mode hides
  // it (MANAGED-AGENT.md §8). Grid children auto-flow, so dropping cards leaves no hole.
  const showTimer = isSurfaceOn("time.tracking");
  const showProjects = isSurfaceOn("projects");

  // Compute the trailing 7-day window on the client (real "today"); render it only after mount to
  // avoid an SSR/client date mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const week = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - (6 - i));
      return {
        key: ymd(d.getFullYear(), d.getMonth(), d.getDate()),
        y: d.getFullYear(),
        m: d.getMonth(),
        day: d.getDate(),
        label: SHORT_DAY[d.getDay()],
      };
    });
  }, []);
  const att = useMyAttendance(week[0].key, week[6].key);

  const attRows = week.map((w) => ({ ...w, record: att.recordFor(w.y, w.m, w.day) }));
  const weekHours =
    Math.round(attRows.reduce((sum, w) => sum + (w.record?.hours ?? 0), 0) * 10) / 10;
  const daysPresent = attRows.filter((w) => w.record?.status === "present").length;

  if (loading && openTasks.length === 0 && myProjects.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader label="Loading your work…" />
      </div>
    );
  }

  return (
    <>
      {/* Personal KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="dash:kpis">
        {showTimer && <TimerStatCard />}
        <MeetingHoursCard />
        <StatCard
          label="Hours this week"
          value={mounted ? weekHours.toFixed(1) : "—"}
          icon={Clock}
          hint="from attendance"
          href="/attendance"
        />
        {showProjects && (
          <>
            <StatCard
              label="Open Tasks"
              value={openTasks.length}
              icon={ListChecks}
              hint={`${doneCount} completed`}
              href="/projects"
            />
            <StatCard
              label="My Projects"
              value={myProjects.length}
              icon={FolderKanban}
              hint="you're a member of"
              href="/projects"
            />
          </>
        )}
      </div>

      {showProjects && (
      <div className="grid gap-4 xl:grid-cols-3">
        {/* My tasks */}
        <Card
          data-tour="dash:tasks"
          className="gap-0 p-0 [--card-spacing:0px] xl:col-span-2"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold tracking-tight">My tasks</h2>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              View all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {openTasks.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
              <CheckCircle2 className="size-6 text-success/70" />
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-muted-foreground">No open tasks assigned to you right now.</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <ul className="divide-y divide-border">
                {openTasks.slice(0, 6).map((t) => {
                  const meta = TASK_STATUS_META[t.status as TaskStatus];
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      {t.projectKey ? (
                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                          {t.projectKey}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                      <span className="hidden w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:inline">
                        {formatDue(t.due)}
                      </span>
                      <span className="flex w-28 shrink-0 justify-end">
                        {meta ? (
                          <Badge className={cn("font-medium", TONE[meta.tone])}>{meta.label}</Badge>
                        ) : (
                          <Badge className="font-medium">{t.status}</Badge>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-1 items-center justify-center gap-2 px-5 py-4 text-center text-sm text-muted-foreground">
                {openTasks.length > 6 ? (
                  <>
                    <ListChecks className="size-4 shrink-0" />
                    <span>
                      {openTasks.length - 6} more open{" "}
                      {openTasks.length - 6 === 1 ? "task" : "tasks"}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4 shrink-0 text-success/70" />
                    <span>That&apos;s all your open tasks right now.</span>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* This week's attendance */}
        <Card data-tour="dash:week" className="gap-0 p-0 [--card-spacing:0px]">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold tracking-tight">This week</h2>
            <Link
              href="/attendance"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Details <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="space-y-2.5 px-5 py-4">
            {!mounted ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : (
              attRows.map((w) => {
                const meta = w.record ? attMeta(w.record.status) : null;
                return (
                  <div key={w.key} className="flex items-center gap-3 text-sm">
                    <span className="w-9 shrink-0 text-muted-foreground">{w.label}</span>
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        meta?.dot ?? "bg-muted-foreground/20",
                      )}
                    />
                    <span className="flex-1 text-muted-foreground">{meta?.label ?? "No record"}</span>
                    <span className="shrink-0 tabular-nums">
                      {w.record && w.record.hours > 0 ? `${w.record.hours.toFixed(1)}h` : "—"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              {mounted ? `${daysPresent}/7 days present` : "—"}
            </span>
            <span className="font-medium tabular-nums">{mounted ? `${weekHours}h total` : "—"}</span>
          </div>
        </Card>

        {/* My projects */}
        <Card className="gap-0 p-0 [--card-spacing:0px] xl:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold tracking-tight">My projects</h2>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              View all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {myProjects.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              You&apos;re not assigned to any projects yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {myProjects.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                  {p.key ? (
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                      {p.key}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <Badge variant="outline" className="shrink-0 font-normal capitalize">
                    {p.status.replace(/_/g, " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      )}
    </>
  );
}

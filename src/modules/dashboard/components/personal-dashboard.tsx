"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Gauge,
  Clock,
  ListChecks,
  FolderKanban,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth.store";
import { useTasksStore } from "@/stores/tasks.store";
import { projects } from "@/lib/data";
import { dayRecordFor, TODAY, type DayStatus } from "@/lib/mock-attendance";
import { TASK_STATUS_META, type TaskStatus } from "@/modules/projects/types";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/12 text-primary",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/12 text-success",
  negative: "bg-destructive/12 text-destructive",
};

const ATTENDANCE: Record<DayStatus, { dot: string; label: string }> = {
  present: { dot: "bg-success", label: "Present" },
  partial: { dot: "bg-warning", label: "Partial" },
  leave: { dot: "bg-primary", label: "On leave" },
  absent: { dot: "bg-destructive", label: "Absent" },
  non_workday: { dot: "bg-muted-foreground/40", label: "Non-working day" },
};

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

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function PersonalDashboard() {
  const user = useAuthStore((s) => s.user);
  const tasks = useTasksStore((s) => s.tasks);

  const userId = user?.id ?? "";

  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [],
  );

  const myProjects = useMemo(
    () => projects.filter((p) => p.memberIds.includes(userId)),
    [userId],
  );

  const { openTasks, doneCount } = useMemo(() => {
    const mine = tasks.filter((t) => t.assigneeId === userId);
    const open = mine
      .filter((t) => t.status !== "done")
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    return { openTasks: open, doneCount: mine.length - open.length };
  }, [tasks, userId]);

  // This week's attendance (last 7 calendar days ending on the demo "today").
  const week = useMemo(() => {
    const base = new Date(TODAY.year, TODAY.month, TODAY.day);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - (6 - i));
      return {
        key: d.toISOString().slice(0, 10),
        label: SHORT_DAY[d.getDay()],
        record: dayRecordFor(userId, d.getFullYear(), d.getMonth(), d.getDate()),
      };
    });
  }, [userId]);

  if (!user) return null;

  const hoursToday = week[week.length - 1].record.hours;
  const weekHours =
    Math.round(week.reduce((sum, w) => sum + w.record.hours, 0) * 10) / 10;
  // `present` already includes late arrivals — `late` is a qualifier, not a peer status,
  // so the old `present || late` is now just `present` (LLD §7).
  const daysPresent = week.filter((w) => w.record.status === "present").length;

  const score = user.productivityScore;
  const trend = [score - 6, score - 3, score - 5, score - 2, score - 3, score - 1, score].map(clamp);

  return (
    <>
      {/* Personal KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My Productivity"
          value={`${score}%`}
          icon={Gauge}
          hint="this week"
          trend={trend}
          featured
          href="/time-tracking"
        />
        <StatCard
          label="Hours Today"
          value={hoursToday.toFixed(1)}
          icon={Clock}
          hint={`${weekHours}h this week`}
          href="/time-tracking"
        />
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
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* My tasks */}
        <Card className="gap-0 p-0 [--card-spacing:0px] xl:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold tracking-tight">
              My tasks
            </h2>
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
              <p className="text-xs text-muted-foreground">
                No open tasks assigned to you right now.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <ul className="divide-y divide-border">
              {openTasks.slice(0, 6).map((t) => {
                const project = projectById.get(t.projectId);
                const meta = TASK_STATUS_META[t.status as TaskStatus];
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 px-5 py-3 text-sm"
                  >
                    {project ? (
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                        {project.key}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {t.title}
                    </span>
                    <span className="hidden w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums sm:inline">
                      {formatDue(t.dueDate)}
                    </span>
                    <span className="flex w-28 shrink-0 justify-end">
                      <Badge className={cn("font-medium", TONE[meta.tone])}>
                        {meta.label}
                      </Badge>
                    </span>
                  </li>
                );
              })}
              </ul>
              {/* Fill any leftover space (card stretches to match "This week")
                  with a friendly note instead of blank space. */}
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
        <Card className="gap-0 p-0 [--card-spacing:0px]">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold tracking-tight">
              This week
            </h2>
            <Link
              href="/attendance"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Details <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="space-y-2.5 px-5 py-4">
            {week.map((w) => {
              const att = ATTENDANCE[w.record.status];
              return (
                <div key={w.key} className="flex items-center gap-3 text-sm">
                  <span className="w-9 shrink-0 text-muted-foreground">
                    {w.label}
                  </span>
                  <span className={cn("size-2 shrink-0 rounded-full", att.dot)} />
                  <span className="flex-1 text-muted-foreground">{att.label}</span>
                  <span className="shrink-0 tabular-nums">
                    {w.record.hours > 0 ? `${w.record.hours.toFixed(1)}h` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              {daysPresent}/7 days present
            </span>
            <span className="font-medium tabular-nums">{weekHours}h total</span>
          </div>
        </Card>

        {/* My projects */}
        <Card className="gap-0 p-0 [--card-spacing:0px] xl:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold tracking-tight">
              My projects
            </h2>
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
              {myProjects.slice(0, 5).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-4 px-5 py-3 text-sm"
                >
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                    {p.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {p.name}
                  </span>
                  <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-muted sm:block">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">
                    {p.progress}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

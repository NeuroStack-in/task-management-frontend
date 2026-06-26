"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Gauge, Clock, ArrowRight } from "lucide-react";
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
  late: { dot: "bg-warning", label: "Late" },
  leave: { dot: "bg-primary", label: "On leave" },
  absent: { dot: "bg-destructive", label: "Absent" },
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

  const openTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.assigneeId === userId && t.status !== "done")
        .sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        }),
    [tasks, userId],
  );

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
  const daysPresent = week.filter(
    (w) => w.record.status === "present" || w.record.status === "late",
  ).length;

  const score = user.productivityScore;
  const trend = [score - 6, score - 3, score - 5, score - 2, score - 3, score - 1, score].map(clamp);

  return (
    <>
      {/* Personal KPI strip — only the two metrics the lists below don't
          already surface. Open Tasks and My Projects counts were dropped
          because the "My tasks" and "My projects" lists show them directly. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="My Productivity"
          value={`${score}%`}
          icon={Gauge}
          hint="this week"
          trend={trend}
          featured
        />
        <StatCard
          label="Hours Today"
          value={hoursToday.toFixed(1)}
          icon={Clock}
          hint={`${weekHours}h this week`}
        />
      </div>

      {/* My tasks (3fr) sits beside a roomier This week (2fr); My projects gets
          its own full-width row below so progress bars have real space. */}
      <div className="grid gap-4 xl:grid-cols-5">
        {/* My tasks */}
        <Card className="gap-0 p-0 xl:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold tracking-tight">
              My tasks
            </h2>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              View all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {openTasks.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up — no open tasks assigned to you.
            </p>
          ) : (
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
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      {formatDue(t.dueDate)}
                    </span>
                    <Badge className={cn("shrink-0 font-medium", TONE[meta.tone])}>
                      {meta.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* This week's attendance */}
        <Card className="gap-0 p-0 xl:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold tracking-tight">
              This week
            </h2>
            <Link
              href="/attendance"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
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
        <Card className="gap-0 p-0 xl:col-span-5">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold tracking-tight">
              My projects
            </h2>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
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

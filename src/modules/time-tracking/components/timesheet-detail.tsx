"use client";

import {
  Activity,
  BadgeDollarSign,
  Clock,
  Coffee,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatHours, type TimesheetStatus } from "@/lib/mock-time";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  TimesheetStatus,
  { label: string; className: string }
> = {
  "on-track": { label: "On track", className: "bg-success/12 text-success" },
  flagged: { label: "Flagged", className: "bg-destructive/12 text-destructive" },
};

const TASK_POOL = [
  "Checkout flow",
  "Dashboard redesign",
  "API integration",
  "Bug triage",
  "Design review",
  "Sprint planning",
  "Customer onboarding",
  "Docs update",
  "Performance tuning",
  "Code review",
  "QA regression",
  "Data migration",
];

const PROJECT_POOL = [
  "Acme Storefront",
  "Platform",
  "Customer Success",
  "Atlas Migration",
  "Internal Tools",
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/* ----------------------------- view model ----------------------------- */

export type ActivityView =
  | {
      kind: "day";
      rowId: string;
      name: string;
      subtitle: string;
      isProject: boolean;
      status: TimesheetStatus;
      dateLabel: string;
      dayIndex: number;
      hours: number;
    }
  | {
      kind: "week";
      rowId: string;
      name: string;
      subtitle: string;
      isProject: boolean;
      status: TimesheetStatus;
      weekRange: string;
      days: number[];
    };

interface TaskItem {
  name: string;
  project: string;
  hours: number;
  progress: number;
}

interface DayActivity {
  working: number;
  idle: number;
  activity: number;
  billable: number;
  tasks: TaskItem[];
}

function buildDayActivity(
  rowId: string,
  isProject: boolean,
  name: string,
  dayHours: number,
  dayIndex: number,
): DayActivity {
  const seed = hash(`${rowId}:${dayIndex}`);
  if (dayHours <= 0) {
    return { working: 0, idle: 0, activity: 0, billable: 0, tasks: [] };
  }
  const idle = Math.round((0.3 + (seed % 11) / 10) * 100) / 100; // 0.3–1.3h
  const activity = 50 + (seed % 46); // 50–95
  const billable = Math.round(dayHours * (0.5 + (seed % 40) / 100) * 100) / 100;

  const n = 2 + (seed % 3); // 2–4 tasks
  let remaining = dayHours;
  const tasks: TaskItem[] = [];
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const share = isLast
      ? remaining
      : Math.round(remaining * (0.3 + ((seed >> i) % 30) / 100) * 100) / 100;
    remaining = Math.max(0, Math.round((remaining - share) * 100) / 100);
    tasks.push({
      name: TASK_POOL[(seed + i * 5) % TASK_POOL.length],
      project: isProject
        ? name
        : PROJECT_POOL[(seed + i) % PROJECT_POOL.length],
      hours: Math.max(0.25, share),
      progress: 20 + ((seed + i * 13) % 75),
    });
  }
  return { working: dayHours, idle, activity, billable, tasks };
}

interface WeekActivity {
  perDay: { working: number; idle: number }[];
  totalWorking: number;
  totalIdle: number;
  billablePct: number;
  avgActivity: number;
  progress: number;
  top: TaskItem[];
}

function buildWeekActivity(
  rowId: string,
  isProject: boolean,
  name: string,
  days: number[],
): WeekActivity {
  const perDay = days.map((h, i) => {
    const a = buildDayActivity(rowId, isProject, name, h, i);
    return { working: a.working, idle: h > 0 ? a.idle : 0 };
  });
  const totalWorking = perDay.reduce((s, d) => s + d.working, 0);
  const totalIdle = perDay.reduce((s, d) => s + d.idle, 0);
  const seed = hash(rowId);
  const billablePct = 55 + (seed % 38);
  const avgActivity = 55 + (hash(`${rowId}a`) % 40);
  const progress = isProject
    ? 30 + (seed % 65)
    : Math.min(98, 40 + (hash(`${rowId}p`) % 55));

  // Aggregate top tasks across the week.
  const map = new Map<string, TaskItem>();
  days.forEach((h, i) => {
    if (h <= 0) return;
    for (const t of buildDayActivity(rowId, isProject, name, h, i).tasks) {
      const prev = map.get(t.name);
      if (prev) prev.hours = Math.round((prev.hours + t.hours) * 100) / 100;
      else map.set(t.name, { ...t });
    }
  });
  const top = [...map.values()].sort((a, b) => b.hours - a.hours).slice(0, 5);

  return {
    perDay,
    totalWorking,
    totalIdle,
    billablePct,
    avgActivity,
    progress,
    top,
  };
}

/* ------------------------------ component ----------------------------- */

export function ActivityDialog({
  view,
  onClose,
}: {
  view: ActivityView | null;
  onClose: () => void;
}) {
  const meta = view ? STATUS_META[view.status] : null;

  return (
    <Dialog open={!!view} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {view ? (
          <>
            <DialogHeader className="border-b p-5 pr-12 text-left">
              <div className="flex items-center gap-2">
                <Badge className={meta!.className}>{meta!.label}</Badge>
                <span className="text-xs text-muted-foreground">
                  {view.kind === "day" ? "Daily activity" : "Weekly activity"}
                </span>
              </div>
              <DialogTitle className="mt-1 text-lg">{view.name}</DialogTitle>
              <DialogDescription>
                {view.subtitle} ·{" "}
                {view.kind === "day" ? view.dateLabel : view.weekRange}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 p-5">
              {view.kind === "day" ? (
                <DayDetail view={view} />
              ) : (
                <WeekDetail view={view} />
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DayDetail({
  view,
}: {
  view: Extract<ActivityView, { kind: "day" }>;
}) {
  const a = buildDayActivity(
    view.rowId,
    view.isProject,
    view.name,
    view.hours,
    view.dayIndex,
  );

  if (view.hours <= 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        No hours logged on this day — a day off.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Tile icon={Clock} label="Working" value={formatHours(a.working)} />
        <Tile
          icon={Coffee}
          label="Non-working"
          value={formatHours(a.idle)}
          muted
        />
        <Tile icon={Activity} label="Activity" value={`${a.activity}%`} />
        <Tile
          icon={BadgeDollarSign}
          label="Billable"
          value={formatHours(a.billable)}
        />
      </div>

      <SplitBar working={a.working} idle={a.idle} />

      <Section title={view.isProject ? "Tasks worked" : "Tasks & projects"}>
        <ul className="space-y-3">
          {a.tasks.map((t, i) => (
            <TaskRow key={i} task={t} showProject={!view.isProject} />
          ))}
        </ul>
      </Section>
    </>
  );
}

function WeekDetail({
  view,
}: {
  view: Extract<ActivityView, { kind: "week" }>;
}) {
  const a = buildWeekActivity(view.rowId, view.isProject, view.name, view.days);
  const max = Math.max(...a.perDay.map((d) => d.working + d.idle), 1);

  return (
    <>
      {/* Per-day working vs non-working */}
      <Section title="Hours per day · working vs non-working">
        <div className="flex items-end justify-between gap-2 pt-1">
          {a.perDay.map((d, i) => {
            const total = d.working + d.idle;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-28 w-full max-w-9 flex-col justify-end overflow-hidden rounded-md bg-muted">
                  {total > 0 ? (
                    <>
                      <div
                        className="w-full bg-muted-foreground/30"
                        style={{ height: `${(d.idle / max) * 100}%` }}
                        title={`Non-working ${formatHours(d.idle)}`}
                      />
                      <div
                        className="w-full bg-primary"
                        style={{ height: `${(d.working / max) * 100}%` }}
                        title={`Working ${formatHours(d.working)}`}
                      />
                    </>
                  ) : null}
                </div>
                <span className="text-[0.7rem] text-muted-foreground">
                  {DAY_LABELS[i]}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <Legend className="bg-primary" label="Working" />
          <Legend className="bg-muted-foreground/30" label="Non-working" />
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-3">
        <Tile icon={Clock} label="Total working" value={formatHours(a.totalWorking)} />
        <Tile
          icon={Coffee}
          label="Total non-working"
          value={formatHours(a.totalIdle)}
          muted
        />
        <Tile icon={BadgeDollarSign} label="Billable" value={`${a.billablePct}%`} />
        <Tile icon={Activity} label="Avg activity" value={`${a.avgActivity}%`} />
      </div>

      <Section
        title={view.isProject ? "Project progress" : "Overall progress"}
      >
        <div className="flex items-center gap-3">
          <TrendingUp className="size-4 text-primary" />
          <ProgressBar value={a.progress} className="h-2.5 flex-1" />
          <span className="font-heading text-sm font-semibold tabular-nums">
            {a.progress}%
          </span>
        </div>
      </Section>

      <Section title={view.isProject ? "Top tasks" : "Top tasks this week"}>
        <ul className="space-y-3">
          {a.top.map((t, i) => (
            <TaskRow key={i} task={t} showProject={!view.isProject} />
          ))}
        </ul>
      </Section>
    </>
  );
}

/* ------------------------------- atoms -------------------------------- */

function Tile({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-heading text-lg font-semibold tabular-nums",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SplitBar({ working, idle }: { working: number; idle: number }) {
  const total = working + idle || 1;
  return (
    <div className="space-y-1.5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="bg-primary"
          style={{ width: `${(working / total) * 100}%` }}
        />
        <div
          className="bg-muted-foreground/30"
          style={{ width: `${(idle / total) * 100}%` }}
        />
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <Legend className="bg-primary" label={`Working ${formatHours(working)}`} />
        <Legend
          className="bg-muted-foreground/30"
          label={`Non-working ${formatHours(idle)}`}
        />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function TaskRow({
  task,
  showProject,
}: {
  task: TaskItem;
  showProject: boolean;
}) {
  return (
    <li className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium">{task.name}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {formatHours(task.hours)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <ProgressBar value={task.progress} className="h-1.5 flex-1" />
        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {task.progress}%
        </span>
      </div>
      {showProject ? (
        <p className="truncate text-xs text-muted-foreground">{task.project}</p>
      ) : null}
    </li>
  );
}

function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

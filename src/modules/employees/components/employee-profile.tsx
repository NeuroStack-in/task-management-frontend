"use client";

import Link from "next/link";
import { ArrowLeft, FolderKanban, Sparkles } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ProjectItem {
  id: string;
  name: string;
  key: string;
  progress: number;
  tasks: number;
  teammates: number;
  active: boolean;
}

export interface EmployeeProfileData {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  jobTitle: string;
  department: string;
  team: string;
  roleName: string;
  status: "active" | "inactive" | "invited" | "suspended";
  productivityScore: number;
  empCode: string;
  phone: string;
  dob: string;
  hireDate: string;
  country: string;
  cityState: string;
  address: string;
  postcode: string;
  projects: ProjectItem[];
  kpi: { months: string[]; current: number[]; previous: number[] };
  totalTasks: number;
  avgCompletion: number;
}

const STATUS_META: Record<EmployeeProfileData["status"], string> = {
  active: "bg-success/12 text-success",
  inactive: "bg-muted text-muted-foreground",
  invited: "bg-warning/15 text-warning",
  suspended: "bg-destructive/12 text-destructive",
};

export function EmployeeProfile({ data }: { data: EmployeeProfileData }) {
  const chartData = data.kpi.months.map((m, i) => ({
    month: m,
    current: data.kpi.current[i],
    previous: data.kpi.previous[i],
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All employees
        </Link>
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Team</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">{data.name}</span>
        </nav>
      </div>

      {/* Employee — identity, contact & address in ONE card */}
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-col gap-5 border-b p-6 sm:flex-row sm:items-center">
          <Avatar className="size-20 shrink-0 ring-4 ring-feature-tint">
            <AvatarImage src={data.avatarUrl} alt={data.name} />
            <AvatarFallback className="text-xl">
              {initials(data.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {data.name}
              </h1>
              <span className="font-mono text-xs text-muted-foreground">
                {data.empCode}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data.jobTitle} · {data.department}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Badge className="bg-feature-tint text-primary">
                {data.roleName}
              </Badge>
              <Badge className={STATUS_META[data.status]}>{data.status}</Badge>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Phone" value={data.phone} />
          <Detail label="Email" value={data.email} />
          <Detail label="Team" value={data.team} />
          <Detail label="Date of birth" value={data.dob} />
          <Detail label="Hire date" value={data.hireDate} />
          <Detail label="Country" value={data.country} />
          <Detail label="City / State" value={data.cityState} />
          <Detail label="Address" value={data.address} />
          <Detail label="Postcode" value={data.postcode} />
        </dl>
      </div>

      {/* Projects — all projects, single accent bar, Active badge when active */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-feature-tint text-primary">
            <FolderKanban className="size-4" />
          </span>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Projects
          </p>
          <Badge className="bg-muted font-normal text-muted-foreground">
            {data.projects.length}
          </Badge>
        </div>
        {data.projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not assigned to any project yet.
          </p>
        ) : (
          <ul className="space-y-5">
            {data.projects.map((p) => (
              <li key={p.id} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="rounded bg-accent px-1 font-mono text-[0.65rem] font-semibold text-accent-foreground">
                      {p.key}
                    </span>
                    <span className="truncate">{p.name}</span>
                    {p.active ? (
                      <Badge className="bg-success/12 text-[0.65rem] text-success">
                        Active
                      </Badge>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    {p.progress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="wp-meter-fill h-full rounded-full bg-primary"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.tasks} tasks · {p.teammates} teammates
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* KPI chart */}
      <div className="rounded-2xl border bg-card p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-feature-tint text-primary">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                KPI
              </p>
              <p className="text-xs text-muted-foreground/80">
                Avg. productive hours / day
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Legend className="bg-primary" label="Last 6 months" />
            <Legend className="bg-muted-foreground/50" label="Previous 6 months" dashed />
          </div>
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart
            data={chartData}
            margin={{ top: 6, right: 8, bottom: 0, left: -16 }}
          >
            <defs>
              <linearGradient id="kpi-current" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              dy={6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={42}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickFormatter={(v) => `${v}h`}
            />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--muted-foreground)" }}
              formatter={(v: number) => `${v}h`}
            />
            <Area
              type="monotone"
              dataKey="previous"
              name="Previous 6 months"
              stroke="var(--muted-foreground)"
              strokeDasharray="5 5"
              strokeOpacity={0.55}
              strokeWidth={2}
              fill="transparent"
              dot={false}
              activeDot={false}
            />
            <Area
              type="monotone"
              dataKey="current"
              name="Last 6 months"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="url(#kpi-current)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Employee summary */}
      <AiInsights data={data} />
    </div>
  );
}

function AiInsights({ data }: { data: EmployeeProfileData }) {
  const first = data.name.split(" ")[0];
  const total = data.projects.length;
  const activeCount = data.projects.filter((p) => p.active).length;
  const tier =
    data.productivityScore >= 80
      ? "high"
      : data.productivityScore >= 60
        ? "steady"
        : "developing";
  const trendUp =
    data.kpi.current[data.kpi.current.length - 1] >=
    data.kpi.previous[data.kpi.previous.length - 1];
  const top = [...data.projects].sort((a, b) => b.progress - a.progress)[0];

  const summary = `${first} is a ${tier} performer, averaging ${data.productivityScore}% productivity across ${total} ${total === 1 ? "project" : "projects"}${activeCount ? ` (${activeCount} active)` : ""}. Delivery sits at ${data.avgCompletion}% average completion with ${data.totalTasks} tasks in flight.`;

  const points: string[] = [
    trendUp
      ? "Productivity is trending up over the last 6 months versus the prior period."
      : "Productivity has softened recently — a check-in could surface blockers.",
    `Workload is ${data.totalTasks >= 40 ? "heavy" : data.totalTasks >= 20 ? "balanced" : "light"} at ${data.totalTasks} tasks across ${total} ${total === 1 ? "project" : "projects"}.`,
    top
      ? `Strongest contribution: ${top.name} at ${top.progress}% complete.`
      : "Not currently assigned to a project.",
    tier === "high"
      ? "A consistent top performer — a candidate for stretch work or mentoring."
      : tier === "steady"
        ? "Reliable output — small focus gains could lift them into the top tier."
        : "Ramping up — pairing and clearer scope would accelerate progress.",
  ];

  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-feature-tint text-primary">
          <Sparkles className="size-4" />
        </span>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Employee summary
        </p>
        <Badge className="ml-auto bg-feature-tint text-primary">AI · Beta</Badge>
      </div>

      <p className="mt-3 text-sm leading-relaxed">{summary}</p>

      <ul className="mt-4 space-y-2">
        {points.map((p, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="leading-relaxed">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------- atoms -------------------------------- */

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] font-medium tracking-wide text-muted-foreground/70 uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium" title={value}>
        {value}
      </dd>
    </div>
  );
}

function Legend({
  className,
  label,
  dashed,
}: {
  className: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "h-0.5 w-4 rounded-full",
          className,
          dashed && "opacity-70",
        )}
      />
      {label}
    </span>
  );
}

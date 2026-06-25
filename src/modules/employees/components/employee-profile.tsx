"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Contact,
  FolderKanban,
  Gauge,
  ListChecks,
  MapPin,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
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

export interface ActiveProjectItem {
  id: string;
  name: string;
  key: string;
  progress: number;
  tasks: number;
  teammates: number;
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
  activeProjects: ActiveProjectItem[];
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

const BAR_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function EmployeeProfile({ data }: { data: EmployeeProfileData }) {
  const chartData = data.kpi.months.map((m, i) => ({
    month: m,
    current: data.kpi.current[i],
    previous: data.kpi.previous[i],
  }));

  return (
    <div className="space-y-6">
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
          <Badge className="bg-feature-tint text-primary">{data.jobTitle}</Badge>
        </nav>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: identity + details */}
        <aside className="space-y-6 lg:col-span-4">
          {/* Identity */}
          <div className="flex flex-col items-center rounded-2xl border bg-card p-6 text-center">
            <Avatar className="size-24 ring-4 ring-feature-tint">
              <AvatarImage src={data.avatarUrl} alt={data.name} />
              <AvatarFallback className="text-2xl">
                {initials(data.name)}
              </AvatarFallback>
            </Avatar>
            <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">
              {data.name}
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              {data.empCode}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Badge className="bg-feature-tint text-primary">
                {data.roleName}
              </Badge>
              <Badge className={STATUS_META[data.status]}>{data.status}</Badge>
            </div>
          </div>

          {/* Employee details */}
          <Panel title="Employee details" icon={Contact}>
            <dl className="divide-y text-sm">
              <InfoRow label="Phone" value={data.phone} />
              <InfoRow label="Email" value={data.email} />
              <InfoRow label="Date of birth" value={data.dob} />
              <InfoRow label="Title" value={data.jobTitle} />
              <InfoRow label="Hire date" value={data.hireDate} />
            </dl>
          </Panel>

          {/* Address */}
          <Panel title="Address" icon={MapPin}>
            <dl className="divide-y text-sm">
              <InfoRow label="Country" value={data.country} />
              <InfoRow label="City / State" value={data.cityState} />
              <InfoRow label="Address" value={data.address} />
              <InfoRow label="Postcode" value={data.postcode} />
            </dl>
          </Panel>

          {/* Active projects */}
          <Panel
            title={`Active projects · ${data.activeProjects.length}`}
          >
            {data.activeProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not assigned to any project yet.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {data.activeProjects.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.tasks} tasks · {p.teammates} teammates
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>

        {/* Right: KPIs + charts */}
        <section className="space-y-6 lg:col-span-8">
          {/* Productivity KPIs */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Kpi icon={Gauge} label="Productivity" value={`${data.productivityScore}%`} />
            <Kpi
              icon={FolderKanban}
              label="Active projects"
              value={data.activeProjects.length}
            />
            <Kpi
              icon={TrendingUp}
              label="Avg. completion"
              value={`${data.avgCompletion}%`}
            />
            <Kpi icon={ListChecks} label="Tasks" value={data.totalTasks} />
          </div>

          {/* KPI area chart — dark, palette-coloured surface */}
          <div
            className="relative overflow-hidden rounded-2xl border border-white/15 p-5 text-white shadow-[0_30px_80px_-40px_rgb(0_0_0/0.55)]"
            style={{
              backgroundImage:
                "linear-gradient(160deg, color-mix(in oklab, var(--feature) 88%, #ffffff 12%), var(--feature) 58%, color-mix(in oklab, var(--feature), #000000 24%))",
            }}
          >
            <div className="pointer-events-none absolute -top-20 -right-12 size-56 rounded-full bg-white/10 blur-3xl" />
            <div className="relative mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-heading text-sm font-semibold tracking-wide uppercase">
                  KPI
                </h2>
                <p className="text-xs text-white/70">
                  Avg. productive hours / day
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-white/75">
                <Legend className="bg-white" label="Last 6 months" />
                <Legend
                  className="bg-white/60"
                  label="Previous 6 months"
                  dashed
                />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={chartData}
                margin={{ top: 6, right: 8, bottom: 0, left: -16 }}
              >
                <defs>
                  <linearGradient id="kpi-current" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.38} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="kpi-previous" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgb(255 255 255 / 0.14)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "rgb(255 255 255 / 0.7)" }}
                  dy={6}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={42}
                  tick={{ fontSize: 12, fill: "rgb(255 255 255 / 0.7)" }}
                  tickFormatter={(v) => `${v}h`}
                />
                <Tooltip
                  cursor={{ stroke: "rgb(255 255 255 / 0.3)" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid rgb(255 255 255 / 0.18)",
                    background: "rgb(17 18 23 / 0.92)",
                    color: "#ffffff",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "rgb(255 255 255 / 0.7)" }}
                  formatter={(v: number) => `${v}h`}
                />
                <Area
                  type="monotone"
                  dataKey="previous"
                  name="Previous 6 months"
                  stroke="rgb(255 255 255 / 0.6)"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  fill="url(#kpi-previous)"
                  dot={false}
                  activeDot={false}
                />
                <Area
                  type="monotone"
                  dataKey="current"
                  name="Last 6 months"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  fill="url(#kpi-current)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#ffffff", stroke: "none" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Project completion */}
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="mb-4 font-heading text-sm font-semibold tracking-wide uppercase">
              Project completion
            </h2>
            {data.activeProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No projects to show.
              </p>
            ) : (
              <ul className="space-y-4">
                {data.activeProjects.map((p, i) => (
                  <li key={p.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="rounded bg-accent px-1 font-mono text-[0.65rem] font-semibold text-accent-foreground">
                          {p.key}
                        </span>
                        {p.name}
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {p.progress}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="wp-meter-fill h-full rounded-full"
                        style={{
                          width: `${p.progress}%`,
                          backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* AI insights — overall summary of the employee */}
          <AiInsights data={data} />
        </section>
      </div>
    </div>
  );
}

function AiInsights({ data }: { data: EmployeeProfileData }) {
  const first = data.name.split(" ")[0];
  const tier =
    data.productivityScore >= 80
      ? "high"
      : data.productivityScore >= 60
        ? "steady"
        : "developing";
  const trendUp =
    data.kpi.current[data.kpi.current.length - 1] >=
    data.kpi.previous[data.kpi.previous.length - 1];
  const top = [...data.activeProjects].sort((a, b) => b.progress - a.progress)[0];

  const summary = `${first} is a ${tier} performer, averaging ${data.productivityScore}% productivity across ${data.activeProjects.length} active ${data.activeProjects.length === 1 ? "project" : "projects"}. Delivery sits at ${data.avgCompletion}% average completion with ${data.totalTasks} tasks in flight.`;

  const points: string[] = [
    trendUp
      ? "Productivity is trending up over the last 6 months versus the prior period."
      : "Productivity has softened recently — a check-in could surface blockers.",
    `Workload is ${data.totalTasks >= 40 ? "heavy" : data.totalTasks >= 20 ? "balanced" : "light"} at ${data.totalTasks} tasks across ${data.activeProjects.length} ${data.activeProjects.length === 1 ? "project" : "projects"}.`,
    top
      ? `Strongest contribution: ${top.name} at ${top.progress}% complete.`
      : "Not currently assigned to an active project.",
    tier === "high"
      ? "A consistent top performer — a candidate for stretch work or mentoring."
      : tier === "steady"
        ? "Reliable output — small focus gains could lift them into the top tier."
        : "Ramping up — pairing and clearer scope would accelerate progress.",
  ];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 p-5 text-white shadow-[0_24px_60px_-40px_rgb(0_0_0/0.5)]"
      style={{
        backgroundImage:
          "linear-gradient(150deg, color-mix(in oklab, var(--feature) 88%, #ffffff 12%), var(--feature) 60%, color-mix(in oklab, var(--feature), #000000 22%))",
      }}
    >
      <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-white/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-white/15">
            <Sparkles className="size-4" />
          </span>
          <h2 className="font-heading text-sm font-semibold tracking-wide uppercase">
            AI insights
          </h2>
          <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[0.65rem] font-medium text-white/80">
            Beta
          </span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-white/90">{summary}</p>

        <ul className="mt-4 space-y-2">
          {points.map((p, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-white/85">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/70" />
              <span className="leading-relaxed">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------- atoms -------------------------------- */

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        {Icon ? (
          <span className="flex size-7 items-center justify-center rounded-lg bg-feature-tint text-primary">
            <Icon className="size-4" />
          </span>
        ) : null}
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium break-words">{value}</dd>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="flex size-7 items-center justify-center rounded-full bg-feature-tint text-primary">
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
        {value}
      </p>
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

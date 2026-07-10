"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileText,
  FolderKanban,
  MapPin,
  Sheet,
  BarChart2,
  Pencil,
} from "lucide-react";
import { AiInsight } from "@/components/shared/ai-insight";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TablePagination } from "@/components/shared/table-pagination";
import { initials } from "@/lib/format";
import { downloadBlob } from "@/lib/download";
import { usePageTitle } from "@/stores/page-header.store";
import { useEmployeesStore } from "@/stores/employees.store";
import { usePermissions } from "@/hooks/use-permissions";
import { DEPARTMENTS, TEAMS_BY_DEPT } from "@/lib/mock-org";
import { TeamSelect } from "./team-select";
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

/** Safe filename stem from an employee code (e.g. "#EMP357148" → "EMP357148"). */
const fileCode = (code: string) => code.replace(/[^\w-]/g, "") || "employee";

function exportEmployeeCsv(d: EmployeeProfileData) {
  const activeCount = d.projects.filter((p) => p.active).length;
  const rows: (string | number)[][] = [
    ["Field", "Value"],
    ["Employee", d.name],
    ["Employee ID", d.empCode],
    ["Role", d.roleName],
    ["Title", d.jobTitle],
    ["Department", d.department],
    ["Team", d.team],
    ["Status", d.status],
    ["Email", d.email],
    ["Phone", d.phone],
    ["Date of birth", d.dob],
    ["Hire date", d.hireDate],
    ["Address", `${d.address}, ${d.cityState}, ${d.country} ${d.postcode}`],
    ["Productivity %", d.productivityScore],
    ["Avg. completion %", d.avgCompletion],
    ["Total tasks", d.totalTasks],
    ["Projects", d.projects.length],
    ["Active projects", activeCount],
    [],
    ["Project", "Key", "Progress %", "Tasks", "Teammates", "Active"],
    ...d.projects.map((p) => [
      p.name, p.key, p.progress, p.tasks, p.teammates, p.active ? "Yes" : "No",
    ]),
  ];
  downloadBlob(
    new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8;" }),
    `${fileCode(d.empCode)}-report.csv`,
  );
  toast.success("Report exported", { description: `${fileCode(d.empCode)}-report.csv` });
}

function exportEmployeePdf(d: EmployeeProfileData) {
  const activeCount = d.projects.filter((p) => p.active).length;
  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(18);
  doc.text(d.name, 14, y);
  doc.setFontSize(10);
  doc.setTextColor(120);
  y += 6;
  doc.text(`${d.jobTitle} · ${d.department} · ${d.empCode}`, 14, y);

  const section = (title: string) => {
    y += 10;
    doc.setTextColor(20);
    doc.setFontSize(13);
    doc.text(title, 14, y);
    doc.setDrawColor(210);
    doc.line(14, y + 2, 196, y + 2);
    y += 8;
    doc.setFontSize(10);
  };
  const kv = (k: string, v: string) => {
    doc.setTextColor(120);
    doc.text(k, 14, y);
    doc.setTextColor(20);
    doc.text(v, 60, y);
    y += 6;
  };

  section("Profile");
  kv("Role", d.roleName);
  kv("Status", d.status);
  kv("Email", d.email);
  kv("Phone", d.phone);
  kv("Date of birth", d.dob);
  kv("Hire date", d.hireDate);
  kv("Address", `${d.address}, ${d.cityState}, ${d.country} ${d.postcode}`);

  section("Performance");
  kv("Productivity", `${d.productivityScore}%`);
  kv("Avg. completion", `${d.avgCompletion}%`);
  kv("Total tasks", String(d.totalTasks));
  kv("Projects", `${d.projects.length} (${activeCount} active)`);

  section("Projects");
  if (d.projects.length === 0) {
    doc.text("No projects.", 14, y);
  } else {
    for (const p of d.projects) {
      doc.setTextColor(20);
      doc.text(`${p.key}  ${p.name}${p.active ? "  (active)" : ""}`, 14, y);
      doc.text(`${p.progress}%`, 196, y, { align: "right" });
      y += 6;
      if (y > 282) {
        doc.addPage();
        y = 18;
      }
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("WorkPulse · employee report", 14, 292);
  doc.save(`${fileCode(d.empCode)}-report.pdf`);
  toast.success("Report exported", { description: `${fileCode(d.empCode)}-report.pdf` });
}

/** Move a member to a different department/team (persisted via the store). */
function ReassignDialog({
  open,
  onOpenChange,
  employeeId,
  name,
  department,
  team,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employeeId: string;
  name: string;
  department: string;
  team: string;
}) {
  const reassignEmployee = useEmployeesStore((s) => s.reassignEmployee);
  const [dept, setDept] = useState(department);
  const [teamDraft, setTeamDraft] = useState(team);

  // Re-seed the drafts to the current values each time the dialog opens.
  useEffect(() => {
    if (open) {
      setDept(department);
      setTeamDraft(team);
    }
  }, [open, department, team]);

  const teamsForDept = dept ? (TEAMS_BY_DEPT[dept] ?? []) : [];

  function save() {
    const d = dept.trim();
    const t = teamDraft.trim();
    if (!d || !t) {
      toast.error("Pick a department and a team");
      return;
    }
    reassignEmployee(employeeId, d, t);
    toast.success("Member moved", { description: `${name} → ${d} · ${t}` });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign {name}</DialogTitle>
          <DialogDescription>
            Change this employee&apos;s department and team.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select
              value={dept}
              onValueChange={(v) => {
                setDept(v as string);
                setTeamDraft(""); // reset team to match the new department
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Team</Label>
            <TeamSelect
              teams={teamsForDept}
              value={teamDraft}
              onChange={setTeamDraft}
              disabled={!dept}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeProfile({ data }: { data: EmployeeProfileData }) {
  const router = useRouter();
  const { can } = usePermissions();
  const canManage = can("employees:manage");
  const canViewLocations = can("locations:view");

  // Apply any reassignment override on top of the seed-built profile data.
  const override = useEmployeesStore((s) => s.assignments[data.id]);
  const department = override?.department ?? data.department;
  const team = override?.team ?? data.team;
  const [reassignOpen, setReassignOpen] = useState(false);

  // Surface the employee's name + role in the top navbar for this detail route.
  usePageTitle(data.name, `${data.jobTitle} · ${department}`);

  const chartData = data.kpi.months.map((m, i) => ({
    month: m,
    current: data.kpi.current[i],
    previous: data.kpi.previous[i],
  }));

  // Projects list paginates so a heavily-staffed employee doesn't run a wall of
  // bars down the card.
  const PROJECTS_PER_PAGE = 5;
  const [projectPage, setProjectPage] = useState(0);
  const projectPageCount = Math.max(
    1,
    Math.ceil(data.projects.length / PROJECTS_PER_PAGE),
  );
  const safeProjectPage = Math.min(projectPage, projectPageCount - 1);
  const pagedProjects = data.projects.slice(
    safeProjectPage * PROJECTS_PER_PAGE,
    safeProjectPage * PROJECTS_PER_PAGE + PROJECTS_PER_PAGE,
  );

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All employees
        </Link>
        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
            <Link href="/employees" className="transition-colors hover:text-foreground">Employees</Link>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-medium text-foreground">{data.name}</span>
          </nav>
          {canViewLocations ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/insights/locations?emp=${data.id}`)}
              title="View live location"
            >
              <MapPin className="size-4" /> Location
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Download className="size-4" /> Download
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportEmployeePdf(data)}>
                <FileText className="size-4" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportEmployeeCsv(data)}>
                <Sheet className="size-4" /> CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {canManage ? (
        <ReassignDialog
          open={reassignOpen}
          onOpenChange={setReassignOpen}
          employeeId={data.id}
          name={data.name}
          department={department}
          team={team}
        />
      ) : null}

      {/* 2-column layout on lg+: left = identity + projects, right = stats + chart + AI */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-4">
          {/* Employee — identity, contact & address in ONE card */}
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center">
              <Avatar className="size-16 shrink-0 ring-4 ring-feature-tint">
                <AvatarImage src={data.avatarUrl} alt={data.name} />
                <AvatarFallback className="text-lg">
                  {initials(data.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 className="font-display text-xl font-semibold tracking-tight">
                    {data.name}
                  </h1>
                  <span className="font-mono text-xs text-muted-foreground">
                    {data.empCode}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {data.jobTitle} · {department}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge className="bg-feature-tint text-primary">
                    {data.roleName}
                  </Badge>
                  <Badge className={STATUS_META[data.status]}>{data.status}</Badge>
                </div>
              </div>
              {canManage ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 self-start sm:self-center"
                  onClick={() => setReassignOpen(true)}
                >
                  <Pencil className="size-4" /> Reassign
                </Button>
              ) : null}
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5">
              <Detail label="Department" value={department} />
              <Detail label="Team" value={team} />
              <Detail label="Phone" value={data.phone} />
              <Detail label="Email" value={data.email} />
              <Detail label="Hire date" value={data.hireDate} />
              <Detail label="City / State" value={data.cityState} />
              <Detail label="Country" value={data.country} />
            </dl>
          </div>

          {/* Projects — all projects, single accent bar, Active badge when active */}
          <div className="flex-1 rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
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
              <>
                <ul className="space-y-4">
                {pagedProjects.map((p) => (
                  <li key={p.id} className="space-y-1.5">
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
                {data.projects.length > PROJECTS_PER_PAGE ? (
                  <TablePagination
                    page={safeProjectPage}
                    pageCount={projectPageCount}
                    total={data.projects.length}
                    pageSize={PROJECTS_PER_PAGE}
                    onPageChange={setProjectPage}
                    className="mt-4"
                  />
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col gap-4">
          {/* AI summary first */}
          <EmployeeSummaryInsight data={data} />

          {/* Stat cards row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Productivity
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                {data.productivityScore}%
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">overall score</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Avg. completion
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                {data.avgCompletion}%
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">task delivery rate</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Total tasks
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                {data.totalTasks}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">across all projects</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Active projects
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                {data.projects.filter((p) => p.active).length}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                of {data.projects.length} total
              </p>
            </div>
          </div>

          {/* KPI chart — capped so it never balloons to match a taller left column */}
          <div className="flex max-h-[360px] flex-1 flex-col rounded-xl border bg-card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-feature-tint text-primary">
                  <BarChart2 className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Productivity
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
            <ResponsiveContainer width="100%" height="100%" minHeight={220} className="flex-1">
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
        </div>
      </div>
    </div>
  );
}

function EmployeeSummaryInsight({ data }: { data: EmployeeProfileData }) {
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

  const title = `${first} is a ${tier} performer, averaging ${data.productivityScore}% productivity across ${total} ${total === 1 ? "project" : "projects"}${activeCount ? ` (${activeCount} active)` : ""}.`;

  const detail = `Delivery sits at ${data.avgCompletion}% average completion with ${data.totalTasks} tasks across all projects.`;

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
    <AiInsight
      label="Employee summary"
      title={title}
      detail={detail}
      points={points}
      basis={`${data.totalTasks} tasks · ${total} projects · 6-month KPI trend`}
    />
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
      {dashed ? (
        // Dashed swatch — mirrors the chart's dashed "previous period" stroke.
        <span className="inline-flex w-4 items-center justify-between">
          <span className={cn("h-0.5 w-1 rounded-full", className)} />
          <span className={cn("h-0.5 w-1 rounded-full", className)} />
          <span className={cn("h-0.5 w-1 rounded-full", className)} />
        </span>
      ) : (
        <span className={cn("h-0.5 w-4 rounded-full", className)} />
      )}
      {label}
    </span>
  );
}

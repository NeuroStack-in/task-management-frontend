"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FileBarChart,
  FileText,
  FolderKanban,
  Lock,
  Search,
  Sheet,
  Timer,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { usePermissions } from "@/hooks/use-permissions";
import {
  EMPLOYEE_TIME,
  PROJECT_HOURS,
  REPORTS,
  REPORT_CATEGORY_LABEL,
  type EmployeeTime,
  type ReportCategory,
  type ReportDef,
} from "@/lib/mock-insights";

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;
const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCsv(report: ReportDef) {
  const csv = Papa.unparse({ fields: report.columns, data: report.rows });
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    `${report.id}-report.csv`,
  );
  toast.success("CSV exported", { description: `${report.name}.csv` });
}

function exportPdf(report: ReportDef) {
  const doc = new jsPDF({ orientation: "landscape" });
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usable = pageW - margin * 2;
  const colW = usable / report.columns.length;

  doc.setFontSize(16);
  doc.text(report.name, margin, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${report.period} · WorkPulse`, margin, 25);

  let y = 36;
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  report.columns.forEach((c, i) => doc.text(String(c), margin + i * colW, y));
  doc.setDrawColor(210);
  doc.line(margin, y + 2, margin + usable, y + 2);
  doc.setFont("helvetica", "normal");
  y += 9;

  for (const row of report.rows) {
    row.forEach((cell, i) => doc.text(String(cell), margin + i * colW, y));
    y += 8;
    if (y > pageH - 14) {
      doc.addPage();
      y = 20;
    }
  }

  doc.save(`${report.id}-report.pdf`);
  toast.success("PDF exported", { description: `${report.name}.pdf` });
}

/** Build a one-row ReportDef for a single employee, reusing the export pipeline. */
function employeeReport(e: EmployeeTime): ReportDef {
  return {
    id: `employee-${e.id}`,
    name: `${e.name} — Weekly Report`,
    description: `Individual report for ${e.name}`,
    category: "workforce",
    period: "This week",
    columns: [
      "Employee",
      "Department",
      "Productivity %",
      "Tracked hrs",
      "Idle hrs",
      "Billable %",
      "Utilization %",
    ],
    rows: [
      [
        e.name,
        e.department,
        e.productivity,
        e.tracked,
        e.idle,
        e.billable,
        e.utilization,
      ],
    ],
  };
}

type Filter = "all" | ReportCategory;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All reports" },
  { key: "workforce", label: REPORT_CATEGORY_LABEL.workforce },
  { key: "time", label: REPORT_CATEGORY_LABEL.time },
  { key: "projects", label: REPORT_CATEGORY_LABEL.projects },
];

export function ReportsTab() {
  const { can } = usePermissions();
  const canExport = can("reports:export");
  const [filter, setFilter] = useState<Filter>("all");

  const reports = useMemo(
    () =>
      filter === "all" ? REPORTS : REPORTS.filter((r) => r.category === filter),
    [filter],
  );

  // Scalable aggregations: bounded number of marks regardless of dataset size.
  const empCount = EMPLOYEE_TIME.length;
  const projCount = PROJECT_HOURS.length;

  // Top N projects by hours; the long tail is summarized in the subtitle so the
  // top bars stay comparable (an aggregated "Other" bar would dwarf them).
  const TOP_PROJECTS = 12;
  const { topProjects, tail } = useMemo(() => {
    const sorted = [...PROJECT_HOURS].sort((a, b) => b.hours - a.hours);
    return {
      topProjects: sorted.slice(0, TOP_PROJECTS).map((p) => ({
        name: p.project,
        hours: p.hours,
        fill: p.onTrack ? "var(--chart-1)" : "var(--warning)",
      })),
      tail: sorted.slice(TOP_PROJECTS).reduce(
        (acc, p) => ({ count: acc.count + 1, hours: acc.hours + p.hours }),
        { count: 0, hours: 0 },
      ),
    };
  }, []);

  // Tracked vs idle aggregated by department — stays bounded as headcount grows.
  const byDept = useMemo(() => {
    const m = new Map<string, { department: string; tracked: number; idle: number }>();
    for (const e of EMPLOYEE_TIME) {
      const d = m.get(e.department) ?? { department: e.department, tracked: 0, idle: 0 };
      d.tracked += e.tracked;
      d.idle += e.idle;
      m.set(e.department, d);
    }
    return [...m.values()].sort((a, b) => b.tracked - a.tracked);
  }, []);

  // Utilization as a distribution (employees per band) instead of one bar each.
  const utilBands = useMemo(() => {
    const bands = [
      { band: "<50%", min: 0, max: 50, fill: "var(--warning)" },
      { band: "50–69%", min: 50, max: 70, fill: "var(--chart-4)" },
      { band: "70–89%", min: 70, max: 90, fill: "var(--chart-1)" },
      { band: "90%+", min: 90, max: 101, fill: "var(--success)" },
    ];
    return bands.map((b) => ({
      band: b.band,
      count: EMPLOYEE_TIME.filter((e) => e.utilization >= b.min && e.utilization < b.max).length,
      fill: b.fill,
    }));
  }, []);

  return (
    <div className="space-y-8">
      {/* Analytics: aggregated so it scales to many projects / employees */}
      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Aggregated across {projCount} projects and {empCount} employees.
          </p>
        </div>

        <ChartCard
          icon={FolderKanban}
          title="Hours by project"
          description={`Top ${TOP_PROJECTS} of ${projCount} by hours · ${tail.count} more totaling ${tail.hours.toLocaleString()}h · amber = at risk`}
          height={topProjects.length * 26 + 24}
        >
          <BarChart
            layout="vertical"
            data={topProjects}
            margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
          >
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <YAxis
              type="category"
              dataKey="name"
              width={118}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="hours" name="Hours" radius={[0, 6, 6, 0]}>
              {topProjects.map((p) => (
                <Cell key={p.name} fill={p.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <ChartCard
            icon={Timer}
            title="Tracked vs idle by department"
            description="Weekly hours rolled up per department"
          >
            <BarChart data={byDept} margin={{ left: -18, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="department"
                tickLine={false}
                axisLine={false}
                tick={{ ...AXIS_TICK, fontSize: 10 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={54}
              />
              <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="tracked" stackId="t" name="Tracked" fill="var(--chart-1)" />
              <Bar dataKey="idle" stackId="t" name="Idle" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard
            icon={Timer}
            title="Utilization distribution"
            description={`${empCount} employees grouped by utilization band`}
          >
            <BarChart data={utilBands} margin={{ left: -18, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="band" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="count" name="Employees" radius={[6, 6, 0, 0]}>
                {utilBands.map((b) => (
                  <Cell key={b.band} fill={b.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartCard>
        </div>
      </section>

      {/* Report templates catalog */}
      <section className="space-y-4">
      {/* Toolbar: summary + category filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{REPORTS.length}</span>{" "}
          report templates · export-ready as CSV or PDF
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {!canExport ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" />
          You can view reports, but exporting requires the{" "}
          <span className="font-medium text-foreground">Export Reports</span>{" "}
          permission.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-feature-tint text-primary">
                  <FileBarChart className="size-5" />
                </span>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline">
                    {REPORT_CATEGORY_LABEL[report.category]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {report.period}
                  </span>
                </div>
              </div>
              <CardTitle className="mt-3">{report.name}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-4">
              {/* Mini preview */}
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {report.columns.slice(0, 3).map((c) => (
                        <TableHead key={c} className="h-8 text-xs">
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.slice(0, 3).map((row, ri) => (
                      <TableRow key={ri}>
                        {row.slice(0, 3).map((cell, ci) => (
                          <TableCell key={ci} className="py-1.5 text-xs">
                            {String(cell)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                {report.rows.length} rows · {report.columns.length} columns
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!canExport}
                  onClick={() => exportCsv(report)}
                >
                  <Sheet className="size-4" /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!canExport}
                  onClick={() => exportPdf(report)}
                >
                  <FileText className="size-4" /> PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </section>

      {/* Individual employee reports */}
      <IndividualEmployeeReports canExport={canExport} />
    </div>
  );
}

function IndividualEmployeeReports({ canExport }: { canExport: boolean }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(EMPLOYEE_TIME[0]?.id);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q === ""
      ? EMPLOYEE_TIME
      : EMPLOYEE_TIME.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            e.department.toLowerCase().includes(q),
        );
  }, [query]);

  const selected =
    EMPLOYEE_TIME.find((e) => e.id === selectedId) ?? matches[0] ?? null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">
          Individual employee reports
        </h2>
        <p className="text-sm text-muted-foreground">
          Search anyone in the workforce and export their personal report.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Picker */}
        <Card className="flex flex-col">
          <CardContent className="space-y-3 pt-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employee…"
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-[280px] pr-2">
              <div className="space-y-1">
                {matches.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
                      selected?.id === e.id
                        ? "bg-primary/10"
                        : "hover:bg-muted",
                    )}
                  >
                    <Avatar className="size-7">
                      <AvatarImage src={e.avatarUrl} alt={e.name} />
                      <AvatarFallback className="text-[10px]">
                        {initials(e.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.department}
                      </p>
                    </div>
                  </button>
                ))}
                {matches.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No employees match “{query}”.
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Selected employee report */}
        {selected ? (
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  <AvatarImage src={selected.avatarUrl} alt={selected.name} />
                  <AvatarFallback>{initials(selected.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserRound className="size-4 text-muted-foreground" />
                    {selected.name}
                  </CardTitle>
                  <CardDescription>
                    {selected.jobTitle} · {selected.department} · this week
                  </CardDescription>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canExport}
                  onClick={() => exportCsv(employeeReport(selected))}
                >
                  <Sheet className="size-4" /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canExport}
                  onClick={() => exportPdf(employeeReport(selected))}
                >
                  <FileText className="size-4" /> PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Kpi label="Productivity" value={`${selected.productivity}%`} tone={tone(selected.productivity)} />
                <Kpi label="Utilization" value={`${selected.utilization}%`} tone={tone(selected.utilization)} />
                <Kpi label="Billable" value={`${selected.billable}%`} />
                <Kpi label="Tracked" value={`${selected.tracked}h`} />
                <Kpi label="Idle" value={`${selected.idle}h`} />
                <Kpi label="Capacity" value={`${selected.capacity}h`} />
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}

const tone = (pct: number): string | undefined =>
  pct >= 75 ? "text-success" : pct >= 50 ? undefined : "text-destructive";

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-semibold tabular-nums", tone)}>
        {value}
      </p>
    </div>
  );
}

function ChartCard({
  icon: Icon,
  title,
  description,
  height = 260,
  children,
}: {
  icon: typeof Timer;
  title: string;
  description: string;
  height?: number;
  children: React.ReactElement;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-feature-tint text-primary">
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

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
  Download,
  FileBarChart,
  FileText,
  FolderKanban,
  Lock,
  Sheet,
  Timer,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { AiReportCard } from "./ai-report-card";
import {
  EMPLOYEE_TIME,
  PROJECT_HOURS,
  REPORTS,
  REPORT_CATEGORY_LABEL,
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

/** One combined PDF containing every report — the "overall reports" export. */
function exportAllPdf(reports: ReportDef[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usable = pageW - margin * 2;

  // Cover page
  doc.setFontSize(24);
  doc.text("WorkPulse", margin, 28);
  doc.setFontSize(14);
  doc.setTextColor(80);
  doc.text("Reports Pack", margin, 38);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${reports.length} reports · generated from WorkPulse`, margin, 48);
  reports.forEach((r, i) =>
    doc.text(`${i + 1}.  ${r.name}  —  ${r.period}`, margin, 62 + i * 7),
  );

  for (const report of reports) {
    doc.addPage();
    const colW = usable / report.columns.length;
    doc.setFontSize(16);
    doc.setTextColor(20);
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
  }

  doc.save("workpulse-reports.pdf");
  toast.success("All reports exported", {
    description: `${reports.length} reports · workpulse-reports.pdf`,
  });
}


type Filter = "all" | ReportCategory;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All reports" },
  { key: "workforce", label: REPORT_CATEGORY_LABEL.workforce },
  { key: "time", label: REPORT_CATEGORY_LABEL.time },
  { key: "attendance", label: REPORT_CATEGORY_LABEL.attendance },
  { key: "activity", label: REPORT_CATEGORY_LABEL.activity },
  { key: "monitoring", label: REPORT_CATEGORY_LABEL.monitoring },
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
      <AiReportCard
        title="AI reporting summary"
        summary={`Across ${empCount} employees and ${projCount} projects, Engineering and Product lead utilization this week. Two projects are flagged at risk and a small group is trending toward over-utilization — details in the charts below.`}
        signals={[
          { label: "Utilization", value: "78%", tone: "flat" },
          { label: "At-risk projects", value: "2", tone: "down" },
          { label: "Top dept", value: "Engineering", tone: "up" },
        ]}
      />

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
      {/* Toolbar: summary + export-all + category filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{REPORTS.length}</span>{" "}
            report templates · export-ready as CSV or PDF
          </p>
          <Button
            size="sm"
            disabled={!canExport}
            onClick={() => exportAllPdf(REPORTS)}
          >
            <Download className="size-4" /> Export all
          </Button>
        </div>
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

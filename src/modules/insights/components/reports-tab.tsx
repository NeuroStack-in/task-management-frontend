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
import { FileBarChart, FileText, FolderKanban, Lock, Sheet, Timer } from "lucide-react";
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

  return (
    <div className="space-y-8">
      {/* Analytics: project + time graphs */}
      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Project workload and time utilization at a glance.
          </p>
        </div>

        <ChartCard
          icon={FolderKanban}
          title="Hours by project"
          description="Total hours logged per project this month · amber = at risk"
        >
          <BarChart data={PROJECT_HOURS} margin={{ left: -14, right: 8, top: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="project" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="hours" name="Hours" radius={[6, 6, 0, 0]}>
              {PROJECT_HOURS.map((p) => (
                <Cell
                  key={p.project}
                  fill={p.onTrack ? "var(--chart-1)" : "var(--warning)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <ChartCard
            icon={Timer}
            title="Tracked vs idle hours"
            description="Weekly hours per employee, split by activity"
          >
            <BarChart data={EMPLOYEE_TIME} margin={{ left: -18, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="first" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} />
              <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="tracked" stackId="t" name="Tracked" fill="var(--chart-1)" />
              <Bar dataKey="idle" stackId="t" name="Idle" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard
            icon={Timer}
            title="Utilization"
            description="Billable hours as a share of weekly capacity"
          >
            <BarChart data={EMPLOYEE_TIME} margin={{ left: -18, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="first" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={AXIS_TICK} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="utilization" name="Utilization %" radius={[6, 6, 0, 0]}>
                {EMPLOYEE_TIME.map((e) => (
                  <Cell
                    key={e.name}
                    fill={
                      e.utilization >= 80
                        ? "var(--success)"
                        : e.utilization >= 60
                          ? "var(--chart-1)"
                          : "var(--warning)"
                    }
                  />
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
    </div>
  );
}

function ChartCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Timer;
  title: string;
  description: string;
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
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

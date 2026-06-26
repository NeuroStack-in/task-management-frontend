"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import { Download, FileBarChart, FileText, Lock, Sheet } from "lucide-react";
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

  // Catalog summary counts.
  const empCount = EMPLOYEE_TIME.length;
  const projCount = PROJECT_HOURS.length;


  return (
    <div className="space-y-8">
      <AiReportCard
        title="AI reporting summary"
        summary={`Across ${empCount} employees and ${projCount} projects, Engineering and Product lead utilization this week. Two projects are flagged at risk and a small group is trending toward over-utilization — export any report below for the detail.`}
        signals={[
          { label: "Utilization", value: "78%", tone: "flat" },
          { label: "At-risk projects", value: "2", tone: "down" },
          { label: "Top dept", value: "Engineering", tone: "up" },
        ]}
      />


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
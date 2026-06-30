"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import {
  Activity,
  CalendarCheck,
  ChevronDown,
  Clock,
  Download,
  FileText,
  FolderKanban,
  Lock,
  MonitorSmartphone,
  Sheet,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  toast.success(`${reports.length} report${reports.length > 1 ? "s" : ""} exported`, {
    description: "workpulse-reports.pdf",
  });
}

/** One CSV file with each selected report as a labelled section. */
function exportSelectedCsv(reports: ReportDef[]) {
  if (reports.length === 1) return exportCsv(reports[0]);
  const csv = reports
    .map((r) => {
      const body = Papa.unparse({ fields: r.columns, data: r.rows });
      return `# ${r.name} — ${r.period}\n${body}`;
    })
    .join("\n\n");
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    "workpulse-reports.csv",
  );
  toast.success(`${reports.length} reports exported`, {
    description: "workpulse-reports.csv",
  });
}

/** Each report category gets its own icon so cards are scannable at a glance. */
const CATEGORY_ICON: Record<ReportCategory, LucideIcon> = {
  workforce: Users,
  time: Clock,
  attendance: CalendarCheck,
  activity: Activity,
  monitoring: MonitorSmartphone,
  projects: FolderKanban,
};

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
  const [preview, setPreview] = useState<ReportDef | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reports = useMemo(
    () =>
      filter === "all" ? REPORTS : REPORTS.filter((r) => r.category === filter),
    [filter],
  );

  const selectedReports = useMemo(
    () => REPORTS.filter((r) => selected.has(r.id)),
    [selected],
  );

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // "Select all" acts on the currently filtered set.
  const allFilteredSelected =
    reports.length > 0 && reports.every((r) => selected.has(r.id));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) reports.forEach((r) => next.delete(r.id));
      else reports.forEach((r) => next.add(r.id));
      return next;
    });

  const empCount = EMPLOYEE_TIME.length;
  const projCount = PROJECT_HOURS.length;

  return (
    <div className="space-y-6">
      <AiReportCard
        title="AI reporting summary"
        summary={`Across ${empCount} employees and ${projCount} projects, Engineering and Product lead utilization this week. Two projects are flagged at risk and a small group is trending toward over-utilization — open any report below for the detail.`}
        metrics={[
          { label: "Utilization", value: "78%" },
          { label: "At-risk projects", value: 2 },
          { label: "Top dept", value: "Engineering" },
        ]}
      />

      {/* Section header */}
      <h2 className="font-heading text-sm font-semibold tracking-wide uppercase">
        Reports
      </h2>

      {/* Toolbar: select-all + count (left) · category filter (right) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <Checkbox
              checked={allFilteredSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all reports"
            />
            Select all
          </label>
          <span>
            <span className="font-medium text-foreground">{reports.length}</span> of{" "}
            {REPORTS.length} reports
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="h-9 w-48" aria-label="Filter by category">
              <SelectValue>
                {(v) =>
                  FILTERS.find((f) => f.key === v)?.label ?? "All reports"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              {FILTERS.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bulk download — sits next to the filter */}
          {selected.size > 0 ? (
            <>
              <span className="text-sm text-muted-foreground">
                {selected.size} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button disabled={!canExport} className="gap-1.5" />}
                >
                  <Download className="size-4" /> Download selected
                  <ChevronDown className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  <DropdownMenuItem onClick={() => exportAllPdf(selectedReports)}>
                    <FileText className="size-4" /> Combined PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportSelectedCsv(selectedReports)}>
                    <Sheet className="size-4" /> Combined CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button disabled={!canExport} onClick={() => exportAllPdf(REPORTS)}>
              <Download className="size-4" /> Download all
            </Button>
          )}
        </div>
      </div>

      {!canExport ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" />
          You can view and preview reports, but exporting requires the{" "}
          <span className="font-medium text-foreground">Export Reports</span>{" "}
          permission.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            canExport={canExport}
            selected={selected.has(report.id)}
            onToggleSelect={() => toggleSelect(report.id)}
            onPreview={() => setPreview(report)}
          />
        ))}
      </div>

      <ReportPreviewDialog
        report={preview}
        canExport={canExport}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

/* ------------------------------- report card ------------------------------- */

function ReportCard({
  report,
  canExport,
  selected,
  onToggleSelect,
  onPreview,
}: {
  report: ReportDef;
  canExport: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
}) {
  const Icon = CATEGORY_ICON[report.category];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPreview();
        }
      }}
      className={cn(
        "group flex cursor-pointer flex-col rounded-[1.4rem] p-5 shadow-soft transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        selected
          ? "bg-primary/[0.03] ring-2 ring-primary"
          : "bg-card ring-1 ring-transparent",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {/* Wrapper isolates the checkbox so selecting never triggers the
              card's preview-on-click. */}
          <span
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              aria-label={`Select ${report.name}`}
            />
          </span>
          <span className="flex size-10 items-center justify-center rounded-xl bg-feature-tint text-primary">
            <Icon className="size-5" />
          </span>
        </div>
        <ExportMenu report={report} canExport={canExport} />
      </div>

      <h3 className="mt-3 font-heading text-base font-semibold">{report.name}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {REPORT_CATEGORY_LABEL[report.category]} · {report.period}
      </p>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
        {report.description}
      </p>

      {/* Mini preview */}
      <div className="mt-4 overflow-hidden rounded-xl border">
        <table className="w-full caption-bottom text-sm">
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
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {report.rows.length} rows · {report.columns.length} columns
        </span>
        <span className="font-medium text-primary transition-transform group-hover:translate-x-0.5">
          View report →
        </span>
      </div>
    </div>
  );
}

function ExportMenu({
  report,
  canExport,
}: {
  report: ReportDef;
  canExport: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            disabled={!canExport}
            aria-label={`Download ${report.name}`}
            title="Download"
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <Download className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        <DropdownMenuItem
          className="whitespace-nowrap"
          onClick={() => exportCsv(report)}
        >
          <Sheet className="size-4" /> Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          className="whitespace-nowrap"
          onClick={() => exportPdf(report)}
        >
          <FileText className="size-4" /> Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------------------------- full report preview --------------------------- */

function ReportPreviewDialog({
  report,
  canExport,
  onClose,
}: {
  report: ReportDef | null;
  canExport: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!report} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        {report ? (
          <>
            <DialogHeader>
              <DialogTitle>{report.name}</DialogTitle>
              <DialogDescription>
                {REPORT_CATEGORY_LABEL[report.category]} · {report.period} ·{" "}
                {report.rows.length} rows
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
              <table className="w-full caption-bottom text-sm">
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    {report.columns.map((c) => (
                      <TableHead key={c} className="whitespace-nowrap">
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, ri) => (
                    <TableRow key={ri}>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="whitespace-nowrap">
                          {String(cell)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                disabled={!canExport}
                onClick={() => exportCsv(report)}
              >
                <Sheet className="size-4" /> CSV
              </Button>
              <Button disabled={!canExport} onClick={() => exportPdf(report)}>
                <FileText className="size-4" /> PDF
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

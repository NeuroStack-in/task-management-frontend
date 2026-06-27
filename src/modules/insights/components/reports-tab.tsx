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
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { AiInsight } from "@/components/shared/ai-insight";
import { Sparkline } from "@/components/shared/sparkline";
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

  const atRisk = PROJECT_HOURS.filter((p) => !p.onTrack).length;
  const exportAllLabel =
    filter === "all" ? "Download all" : `Download ${reports.length}`;

  return (
    <div className="space-y-5">
      <AiInsight
        title={`${atRisk} projects flagged at risk this week`}
        detail="Open any report below for the underlying detail."
        points={[`${empCount} employees · ${projCount} projects tracked`]}
        basis={`${REPORTS.length} report templates across ${empCount} employees`}
      />

      {/* Section header: title + bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-semibold tracking-wide uppercase">
          Report templates
        </h2>
        <div className="flex items-center gap-2">
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
            // "Export all" respects the active category filter.
            <Button disabled={!canExport} onClick={() => exportAllPdf(reports)}>
              <Download className="size-4" /> {exportAllLabel}
            </Button>
          )}
        </div>
      </div>

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
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-md border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                filter === f.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {!canExport ? (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
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

/**
 * A small shape-of-the-data sparkline: the first numeric column, sampled across
 * the rows. Replaces the old decorative 3×3 mini-table (which showed the same
 * three cells for every card) with an honest signal of the data's distribution.
 */
function reportSpark(report: ReportDef): number[] | null {
  const col = report.columns.findIndex((_, ci) =>
    report.rows.length > 0 ? typeof report.rows[0][ci] === "number" : false,
  );
  if (col === -1) return null;
  const values = report.rows.map((r) => Number(r[col]) || 0);
  if (values.length < 2) return null;
  // Down-sample to at most 16 points so the line stays readable.
  const step = Math.max(1, Math.ceil(values.length / 16));
  const sampled = values.filter((_, i) => i % step === 0);
  return sampled.length >= 2 ? sampled : values;
}

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
  const spark = reportSpark(report);
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border bg-card transition-colors",
        selected ? "border-primary ring-1 ring-primary" : "hover:border-primary/30",
      )}
    >
      {/* Preview target — opening the card. Distinct from the Export control. */}
      <button
        type="button"
        onClick={onPreview}
        className="group flex flex-1 flex-col items-start p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <div className="flex w-full items-start gap-2.5">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${report.name}`}
          />
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-feature-tint text-primary">
            <Icon className="size-5" />
          </span>
        </div>

        <h3 className="mt-3 font-heading text-base font-semibold">
          {report.name}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {REPORT_CATEGORY_LABEL[report.category]} · {report.period}
        </p>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
          {report.description}
        </p>

        {/* Shape of the data — a sparkline, not a fake mini-table. */}
        {spark ? (
          <div className="mt-4 w-full">
            <Sparkline
              data={spark}
              area
              className="h-10 w-full text-chart-1"
              height={40}
            />
          </div>
        ) : null}

        <span className="mt-3 text-xs font-medium text-primary transition-transform group-hover:translate-x-0.5">
          View report →
        </span>
      </button>

      {/* Export target — physically separate footer row. */}
      <div className="flex items-center justify-end border-t border-border px-4 py-2.5">
        <ExportMenu report={report} canExport={canExport} />
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
            className="size-8"
            disabled={!canExport}
            aria-label={`Export ${report.name}`}
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

            <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
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

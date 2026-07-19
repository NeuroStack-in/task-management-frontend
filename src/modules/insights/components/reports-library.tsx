"use client";

import { useMemo, useState } from "react";
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
import { Loader } from "@/components/shared/loader";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import {
  REPORT_CATEGORY_LABEL,
  type ReportCategory,
  type ReportDef,
} from "../lib/report-def";
import {
  exportAllPdf,
  exportCsv,
  exportPdf,
  exportSelectedCsv,
} from "../lib/report-export";
import { useReportsData } from "../use-reports-data";

/**
 * The report library — the preview's "All reports" surface, restored element-for-element (category
 * filter, Download all, selectable cards with a 3-row preview + row/column counts, per-card CSV/PDF,
 * and the full-table View dialog). Every `ReportDef` it renders is composed from real endpoints in
 * {@link useReportsData}: real preview rows, real counts, real exports. A report whose composer found
 * no data renders an honest empty card — never fabricated rows.
 */

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

export function ReportsLibrary() {
  const { can } = usePermissions();
  const canExport = can("reports:export");
  const { reports: allReports, loading, error } = useReportsData();
  const [filter, setFilter] = useState<Filter>("all");
  const [preview, setPreview] = useState<ReportDef | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters are derived from the categories actually present, so there is never a dead option.
  const filters = useMemo<{ key: Filter; label: string }[]>(() => {
    const present = new Set(allReports.map((r) => r.category));
    return [
      { key: "all" as Filter, label: "All reports" },
      ...(Object.keys(REPORT_CATEGORY_LABEL) as ReportCategory[])
        .filter((c) => present.has(c))
        .map((c) => ({ key: c as Filter, label: REPORT_CATEGORY_LABEL[c] })),
    ];
  }, [allReports]);

  const reports = useMemo(
    () =>
      filter === "all"
        ? allReports
        : allReports.filter((r) => r.category === filter),
    [allReports, filter],
  );

  const selectedReports = useMemo(
    () => allReports.filter((r) => selected.has(r.id)),
    [allReports, selected],
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

  return (
    <section className="space-y-6">
      {/* Section header */}
      <SectionLabel
        icon={FileText}
        title="All reports"
        hint="Every report, organized by purpose"
      />

      {loading && allReports.length === 0 ? (
        <div className="flex min-h-[12rem] items-center justify-center rounded-2xl border border-border bg-card">
          <Loader label="Composing reports from live data…" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">
          {error}
        </div>
      ) : (
        <>
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
                {allReports.length} reports
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <SelectTrigger className="h-9 w-48" aria-label="Filter by category">
                  <SelectValue>
                    {(v) => filters.find((f) => f.key === v)?.label ?? "All reports"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  {filters.map((f) => (
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
                <Button
                  disabled={!canExport || allReports.length === 0}
                  onClick={() => exportAllPdf(allReports)}
                >
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
        </>
      )}

      <ReportPreviewDialog
        report={preview}
        canExport={canExport}
        onClose={() => setPreview(null)}
      />
    </section>
  );
}

/* ------------------------------ section label ----------------------------- */

function SectionLabel({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
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
  const empty = report.rows.length === 0;
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
        {REPORT_CATEGORY_LABEL[report.category]}
        {report.timeframe ? ` · ${report.timeframe}` : ""}
      </p>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
        {report.description}
      </p>

      {/* Mini preview */}
      {empty ? (
        <div className="mt-4 flex min-h-[6.5rem] items-center justify-center rounded-xl border border-dashed text-center text-xs text-muted-foreground">
          No data for this report yet.
        </div>
      ) : (
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
      )}

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
  const disabled = !canExport || report.rows.length === 0;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            disabled={disabled}
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
                {REPORT_CATEGORY_LABEL[report.category]}
                {report.timeframe ? ` · ${report.timeframe}` : ""} ·{" "}
                {report.rows.length} rows
              </DialogDescription>
            </DialogHeader>

            {report.rows.length === 0 ? (
              <div className="flex min-h-[8rem] flex-1 items-center justify-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">
                No data for this report yet — nothing to show or export.
              </div>
            ) : (
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
            )}

            <DialogFooter>
              <Button
                variant="outline"
                disabled={!canExport || report.rows.length === 0}
                onClick={() => exportCsv(report)}
              >
                <Sheet className="size-4" /> CSV
              </Button>
              <Button
                disabled={!canExport || report.rows.length === 0}
                onClick={() => exportPdf(report)}
              >
                <FileText className="size-4" /> PDF
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

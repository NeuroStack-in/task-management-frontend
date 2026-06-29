"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  Wallet,
  Banknote,
  Users,
  Clock,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  AlertCircle,
  Receipt,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { AiInsight } from "@/components/shared/ai-insight";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/use-permissions";
import { initials } from "@/lib/format";
import { downloadBlob } from "@/lib/download";
import { formatCurrency } from "@/lib/mock-billing";
import { cn } from "@/lib/utils";
import {
  PAYROLL_PERIODS,
  payrollRun,
  type PayrollRun,
  type PayslipRow,
} from "@/lib/mock-payroll";

const STATUS_META: Record<PayslipRow["status"], { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "bg-success/12 text-success" },
  pending: { label: "Pending", cls: "bg-warning/15 text-warning" },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
];

const REPORT_COLUMNS = [
  "Employee", "Email", "Department", "Hours", "Rate ($/hr)", "Gross", "Tax", "Benefits", "Net", "Status",
];
const reportRow = (r: PayslipRow) => [
  r.name, r.email, r.department, r.hours, r.hourlyRate, r.gross, r.tax, r.benefits, r.net, r.status,
];

function exportRunCsv(run: PayrollRun) {
  const csv = Papa.unparse({
    fields: REPORT_COLUMNS,
    data: run.rows.map(reportRow),
  });
  const file = `payroll-${slug(run.period.label)}.csv`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), file);
  toast.success("Payroll exported", {
    description: `${file} · ${run.rows.length} payslips`,
  });
}

/** One styled payslip per employee, mirroring the billing invoice layout. */
function downloadPayslipPdf(row: PayslipRow, periodLabel: string) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("WorkPulse", 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text("Payslip", 14, 27);

  doc.setTextColor(20);
  doc.setFontSize(11);
  doc.text(`Employee: ${row.name}`, 14, 42);
  doc.text(`Department: ${row.department}`, 14, 49);
  doc.text(`Title: ${row.jobTitle}`, 14, 56);
  doc.text(`Pay period: ${periodLabel}`, 130, 42);
  doc.text(`Status: ${STATUS_META[row.status].label}`, 130, 49);

  doc.setDrawColor(210);
  doc.line(14, 66, 196, 66);

  let y = 78;
  const line = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, 14, y);
    doc.text(value, 196, y, { align: "right" });
    y += 9;
  };

  line("Earnings", "");
  line(
    `Hours worked × rate (${row.hours.toFixed(1)}h @ $${row.hourlyRate}/hr)`,
    formatCurrency(row.gross),
  );
  y += 2;
  line("Deductions", "");
  line("Tax (12%)", `-${formatCurrency(row.tax)}`);
  line("Benefits (6%)", `-${formatCurrency(row.benefits)}`);
  y += 2;
  doc.line(14, y - 4, 196, y - 4);
  line("Net pay", formatCurrency(row.net), true);

  const file = `payslip-${slug(row.name)}-${slug(periodLabel)}.pdf`;
  doc.save(file);
  toast.success("Payslip downloaded", { description: file });
}

function PeriodDropdown({
  index,
  onChange,
}: {
  index: number;
  onChange: (i: number) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="gap-2" />}>
        <span className="text-muted-foreground">Period:</span>
        {PAYROLL_PERIODS[index].label}
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {PAYROLL_PERIODS.map((p, i) => (
          <DropdownMenuItem key={p.label} onClick={() => onChange(i)}>
            <Check className={cn("size-4", i === index ? "opacity-100" : "opacity-0")} />
            {p.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="gap-2" />}>
        <span className="text-muted-foreground">{label}:</span>
        {current?.label ?? "All"}
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 w-52 overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)}>
            <Check
              className={cn("size-4", o.value === value ? "opacity-100" : "opacity-0")}
            />
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PayrollView() {
  const { can } = usePermissions();
  const [periodIndex, setPeriodIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);

  const period = PAYROLL_PERIODS[periodIndex];
  const run = useMemo(() => payrollRun(period.year, period.month), [period]);

  // Previous period for the AI variance insight.
  const prevPeriod = PAYROLL_PERIODS[periodIndex + 1];
  const prevRun = useMemo(
    () => (prevPeriod ? payrollRun(prevPeriod.year, prevPeriod.month) : null),
    [prevPeriod],
  );

  const deptOptions = useMemo(() => {
    const names = [...new Set(run.rows.map((r) => r.department))].sort();
    return [
      { value: "all", label: "All departments" },
      ...names.map((d) => ({ value: d, label: d })),
    ];
  }, [run]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return run.rows.filter((r) => {
      if (dept !== "all" && r.department !== dept) return false;
      if (status !== "all" && r.status !== status) return false;
      if (
        q &&
        !`${r.name} ${r.email} ${r.department} ${r.jobTitle}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [run, query, dept, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  // Reset to the first page whenever the result set changes.
  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(0);
  };

  const { totals } = run;
  const avgNet = totals.headcount
    ? Math.round(totals.net / totals.headcount)
    : 0;

  const pendingCount = run.rows.filter((r) => r.status === "pending").length;

  // Pay-period variance for the AI insight.
  const netVariancePct =
    prevRun && prevRun.totals.net > 0
      ? Math.round(
          ((run.totals.net - prevRun.totals.net) / prevRun.totals.net) * 100,
        )
      : null;
  const hoursVariancePct =
    prevRun && prevRun.totals.hours > 0
      ? Math.round(
          ((run.totals.hours - prevRun.totals.hours) / prevRun.totals.hours) *
            100,
        )
      : null;
  const showInsight = netVariancePct !== null && Math.abs(netVariancePct) >= 2;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll"
        description={`${period.label} pay run · ${totals.headcount} employees · payslips from logged hours`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net payout"
          value={formatCurrency(totals.net)}
          icon={Wallet}
          hint={period.label}
          featured
        />
        <StatCard
          label="Gross pay"
          value={formatCurrency(totals.gross)}
          icon={Banknote}
          hint={`${formatCurrency(totals.deductions)} deductions`}
        />
        <StatCard
          label="Employees paid"
          value={`${totals.paid}/${totals.headcount}`}
          icon={Users}
          hint={totals.paid === totals.headcount ? "Run settled" : "Run pending"}
        />
        <StatCard
          label="Hours logged"
          value={totals.hours.toLocaleString("en-US")}
          icon={Clock}
          hint={`avg ${formatCurrency(avgNet)} net / person`}
        />
      </div>

      {/* Pending emphasis */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/8 px-4 py-2.5 text-sm">
          <AlertCircle className="size-4 shrink-0 text-warning" />
          <span>
            <span className="font-semibold text-warning">
              {pendingCount} payslip{pendingCount > 1 ? "s" : ""} pending
            </span>{" "}
            — this run has not settled yet.
          </span>
        </div>
      )}

      {/* Pay-period variance insight */}
      {showInsight && prevRun && netVariancePct !== null && (
        <AiInsight
          title={`Net payout ${netVariancePct > 0 ? "up" : "down"} ${Math.abs(
            netVariancePct,
          )}% vs ${prevPeriod.label}`}
          detail={
            hoursVariancePct !== null
              ? `Hours logged ${
                  hoursVariancePct > 0 ? "increased" : "decreased"
                } ${Math.abs(
                  hoursVariancePct,
                )}% period-over-period, driving the net change. Average hourly rates are stable.`
              : `Net payout moved from ${formatCurrency(
                  prevRun.totals.net,
                )} to ${formatCurrency(run.totals.net)}.`
          }
          points={[
            `${prevPeriod.label}: ${formatCurrency(
              prevRun.totals.net,
            )} net across ${prevRun.totals.headcount} employees`,
            `${period.label}: ${formatCurrency(run.totals.net)} net (${
              netVariancePct > 0 ? "+" : ""
            }${netVariancePct}%)`,
          ]}
          basis={`Derived from ${
            run.totals.headcount
          } payslips · ${run.totals.hours.toLocaleString()} hours logged`}
        />
      )}

      <Card className="p-0 [--card-spacing:0px]">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => resetPage(setQuery)(e.target.value)}
              placeholder="Search employees…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PeriodDropdown
              index={periodIndex}
              onChange={resetPage(setPeriodIndex)}
            />
            {can("payroll:export") ? (
              <Button variant="outline" onClick={() => exportRunCsv(run)}>
                <Download className="size-4" /> Download
              </Button>
            ) : null}
            <FilterDropdown
              label="Dept"
              value={dept}
              options={deptOptions}
              onChange={resetPage(setDept)}
            />
            <FilterDropdown
              label="Status"
              value={status}
              options={STATUS_OPTIONS}
              onChange={resetPage(setStatus)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No payslips"
            description="No employees match these filters for this pay period."
            className="m-5"
          />
        ) : (
          <Table className="[&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5">
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payslip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage src={r.avatarUrl} alt={r.name} />
                        <AvatarFallback>{initials(r.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.jobTitle}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.department}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {r.hours.toFixed(1)}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    ${r.hourlyRate}/hr
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatCurrency(r.gross)}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    -{formatCurrency(r.deductions)}
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {formatCurrency(r.net)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn("font-medium", STATUS_META[r.status].cls)}
                    >
                      {STATUS_META[r.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadPayslipPdf(r, period.label)}
                    >
                      <Download className="size-4" /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {filtered.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-border px-5 py-3">
            <span className="text-sm text-muted-foreground">
              Showing {safePage * PAGE_SIZE + 1}–
              {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-4" /> Prev
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {safePage + 1} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Next <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

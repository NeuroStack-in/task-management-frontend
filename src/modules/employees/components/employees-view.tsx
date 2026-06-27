"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  Users,
  UserCheck,
  Gauge as GaugeIcon,
  Building2,
  Search,
  ChevronDown,
  Check,
  Download,
  FileText,
  Sheet,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { TablePagination } from "@/components/shared/table-pagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
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
import { useEmployeesStore } from "@/stores/employees.store";
import { initials } from "@/lib/format";
import { downloadBlob } from "@/lib/download";
import { cn } from "@/lib/utils";
import { CreateEmployeeDialog } from "./create-employee-dialog";

export interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  roleName: string;
  jobTitle: string;
  department: string;
  team: string;
  status: "active" | "inactive" | "invited" | "suspended";
  productivityScore: number;
}

const STATUSES = ["all", "active", "inactive", "invited", "suspended"] as const;
const PAGE_SIZE = 9;

const REPORT_COLUMNS = [
  "ID", "Name", "Email", "Role", "Title", "Department", "Team", "Status", "Productivity %",
];
const reportRow = (e: EmployeeRow) => [
  e.id, e.name, e.email, e.roleName, e.jobTitle, e.department, e.team, e.status, e.productivityScore,
];

function exportEmployeesCsv(list: EmployeeRow[]) {
  const csv = Papa.unparse({ fields: REPORT_COLUMNS, data: list.map(reportRow) });
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    "employees-report.csv",
  );
  toast.success("Report exported", {
    description: `employees-report.csv · ${list.length} people`,
  });
}

function exportEmployeesPdf(
  list: EmployeeRow[],
  stats: { active: number; avgProductivity: number },
) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Employee Report", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    `${list.length} employees · ${stats.active} active · ${stats.avgProductivity}% avg productivity · WorkPulse`,
    14,
    25,
  );

  const xs = [14, 92, 140, 178];
  let y = 36;
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  ["Name", "Department", "Status", "Prod %"].forEach((c, i) => doc.text(c, xs[i], y));
  doc.setDrawColor(210);
  doc.line(14, y + 2, 196, y + 2);
  doc.setFont("helvetica", "normal");
  y += 8;

  for (const e of list) {
    doc.text(e.name, xs[0], y);
    doc.text(e.department, xs[1], y);
    doc.text(e.status, xs[2], y);
    doc.text(`${e.productivityScore}%`, xs[3], y);
    y += 7;
    if (y > 285) {
      doc.addPage();
      y = 18;
    }
  }

  doc.save("employees-report.pdf");
  toast.success("Report exported", {
    description: `employees-report.pdf · ${list.length} people`,
  });
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
      <DropdownMenuTrigger
        render={<Button variant="outline" className="gap-2" />}
      >
        <span className="text-muted-foreground">{label}:</span>
        {current?.label ?? "All"}
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 w-52 overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)}>
            <Check
              className={cn(
                "size-4",
                o.value === value ? "opacity-100" : "opacity-0",
              )}
            />
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const STATUS_BADGE: Record<EmployeeRow["status"], string> = {
  active: "bg-success/12 text-success",
  inactive: "bg-muted text-muted-foreground",
  invited: "bg-warning/15 text-warning",
  suspended: "bg-destructive/12 text-destructive",
};

const STATUS_ICON: Record<EmployeeRow["status"], React.ReactNode> = {
  active: <span className="inline-block size-1.5 rounded-full bg-success" />,
  inactive: <span className="inline-block size-1.5 rounded-full bg-muted-foreground" />,
  invited: <span className="inline-block size-1.5 rounded-full bg-warning" />,
  suspended: <span className="inline-block size-1.5 rounded-full bg-destructive" />,
};

function StatusBadge({ status }: { status: EmployeeRow["status"] }) {
  return (
    <Badge className={cn("gap-1.5 capitalize rounded-sm", STATUS_BADGE[status])}>
      {STATUS_ICON[status]}
      {status}
    </Badge>
  );
}

function ProductivityCell({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            value >= 75 ? "bg-success" : value >= 50 ? "bg-primary" : "bg-warning",
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {value}%
      </span>
    </div>
  );
}

export function EmployeesView({
  employees,
  departments,
  stats,
}: {
  employees: EmployeeRow[];
  departments: string[];
  stats: { total: number; active: number; avgProductivity: number; departments: number };
}) {
  const { can } = usePermissions();
  const router = useRouter();
  const customEmployees = useEmployeesStore((s) => s.customEmployees);
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  // Runtime-created accounts (persisted store) sit on top of the seed users.
  const allEmployees = useMemo(
    () => [...customEmployees, ...employees],
    [customEmployees, employees],
  );
  // Created accounts have no seed-backed profile page, so their rows don't link.
  const customIds = useMemo(
    () => new Set(customEmployees.map((e) => e.id)),
    [customEmployees],
  );

  // Stats stay in sync as accounts are added this session.
  const liveStats = useMemo(() => {
    if (customEmployees.length === 0) return stats;
    const total = allEmployees.length;
    const active = allEmployees.filter((e) => e.status === "active").length;
    const avgProductivity = Math.round(
      allEmployees.reduce((s, e) => s + e.productivityScore, 0) / total,
    );
    const departmentCount = new Set(allEmployees.map((e) => e.department)).size;
    return { total, active, avgProductivity, departments: departmentCount };
  }, [allEmployees, customEmployees.length, stats]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEmployees.filter((e) => {
      if (dept !== "all" && e.department !== dept) return false;
      if (status !== "all" && e.status !== status) return false;
      if (
        q &&
        !`${e.name} ${e.email} ${e.jobTitle} ${e.id}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [allEmployees, query, dept, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(0);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        description="Your organization's people, productivity, and teams."
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total employees" value={liveStats.total} icon={Users} hint="in this organization" featured />
        <StatCard label="Active" value={liveStats.active} icon={UserCheck} hint={`${liveStats.total - liveStats.active} inactive`} />
        <StatCard label="Avg. productivity" value={`${liveStats.avgProductivity}%`} icon={GaugeIcon} hint="across all employees" />
        <StatCard label="Departments" value={liveStats.departments} icon={Building2} hint="across the org" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Search by name, email, ID, or title…"
            className="pl-9"
          />
        </div>
        <FilterDropdown
          label="Dept"
          value={dept}
          onChange={resetPage(setDept)}
          options={[
            { value: "all", label: "All departments" },
            ...departments.map((d) => ({ value: d, label: d })),
          ]}
        />
        <FilterDropdown
          label="Status"
          value={status}
          onChange={resetPage(setStatus)}
          options={STATUSES.map((s) => ({
            value: s,
            label: s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1),
          }))}
        />
        <div className="flex items-center gap-2 sm:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <Download className="size-4" /> Download report
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportEmployeesPdf(filtered, liveStats)}>
                <FileText className="size-4" /> PDF report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportEmployeesCsv(filtered)}>
                <Sheet className="size-4" /> CSV export
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {can("employees:manage") ? (
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus className="size-4" /> Add employee
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No employees match"
              description="Try a different search or clear the filters."
              className="m-4 border-0"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-44">Productivity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow
                      key={e.id}
                      tabIndex={!customIds.has(e.id) ? 0 : undefined}
                      className={cn(
                        "transition-colors",
                        !customIds.has(e.id) &&
                          "cursor-pointer hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
                      )}
                      onClick={() =>
                        customIds.has(e.id)
                          ? undefined
                          : router.push(`/employees/${e.id}`)
                      }
                      onKeyDown={(ev) => {
                        if (!customIds.has(e.id) && (ev.key === "Enter" || ev.key === " ")) {
                          ev.preventDefault();
                          router.push(`/employees/${e.id}`);
                        }
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarImage src={e.avatarUrl} alt={e.name} />
                            <AvatarFallback className="text-xs">
                              {initials(e.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{e.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              <span className="font-mono text-[0.65rem] text-muted-foreground/70">
                                {e.id}
                              </span>{" "}
                              · {e.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.roleName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.department} · {e.team}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={e.status} />
                      </TableCell>
                      <TableCell>
                        <ProductivityCell value={e.productivityScore} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <TablePagination
        page={safePage}
        pageCount={pageCount}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <CreateEmployeeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        departments={departments}
        existingEmails={allEmployees.map((e) => e.email)}
      />
    </div>
  );
}

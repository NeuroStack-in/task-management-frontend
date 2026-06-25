"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserCheck,
  Gauge as GaugeIcon,
  Building2,
  Search,
  ChevronDown,
  Check,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

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

const STATUS_META: Record<EmployeeRow["status"], string> = {
  active: "bg-success/12 text-success",
  inactive: "bg-muted text-muted-foreground",
  invited: "bg-warning/15 text-warning",
  suspended: "bg-destructive/12 text-destructive",
};

const STATUSES = ["all", "active", "inactive", "invited", "suspended"] as const;
const PAGE_SIZE = 9;

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

function ProductivityCell({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
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
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (dept !== "all" && e.department !== dept) return false;
      if (status !== "all" && e.status !== status) return false;
      if (q && !`${e.name} ${e.email} ${e.jobTitle}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [employees, query, dept, status]);

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
        actions={
          can("employees:manage") ? (
            <Button>
              <UserPlus className="size-4" /> Invite people
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total employees" value={stats.total} icon={Users} hint="in this organization" featured />
        <StatCard label="Active" value={stats.active} icon={UserCheck} delta={4} />
        <StatCard label="Avg. productivity" value={`${stats.avgProductivity}%`} icon={GaugeIcon} delta={3} />
        <StatCard label="Departments" value={stats.departments} icon={Building2} hint="across the org" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Search by name, email, or title…"
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
                    <TableHead className="w-40">Productivity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/employees/${e.id}`)}
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
                              {e.email}
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
                        <Badge className={STATUS_META[e.status]}>{e.status}</Badge>
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
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filtered.length === 0
            ? "No results"
            : `${safePage * PAGE_SIZE + 1}–${Math.min(
                (safePage + 1) * PAGE_SIZE,
                filtered.length,
              )} of ${filtered.length}`}
        </span>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

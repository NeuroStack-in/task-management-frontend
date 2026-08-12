"use client";

import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
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
import { Loader } from "@/components/shared/loader";
import { initials } from "@/lib/format";
import { downloadBlob } from "@/lib/download";
import { cn } from "@/lib/utils";
import { useTrackingMode } from "@/hooks/use-features";
import { Badge } from "@/components/ui/badge";
import { InviteDialog } from "./invite-dialog";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { PendingInvites } from "./pending-invites";
import { useEmployees, type EmployeeRow } from "../use-employees";

export type { EmployeeRow };

const STATUSES = ["all", "active", "inactive", "invited", "suspended"] as const;
const PAGE_SIZE = 9;

const REPORT_COLUMNS = [
  "ID", "Name", "Email", "Role", "Title", "Department", "Team", "Status", "Productivity %",
];
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const reportRow = (e: EmployeeRow) => [
  // Human employee code only — never fall back to the opaque UUID.
  e.empId ?? "", e.name, e.email, e.roleName, e.jobTitle, e.department, e.team, e.status, pct(e.productivityScore),
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
  stats: { active: number; avgProductivity: number | null },
) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Employee Report", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    `${list.length} employees · ${stats.active} active · ${pct(stats.avgProductivity)} avg productivity · WorkPulse`,
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
    doc.text(pct(e.productivityScore), xs[3], y);
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

function ProductivityCell({ value }: { value: number | null }) {
  // `null` = the score isn't available yet (it needs the desktop agent's activity data, via
  // insights). Show a clear placeholder rather than a fake 0%.
  if (value === null) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title="Productivity scoring needs activity monitoring, which isn't enabled yet."
      >
        —
      </span>
    );
  }
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

export function EmployeesView() {
  const { can } = usePermissions();
  const router = useRouter();
  // Real backend directory (server-scoped by `employees:read`). No client scope filter, no session
  // overlays — the server is the roster.
  const { employees, loading, error, reload } = useEmployees();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Bumped when an invite is created, so the Invited section refetches without a page reload.
  const [invitesVersion, setInvitesVersion] = useState(0);
  /**
   * Which action leads. In `machine` mode almost nobody needs a console login — the org's people are
   * recorded by a managed agent (MANAGED-AGENT.md §6.4) — so "Add employee" is primary and Invite
   * moves into the overflow. In `project` mode the reverse, which is today's behaviour unchanged.
   */
  const mode = useTrackingMode();
  const addLeads = mode === "machine";

  const allEmployees = employees;
  // Every row is a real directory user with a profile page — none are session-only.
  const customIds = useMemo(() => new Set<string>(), []);

  const deptOptions = useMemo(
    () => [...new Set(allEmployees.map((e) => e.department))].sort(),
    [allEmployees],
  );

  const liveStats = useMemo(() => {
    const total = allEmployees.length;
    const active = allEmployees.filter((e) => e.status === "active").length;
    // Average only over rows that actually have a score. None do yet (productivity needs the agent),
    // so this is `null` → the stat card shows "—" instead of a fake 0%.
    const scored = allEmployees.filter((e) => e.productivityScore !== null);
    const avgProductivity = scored.length
      ? Math.round(
          scored.reduce((s, e) => s + (e.productivityScore ?? 0), 0) / scored.length,
        )
      : null;
    const departmentCount = new Set(allEmployees.map((e) => e.department)).size;
    return { total, active, avgProductivity, departments: departmentCount };
  }, [allEmployees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEmployees.filter((e) => {
      if (dept !== "all" && e.department !== dept) return false;
      if (status !== "all" && e.status !== status) return false;
      if (
        q &&
        !`${e.name} ${e.email} ${e.jobTitle} ${e.empId ?? ""} ${e.id}`
          .toLowerCase()
          .includes(q)
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

  if (loading && employees.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader label="Loading employees…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <PageHeader title="Employees" description="Your organization's people." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        description="Your organization's people, productivity, and teams."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total employees" value={liveStats.total} icon={Users} hint="in this organization" featured />
        {/* `delta={4}` used to sit here — a hardcoded "+4%" rendered as a real trend pill beside a
            real count. There is no prior-window comparison to draw it from, so it was invented.
            Dropped rather than seeded, like every other delta on the dashboard. */}
        <StatCard
          label="Active"
          value={liveStats.active}
          icon={UserCheck}
          hint="not deactivated"
        />
        <StatCard label="Avg. productivity" value={pct(liveStats.avgProductivity)} icon={GaugeIcon} hint="pending activity monitoring" />
        <StatCard label="Departments" value={liveStats.departments} icon={Building2} hint="across the org" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
            ...deptOptions.map((d) => ({ value: d, label: d })),
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
              <Download className="size-4" /> Download
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => exportEmployeesPdf(filtered, liveStats)}
              >
                <FileText className="size-4" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportEmployeesCsv(filtered)}>
                <Sheet className="size-4" /> CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {can("employees:manage") ? (
            <div className="flex items-center gap-2">
              <Button
                data-tour="emp:invite"
                onClick={() => (addLeads ? setAddOpen(true) : setInviteOpen(true))}
              >
                <UserPlus className="size-4" />
                {addLeads ? "Add employee" : "Invite"}
              </Button>
              {/* The other action, always reachable — the mode decides which leads, never which
                  exists. An org in machine mode still hires the manager who needs a console. */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" aria-label="More ways to add people" />}
                >
                  <ChevronDown className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => (addLeads ? setInviteOpen(true) : setAddOpen(true))}
                  >
                    <UserPlus className="size-4" />
                    {addLeads ? "Invite with login…" : "Add without login…"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
            <div className="overflow-x-auto" data-tour="emp:roster">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="w-40">Productivity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow
                      key={e.id}
                      className={cn(!customIds.has(e.id) && "cursor-pointer")}
                      onClick={() =>
                        customIds.has(e.id)
                          ? undefined
                          : router.push(`/employees/${e.id}`)
                      }
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
                            <div className="flex items-center gap-1.5">
                              <p className="truncate font-medium">{e.name}</p>
                              {/* "Cannot sign in" and "invited, hasn't accepted yet" look identical
                                  in this roster and mean opposite things — this is the difference. */}
                              {e.monitored && (
                                <Badge variant="outline" className="shrink-0 text-[10px]">
                                  Monitored
                                </Badge>
                              )}
                            </div>
                            {/* Subtitle: the human employee id (e.g. EMP-0001) is the directory's
                                stable identifier — lead with it. Fall back to job title, then email;
                                the raw Cognito UUID is never shown. */}
                            {(e.empId || e.jobTitle || e.email) && (
                              <p className="truncate text-xs text-muted-foreground">
                                {e.empId ? (
                                  <span className="font-mono tabular-nums">{e.empId}</span>
                                ) : null}
                                {e.empId && (e.jobTitle || e.email) ? " · " : ""}
                                {e.jobTitle || e.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.roleName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.department}
                        {e.team ? ` · ${e.team}` : ""}
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
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
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

      {/* Below the roster on purpose: invitees aren't employees yet, and the section renders
          nothing at all when the org has never invited anyone. */}
      <PendingInvites refreshKey={invitesVersion} />

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={() => setInvitesVersion((v) => v + 1)}
      />

      {/* A monitored employee is a directory record, not an invite — it lands in the roster, so
          this reloads the roster rather than bumping the Invited section. */}
      <AddEmployeeDialog open={addOpen} onOpenChange={setAddOpen} onCreated={reload} />
    </div>
  );
}

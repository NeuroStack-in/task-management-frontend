"use client";

import { useEffect, useMemo, useState } from "react";
import { DepartmentFilter } from "@/components/shared/department-filter";
import { useRouter } from "next/navigation";
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
  UserMinus,
  UserX,
  MoreVertical,
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
} from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useAssistantPageContext } from "@/stores/page-context.store";
import { Loader } from "@/components/shared/loader";
import { downloadBlob } from "@/lib/download";
import { cn } from "@/lib/utils";
import { useTrackingMode } from "@/hooks/use-features";
import { Badge } from "@/components/ui/badge";
import { ApiError } from "@/lib/api";
import { TablePagination } from "@/components/shared/table-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQueryState } from "@/modules/projects/use-query-state";
// Where departments are created and edited — Settings → Organization → Departments (PEOPLE-22).
import { DEPARTMENTS_HREF } from "@/modules/settings/lib/org-sections";
import { useAuthStore } from "@/stores/auth.store";
import { readInterruptedRun, type InviteRunRecord } from "../lib/invite-run";
import { InviteDialog } from "./invite-dialog";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { PendingInvites } from "./pending-invites";
import { useEmployees, type EmployeeRow } from "../use-employees";
import { buildPdf, type PdfTextFor } from "../lib/pdf-text";
import { ReportDoc } from "../lib/report-doc";
import { toCsv } from "@/lib/csv";
import {
  DIRECTORY_SORTS,
  DIRECTORY_STATUSES,
  NO_DEPARTMENT,
  PAGE_SIZES,
  directoryStats,
  filterEmployees,
  hiddenByStatus,
  nextSort,
  sortEmployees,
  sortKeyOf,
  type DirectorySort,
  type DirectoryStatus,
  type PageSize,
  type SortKey,
} from "../lib/directory";

export type { EmployeeRow };

/**
 * Lifecycle filters shown in the Status dropdown.
 *
 * **`benched` and `deactivated` are different things and must never be merged.** Benched is an
 * orthogonal flag: the person is still an employee with a working login, just excluded from
 * Attendance and Time-Tracking. Deactivated is a lifecycle end: their login is disabled and their
 * work is reassigned. One control for both would put "re-include in tracking" and "restore system
 * access to someone who left" behind the same click.
 *
 * `benched` used to be labelled "Inactive", which collided with "Deactivate" in the same UI and is
 * what made them look like one idea. It now says what it is.
 *
 * No "Invited": no roster row can have that status — invitees are listed in their own section below
 * (QA audit 2026-10-08, WP-456).
 *
 * **Active is the default** (UX audit PEOPLE-05). "All statuses" was, and it mixed leavers into the
 * roster with no badge while the Not tracked and Deactivated rosters below listed the same people a
 * second time. Now the table shows the working roster, the two rosters below hold everyone else, and
 * a roster is hidden whenever the table's filter already lists its people.
 */
const STATUSES = DIRECTORY_STATUSES;
const STATUS_LABELS: Record<DirectoryStatus, string> = {
  active: "Active",
  benched: "Not tracked",
  deactivated: "Deactivated",
  all: "All statuses",
};

/**
 * Rows per page. It was 9 — about 17 pages for a 150-person org — with no way to change it
 * (UX audit PEOPLE-04).
 */
const DEFAULT_PAGE_SIZE: PageSize = "25";

/**
 * Rows per page in the Not tracked and Deactivated rosters — the Invited section's figure. Both
 * listed everyone at once, so at 150 people a long bench pushed the rest of the page out of reach
 * (UX audit 2026-10-16, PEOPLE-22).
 */
const ROSTER_PAGE_SIZE = 10;

/** One page of a roster, with the page clamped to what exists — the list shrinks as people move. */
function rosterPage<T>(list: T[], page1: string): { shown: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(list.length / ROSTER_PAGE_SIZE));
  const page = Math.min(Math.max(0, (Number.parseInt(page1, 10) || 1) - 1), pageCount - 1);
  return {
    shown: list.slice(page * ROSTER_PAGE_SIZE, (page + 1) * ROSTER_PAGE_SIZE),
    page,
    pageCount,
  };
}

// No Email or Team columns: the directory list carries neither, so they were blank in every row
// (WP-456). Both are on each person's profile.
const REPORT_COLUMNS = ["ID", "Name", "Role", "Title", "Department", "Status", "Productivity %"];
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const reportRow = (e: EmployeeRow) => [
  // Human employee code only — never fall back to the opaque UUID.
  e.empId ?? "", e.name, e.roleName, e.jobTitle, e.department, e.status, pct(e.productivityScore),
];

function exportEmployeesCsv(list: EmployeeRow[]) {
  const csv = toCsv({ fields: REPORT_COLUMNS, data: list.map(reportRow) });
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    "employees-report.csv",
  );
  toast.success("Report exported", {
    description: `employees-report.csv · ${list.length} people`,
  });
}

async function exportEmployeesPdf(list: EmployeeRow[]) {
  try {
    // The same document as the individual employee report — accent band, headline cards, sections,
    // striped tables, numbered pages (owner request 2026-10-16). Every string goes through the
    // `PdfText` writer, so a name in any script prints (WP-225).
    const doc = await buildPdf((text) => drawEmployeesReport(text, list));
    const file = `employees-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(file);
    toast.success("Report exported", {
      description: `${file} · ${list.length} people`,
    });
  } catch {
    toast.error("Couldn't build the PDF. Try again.");
  }
}

/**
 * The people in this file, as the Employees page showed them when it was exported. Every figure
 * describes these rows — the header used to put the filtered row count beside org-wide totals,
 * "12 employees · 87 active" for one department (WP-456).
 */
function drawEmployeesReport(text: PdfTextFor, list: EmployeeRow[]) {
  const stamp = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const doc = new ReportDoc(text, {
    title: "Employees",
    kind: "employees report",
    stamp: `Generated ${stamp}`,
  });
  const active = list.filter((e) => e.status === "active");
  const avg = (rows: EmployeeRow[]) => {
    const scored = rows.filter((e) => e.productivityScore !== null);
    return scored.length
      ? Math.round(scored.reduce((s, e) => s + (e.productivityScore ?? 0), 0) / scored.length)
      : null;
  };
  const deptName = (e: EmployeeRow) => e.department || "No department";
  const departments = new Map<string, EmployeeRow[]>();
  for (const e of list) departments.set(deptName(e), [...(departments.get(deptName(e)) ?? []), e]);

  doc.cards([
    { label: "People", value: String(list.length), hint: "in this export" },
    {
      label: "Active",
      value: String(active.length),
      hint: list.length - active.length ? `${list.length - active.length} deactivated` : "everyone",
    },
    {
      label: "Avg productivity",
      value: pct(avg(list)),
      hint: `${list.filter((e) => e.productivityScore !== null).length} people scored`,
    },
    { label: "Departments", value: String(departments.size), hint: "represented" },
  ]);
  doc.note(`This file lists the ${list.length} people shown on the Employees page when it was exported.`);

  doc.section("By department");
  doc.table(
    doc.fitColumns([
      { header: "Department", width: 80 },
      { header: "People", width: 25, align: "right" },
      { header: "Active", width: 25, align: "right" },
      { header: "Monitored", width: 25, align: "right" },
      { header: "Avg productivity", width: 35, align: "right" },
    ]),
    [...departments.entries()]
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
      .map(([name, rows]) => [
        name,
        rows.length,
        rows.filter((e) => e.status === "active").length,
        rows.filter((e) => e.monitored).length || "—",
        pct(avg(rows)),
      ]),
    { empty: "No one to list." },
  );

  doc.section("People", "by name");
  doc.table(
    doc.fitColumns([
      // Human employee code only — never the opaque UUID.
      { header: "Emp ID", width: 26 },
      { header: "Name", width: 35 },
      { header: "Role", width: 24 },
      { header: "Job title", width: 30 },
      { header: "Department", width: 29 },
      { header: "Status", width: 20 },
      { header: "Score", width: 16, align: "right" },
    ]),
    [...list]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => [
        e.empId ?? "—",
        e.name,
        e.roleName,
        e.jobTitle,
        e.department || "—",
        // "Not tracked", as on the page — "Benched" was a third word for the same state.
        e.status === "active" ? (e.benched ? "Not tracked" : "Active") : "Deactivated",
        pct(e.productivityScore),
      ]),
    { empty: "No one to list." },
  );

  doc.finish(
    `WorkPulse · employees · generated ${stamp} · score is each person's productivity as on the ` +
      "Employees page; — means not scored",
  );
  return doc.d;
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

/** A column header that sorts the roster. `aria-sort` tells a screen reader which way. */
function SortableHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: DirectorySort;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const { key, desc } = sortKeyOf(sort);
  const active = key === sortKey;
  const Icon = !active ? ChevronsUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (desc ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", active ? "opacity-100" : "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}

/** Why a productivity cell shows "—" — the reason the scores aren't there, not a verdict on the person. */
const NO_SCORE_REASON: Record<ReturnType<typeof useEmployees>["scoreStatus"], string> = {
  off: "Productivity scores need access to org activity, which your role doesn't have.",
  loading: "Loading productivity scores…",
  ready: "No day in the last 30 met the scoring minimum for this person.",
  failed: "Some productivity scores couldn't be loaded. Refresh to try again.",
};

function ProductivityCell({
  value,
  status,
}: {
  value: number | null;
  status: ReturnType<typeof useEmployees>["scoreStatus"];
}) {
  // A clear placeholder rather than a fake 0% — with the actual reason. It used to say "activity
  // monitoring isn't enabled yet" for a 403 or a network blip alike (QA audit 2026-10-08, WP-229).
  if (value === null) {
    return (
      <span className="text-xs text-muted-foreground" title={NO_SCORE_REASON[status]}>
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
  // overlays — the server is the roster. Scores only for a viewer who may read org activity (the
  // route needs `ActivityReadOrg`, a different bit from the directory's) — WP-453.
  const {
    employees,
    loading,
    error,
    incomplete,
    departmentCount,
    reload,
    bench,
    scoreStatus,
    anyAgentReported,
  } = useEmployees({ withScores: can("activity:view") });
  // Search, filters, sort, page size and page live in the URL, so Back from a profile, a refresh and
  // a shared link return to the same view — they all reset on Back before (UX audit PEOPLE-04).
  const [query, setQuery] = useQueryState<string>("q", "");
  const [dept, setDept] = useQueryState<string>("dept", "all");
  const [status, setStatus] = useQueryState<DirectoryStatus>("status", "active", STATUSES);
  const [sort, setSort] = useQueryState<DirectorySort>("sort", "name", DIRECTORY_SORTS);
  const [pageSizeParam, setPageSize] = useQueryState<PageSize>("size", DEFAULT_PAGE_SIZE, PAGE_SIZES);
  const [pageParam, setPageParam] = useQueryState<string>("page", "1");
  // The two rosters' pages, in the URL like the table's, so Back from a profile opened from either
  // returns to the same page of it.
  const [benchPageParam, setBenchPageParam] = useQueryState<string>("bench_page", "1");
  const [leaverPageParam, setLeaverPageParam] = useQueryState<string>("deactivated_page", "1");
  const pageSize = Number(pageSizeParam);
  const page = Math.max(0, (Number.parseInt(pageParam, 10) || 1) - 1);
  const setPage = (p: number) => setPageParam(String(p + 1));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Bumped when an invite is created, so the Invited section refetches without a page reload.
  const [invitesVersion, setInvitesVersion] = useState(0);
  /**
   * A bulk invite run this admin left unfinished — the tab closed mid-run (UX audit PEOPLE-12). Said
   * here as well as in the dialog, because nothing else would prompt anyone to open the dialog.
   * Re-read whenever the dialog closes, since finishing the run there clears it.
   */
  const tenantId = useAuthStore((s) => s.user?.organizationId ?? "");
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const mayInvite = can("employees:manage");
  const [interruptedRun, setInterruptedRun] = useState<InviteRunRecord | null>(null);
  useEffect(() => {
    setInterruptedRun(mayInvite && !inviteOpen ? readInterruptedRun(tenantId, userId) : null);
  }, [mayInvite, inviteOpen, tenantId, userId]);
  /**
   * Which action leads. In `machine` mode almost nobody needs a console login — the org's people are
   * recorded by a managed agent (MANAGED-AGENT.md §6.4) — so "Add employee" is primary and Invite
   * moves into the overflow. In `project` mode the reverse, which is today's behaviour unchanged.
   */
  const mode = useTrackingMode();
  const addLeads = mode === "machine";
  /**
   * May this org create a **monitored** (no-login) employee at all?
   *
   * Only where a managed agent actually runs. The comment below says the mode decides which action
   * *leads*, never which exists — true for `machine`, where the org still hires a manager who needs
   * a console. It does not hold in reverse: in `project` mode tracking is done by the interactive
   * desktop agent, and that **requires a login**. A no-login record there can never sign in, never
   * run the agent, and never be assigned a managed device the org doesn't deploy — so it is a person
   * who occupies a seat and reports nothing, indistinguishable from an agent that is broken.
   */
  const canAddMonitored = mode === "machine" || mode === "both";

  const allEmployees = employees;

  // The departments people are in, plus "No department" when anyone has none — never a blank
  // option (WP-111).
  const deptOptions = useMemo(() => {
    const named = [...new Set(allEmployees.map((e) => e.department).filter(Boolean))]
      .sort()
      .map((d) => ({ value: d, label: d }));
    return allEmployees.some((e) => !e.department)
      ? [...named, { value: NO_DEPARTMENT, label: "No department" }]
      : named;
  }, [allEmployees]);

  const liveStats = useMemo(() => {
    // Current people only — leavers are not counted as employees (PEOPLE-05). Benched people are
    // still employees but aren't tracked, so the "Active" tile counts the tracked ones, shown as
    // "N / total" so the bench is visible at a glance.
    const { total, tracked: activeWorking, benched, deactivated } = directoryStats(allEmployees);
    // Average only over current people with a score — `null` → the card shows "—", not a fake 0%.
    const scored = allEmployees.filter(
      (e) => e.status === "active" && e.productivityScore !== null,
    );
    const avgProductivity = scored.length
      ? Math.round(
          scored.reduce((s, e) => s + (e.productivityScore ?? 0), 0) / scored.length,
        )
      : null;
    // The org's own department count. Counting distinct labels on people made "no department" a
    // department and missed the empty ones (WP-111); that count is only the fallback now.
    const departments =
      departmentCount ?? new Set(allEmployees.map((e) => e.department).filter(Boolean)).size;
    return { total, activeWorking, benched, deactivated, avgProductivity, departments };
  }, [allEmployees, departmentCount]);

  // Filtered, then sorted — the export takes this order too. Search covers name, employee ID, title,
  // department and role; it ignored the last two (PEOPLE-04). See `lib/directory.ts`.
  const filtered = useMemo(
    () => sortEmployees(filterEmployees(allEmployees, { query, dept, status }), sort),
    [allEmployees, query, dept, status, sort],
  );
  const hiddenMatches = useMemo(
    () => hiddenByStatus(allEmployees, { query, dept, status }),
    [allEmployees, query, dept, status],
  );

  // Publish the directory's on-screen figures + active filters to the assistant, so a question about
  // "these people" resolves against the same roster/counts the user is looking at.
  useAssistantPageContext({
    facts: [
      { label: "Total employees (current)", value: String(liveStats.total) },
      { label: "Active (tracked)", value: String(liveStats.activeWorking) },
      { label: "Not tracked", value: String(liveStats.benched) },
      { label: "Deactivated (not counted)", value: String(liveStats.deactivated) },
      { label: "Departments", value: String(liveStats.departments) },
      ...(liveStats.avgProductivity !== null
        ? [{ label: "Avg productivity", value: `${liveStats.avgProductivity}%` }]
        : []),
      ...(dept !== "all"
        ? [{ label: "Department filter", value: dept === NO_DEPARTMENT ? "No department" : dept }]
        : []),
      ...(status !== "all" ? [{ label: "Status filter", value: STATUS_LABELS[status] }] : []),
      ...(query.trim() ? [{ label: "Search", value: query.trim() }] : []),
      { label: "Showing (after filters)", value: String(filtered.length) },
    ],
  });

  // The dedicated bench roster — everyone flagged `benched`, name-sorted, independent of the
  // table's filters. This is the "who is on the bench" answer at a glance.
  const benchedEmployees = useMemo(
    () =>
      allEmployees
        .filter((e) => e.benched)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allEmployees],
  );

  /**
   * Everyone whose lifecycle has ended. Its own roster, separate from the bench above.
   *
   * Without this they had nowhere to be: there was no Deactivated filter and no section, so a
   * deactivated person fell into "All statuses" unlabelled and Reactivate was reachable only by
   * knowing their profile URL.
   */
  const deactivatedEmployees = useMemo(
    () =>
      allEmployees
        .filter((e) => e.status === "deactivated")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allEmployees],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const benchRoster = rosterPage(benchedEmployees, benchPageParam);
  const leaverRoster = rosterPage(deactivatedEmployees, leaverPageParam);
  /**
   * The rosters below list only people the table isn't already showing — the bench under Active or
   * Deactivated, leavers under Active or Not tracked — so nobody appears twice (PEOPLE-05).
   */
  const showBenchRoster = status === "active" || status === "deactivated";
  const showDeactivatedRoster = status === "active" || status === "benched";

  const canManage = can("employees:manage");
  // Departments are edited on Settings → Organization, which needs `settings:view` to open.
  const canOpenDepartments = can("settings:view");
  const onToggleBench = async (e: EmployeeRow) => {
    try {
      await bench(e.id, !e.benched);
      toast.success(
        e.benched ? `${e.name} is tracked again` : `${e.name} is no longer tracked`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update status. Try again.");
    }
  };

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(0);
  };
  const sortBy = (key: SortKey) => resetPage(setSort)(nextSort(sort, key));

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

      {/* From `sm` up, the four cards. On a phone they stacked to ≈ 640 px before the search box
          (UX audit PEOPLE-14) — the phone gets the same four figures as one compact strip, placed
          after the toolbar so search comes first. */}
      <div className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total employees"
          value={liveStats.total}
          icon={Users}
          // Leavers are left out of the count, and the hint says how many (PEOPLE-05).
          hint={
            liveStats.deactivated > 0
              ? `${liveStats.deactivated} deactivated not counted`
              : "in this organization"
          }
          featured
        />
        {/* `delta={4}` used to sit here — a hardcoded "+4%" rendered as a real trend pill beside a
            real count. There is no prior-window comparison to draw it from, so it was invented.
            Dropped rather than seeded, like every other delta on the dashboard. */}
        <StatCard
          label="Active"
          value={
            liveStats.benched > 0
              ? `${liveStats.activeWorking} / ${liveStats.total}`
              : liveStats.activeWorking
          }
          icon={UserCheck}
          // "Not tracked", like the filter and the badge: "inactive" is what a leaver gets called.
          hint={liveStats.benched > 0 ? `${liveStats.benched} not tracked` : "tracked"}
        />
        {/* The hint used to read "pending activity monitoring" unconditionally — it was describing
            the hardcoded null, not the data. Scores are joined in now, so it states the window when
            there is one and stays honest when there isn't. */}
        <StatCard
          label="Avg. productivity"
          value={pct(liveStats.avgProductivity)}
          icon={GaugeIcon}
          hint={
            liveStats.avgProductivity !== null
              ? scoreStatus === "failed"
                ? "30-day average — some days couldn't be loaded"
                : "30-day average of reporting employees"
              : scoreStatus === "off"
                // Not a fact about the fleet: this viewer can't read org activity (WP-229).
                ? "needs access to org activity"
                : scoreStatus === "loading"
                  ? "loading…"
                  : scoreStatus === "failed"
                    ? "couldn't load activity — refresh to try again"
                    : anyAgentReported
                      // Agents ARE reporting; no day cleared the server's 30-minute scoring floor.
                      // Saying "no agent activity" here sent people to check installs on a working
                      // fleet.
                      ? "agents reporting, but no day met the scoring minimum"
                      : "no agent activity in the last 30 days"
          }
        />
        {/* A way to departments from People: they were managed only in Settings → Organization,
            with nothing here pointing there (UX audit 2026-10-16, PEOPLE-22). A link only for
            whoever can open that page. */}
        <StatCard
          label="Departments"
          value={liveStats.departments}
          icon={Building2}
          hint={canOpenDepartments ? "manage in Settings" : "across the org"}
          href={canOpenDepartments ? DEPARTMENTS_HREF : undefined}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Search name, email, ID, title, department, role…"
            aria-label="Search employees"
            className="pl-9"
          />
        </div>
        {/* The one control that exists on nearly every page uses the shared component. Status and
            Role stay on the local `FilterDropdown` — that is this page's own vocabulary. */}
        <DepartmentFilter
          value={dept}
          onChange={resetPage(setDept)}
          options={deptOptions}
          ariaLabel="Filter employees by department"
        />
        <FilterDropdown
          label="Status"
          value={status}
          onChange={(v) => resetPage(setStatus)(v as DirectoryStatus)}
          options={STATUSES.map((s) => ({
            value: s,
            label: STATUS_LABELS[s],
          }))}
        />

        <div className="flex items-center gap-2 sm:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              <Download className="size-4" /> Download
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportEmployeesPdf(filtered)}>
                <FileText className="size-4" /> PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportEmployeesCsv(filtered)}>
                <Sheet className="size-4" /> CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {can("employees:manage") ? (
            /* One split button, not two. The chevron shares the primary's fill and sits flush
               against it behind a hairline divider — an outline button gapped away from a filled
               one reads as an unrelated secondary action, which is what this looked like. */
            <div className="flex items-center">
              <Button
                data-tour="emp:invite"
                // Flush right edge, and no active nudge: the pair must not shear apart on press,
                // since only this half carries the base `active:translate-y-px`. With no chevron
                // beside it (project mode) it is a plain button again, so the right edge rounds.
                className={cn(
                  "active:translate-y-0",
                  canAddMonitored && "rounded-r-none",
                )}
                onClick={() => (addLeads ? setAddOpen(true) : setInviteOpen(true))}
              >
                <UserPlus className="size-4" />
                {addLeads ? "Add employee" : "Invite"}
              </Button>
              {/* The second action exists only where a managed agent runs. In `machine`/`both` the
                  mode decides which of the two leads — an org on managed devices still hires the
                  manager who needs a console. In `project` there is no second action to offer: a
                  no-login record cannot run the desktop agent, so the split button collapses to
                  one. */}
              {canAddMonitored ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      size="icon"
                      aria-label="More ways to add people"
                      className="rounded-l-none border-l border-primary-foreground/25"
                    />
                  }
                >
                  <ChevronDown className="size-4 transition-transform duration-150 group-aria-expanded/button:rotate-180" />
                </DropdownMenuTrigger>
                {/* `w-auto` because the popup defaults to `w-(--anchor-width)`, and this anchor is
                    a 32px chevron — which is what folded "Add without login…" onto two lines. */}
                <DropdownMenuContent align="end" className="w-auto min-w-52">
                  <DropdownMenuItem
                    className="gap-2 px-2 py-1.5 whitespace-nowrap"
                    onClick={() => (addLeads ? setInviteOpen(true) : setAddOpen(true))}
                  >
                    <UserPlus className="size-4" />
                    {addLeads ? "Invite with login…" : "Add without login…"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-4 divide-x rounded-xl border bg-card text-center sm:hidden">
        {[
          { label: "People", value: String(liveStats.total) },
          {
            label: "Active",
            value:
              liveStats.benched > 0
                ? `${liveStats.activeWorking}/${liveStats.total}`
                : String(liveStats.activeWorking),
          },
          { label: "Productivity", value: pct(liveStats.avgProductivity) },
          {
            label: "Departments",
            value: String(liveStats.departments),
            href: canOpenDepartments ? DEPARTMENTS_HREF : undefined,
          },
        ].map((s: { label: string; value: string; href?: string }) => (
          <div key={s.label} className="min-w-0 px-1 py-2">
            <dt className="truncate text-[11px] text-muted-foreground">
              {/* The phone strip's way to departments, as the card is on wider screens (PEOPLE-22). */}
              {s.href ? (
                <Link
                  href={s.href}
                  className="underline decoration-dotted underline-offset-2"
                  aria-label={`${s.label}: manage in Settings`}
                >
                  {s.label}
                </Link>
              ) : (
                s.label
              )}
            </dt>
            <dd className="font-display text-lg font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {incomplete ? (
        // A short roster is said, not shown as the whole org (WP-230).
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm"
        >
          <span>
            Part of your organization couldn&apos;t be loaded, so this list and its totals may be
            missing people.
          </span>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : null}

      {interruptedRun ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm"
        >
          <span>
            An invite run didn&apos;t finish: {interruptedRun.remaining.length} of{" "}
            {interruptedRun.total} {interruptedRun.total === 1 ? "address wasn't" : "addresses weren't"}{" "}
            sent before the page closed.
          </span>
          <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
            Review and send
          </Button>
        </div>
      ) : null}

      {hiddenMatches > 0 ? (
        // A search for someone benched or departed, under the default "Active", used to answer
        // "No employees match" with them sitting in a roster further down (PEOPLE-05).
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {hiddenMatches} more {hiddenMatches === 1 ? "person matches" : "people match"} with
          another status.
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => resetPage(setStatus)("all")}
          >
            Show all statuses
          </Button>
        </p>
      ) : null}

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
            // The table's own container scrolls — named and focusable, so the columns past the edge
            // are reachable by keyboard (PEOPLE-14). The extra scrolling wrapper here was a second,
            // unfocusable scroll region around it.
            <div data-tour="emp:roster">
              <Table scrollLabel="Employees">
                <TableHeader>
                  <TableRow>
                    {/* Sortable columns (PEOPLE-04): a click sorts, a second click reverses. */}
                    <SortableHead label="Employee" sortKey="name" sort={sort} onSort={sortBy} />
                    <SortableHead label="Role" sortKey="role" sort={sort} onSort={sortBy} />
                    {/* Below sm only Employee, Role and the menu fit at 390 px — the menu used to sit
                        off-screen behind a sideways scroll nothing hinted at (UX audit XC-05). The
                        department moves under the name there; productivity is on the profile. */}
                    <SortableHead
                      label="Department"
                      sortKey="department"
                      sort={sort}
                      onSort={sortBy}
                      className="hidden sm:table-cell"
                    />
                    <SortableHead
                      label="Productivity"
                      sortKey="productivity"
                      sort={sort}
                      onSort={sortBy}
                      className="hidden w-40 sm:table-cell"
                    />
                    {canManage && <TableHead className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer"
                      // The whole row stays clickable for the mouse; the name below is the real
                      // link, so a keyboard user can reach the profile too (QA audit 2026-10-08,
                      // WP-461 — the row was a mouse-only `onClick`).
                      onClick={() => router.push(`/employees/${e.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            userId={e.id}
                            name={e.name}
                            className="size-8"
                            fallbackClassName="text-xs"
                          />
                          {/* Capped on phones so a long title truncates instead of widening the
                              table past the screen and pushing the row menu out of reach (XC-05). */}
                          <div className="max-w-[40vw] min-w-0 sm:max-w-none">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/employees/${e.id}`}
                                onClick={(ev) => ev.stopPropagation()}
                                className="truncate font-medium hover:underline focus-visible:underline"
                              >
                                {e.name}
                              </Link>
                              {/* "Cannot sign in" and "invited, hasn't accepted yet" look identical
                                  in this roster and mean opposite things — this is the difference. */}
                              {e.monitored && (
                                <Badge variant="outline" className="shrink-0 text-[10px]">
                                  Monitored
                                </Badge>
                              )}
                              {/* Every non-active row says so — leavers sat unlabelled among
                                  everyone else under "All statuses" (PEOPLE-05). */}
                              {e.status === "deactivated" ? (
                                <Badge className="bg-destructive/12 text-destructive shrink-0 text-[10px]">
                                  Deactivated
                                </Badge>
                              ) : e.benched ? (
                                // "Not tracked", like the status filter: "Inactive" is what the
                                // profile calls a deactivated leaver — the opposite (WP-233).
                                <Badge className="bg-warning/15 text-warning shrink-0 text-[10px]">
                                  Not tracked
                                </Badge>
                              ) : null}
                            </div>
                            {/* Subtitle: the human employee id (e.g. EMP-0001) is the directory's
                                stable identifier — lead with it, then the job title. The raw
                                Cognito UUID is never shown. */}
                            {(e.empId || e.jobTitle) && (
                              <p className="truncate text-xs text-muted-foreground">
                                {e.empId ? (
                                  <span className="font-mono tabular-nums">{e.empId}</span>
                                ) : null}
                                {e.empId && e.jobTitle ? " · " : ""}
                                {e.jobTitle}
                              </p>
                            )}
                            {e.department ? (
                              <p className="text-muted-foreground truncate text-xs sm:hidden">
                                {e.department}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.roleName}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground hidden sm:table-cell"
                        title={e.department ? undefined : "No department"}
                      >
                        {e.department || "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <ProductivityCell value={e.productivityScore} status={scoreStatus} />
                      </TableCell>
                      {canManage && (
                        // Stop the row's navigate-to-profile click when using the menu.
                        <TableCell
                          className="text-right"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          {/* Tracking is for current people — a leaver shown under "All statuses"
                              or "Deactivated" has no tracking to stop or start. */}
                          {e.status === "active" ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  // An icon-only trigger had no name — "button", six times (WP-461).
                                  aria-label={`Actions for ${e.name}`}
                                />
                              }
                            >
                              <MoreVertical className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-auto min-w-[11rem]">
                              <DropdownMenuItem onClick={() => onToggleBench(e)}>
                                {e.benched ? (
                                  <>
                                    <UserCheck className="size-4" /> Start tracking
                                  </>
                                ) : (
                                  <>
                                    <UserMinus className="size-4" /> Stop tracking
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          ) : null}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination, with a page-size choice (PEOPLE-04). */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Rows per page
          <Select
            value={pageSizeParam}
            onValueChange={(v) => resetPage(setPageSize)(String(v) as PageSize)}
          >
            <SelectTrigger size="sm" className="w-20" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <TablePagination
          page={safePage}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>

      {/* Inactive — a dedicated roster of inactive (benched) employees. Renders nothing when the
          list is empty; inactive people are excluded from Attendance + Time-Tracking (filtered in
          those hooks). Managers get an inline "Mark active" here without hunting the main table. */}
      {showBenchRoster && benchedEmployees.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <UserMinus className="size-4 text-warning" />
              <h3 className="text-sm font-semibold">Not tracked</h3>
              <Badge className="bg-warning/15 text-warning">
                {benchedEmployees.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Still employed and still able to sign in &mdash; just excluded from attendance and
              time tracking. Different from deactivated, which ends their access.
            </p>
            <div className="divide-y">
              {benchRoster.shown.map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-2">
                  <UserAvatar
                    userId={e.id}
                    name={e.name}
                    className="size-8"
                    fallbackClassName="text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.empId ? (
                        <span className="font-mono tabular-nums">{e.empId}</span>
                      ) : null}
                      {e.empId && e.department ? " · " : ""}
                      {e.department}
                    </p>
                  </div>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleBench(e)}
                    >
                      <UserCheck className="size-4" /> Start tracking
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {benchedEmployees.length > ROSTER_PAGE_SIZE ? (
              <TablePagination
                page={benchRoster.page}
                pageCount={benchRoster.pageCount}
                total={benchedEmployees.length}
                pageSize={ROSTER_PAGE_SIZE}
                onPageChange={(p) => setBenchPageParam(String(p + 1))}
                className="border-t pt-3"
              />
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Deactivated — its own roster, deliberately NOT merged with the bench above.
          They read as similar and are not: a benched person still signs in, a deactivated one
          cannot. Until this existed they had nowhere to be — no filter, no section — so a
          deactivated person sat unlabelled in "All statuses" and Reactivate was reachable only by
          knowing their profile URL. Reactivating restores access, so it is a link to the profile
          (where the confirmation lives) rather than an inline one-click. */}
      {showDeactivatedRoster && deactivatedEmployees.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <UserX className="size-4 text-destructive" />
              <h3 className="text-sm font-semibold">Deactivated</h3>
              <Badge className="bg-destructive/15 text-destructive">
                {deactivatedEmployees.length}
              </Badge>
            </div>
            {/* "Reassigned" was untrue: deactivation unassigns their tasks and gives them to no one
                — what the deactivate dialog has said since PEOPLE-01. */}
            <p className="text-xs text-muted-foreground">
              Their sign-in is disabled and their tasks were unassigned. They stay in the directory
              so their records survive &mdash; open one to reactivate.
            </p>
            <div className="divide-y">
              {leaverRoster.shown.map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-2">
                  <UserAvatar
                    userId={e.id}
                    name={e.name}
                    className="size-8 opacity-60"
                    fallbackClassName="text-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.empId ? (
                        <span className="font-mono tabular-nums">{e.empId}</span>
                      ) : null}
                      {e.empId && e.department ? " · " : ""}
                      {e.department}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/employees/${e.id}`} />}
                    nativeButton={false}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
            {deactivatedEmployees.length > ROSTER_PAGE_SIZE ? (
              <TablePagination
                page={leaverRoster.page}
                pageCount={leaverRoster.pageCount}
                total={deactivatedEmployees.length}
                pageSize={ROSTER_PAGE_SIZE}
                onPageChange={(p) => setLeaverPageParam(String(p + 1))}
                className="border-t pt-3"
              />
            ) : null}
          </CardContent>
        </Card>
      )}

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

"use client";

import { useMemo, useState } from "react";
import { DepartmentFilter } from "@/components/shared/department-filter";
import { useRouter } from "next/navigation";
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
  UserMinus,
  UserX,
  MoreVertical,
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
import { InviteDialog } from "./invite-dialog";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { PendingInvites } from "./pending-invites";
import { useEmployees, type EmployeeRow } from "../use-employees";
import { buildPdf } from "../lib/pdf-text";
import { toCsv } from "@/lib/csv";

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
 */
const STATUSES = ["all", "active", "benched", "deactivated"] as const;
const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  all: "All statuses",
  active: "Active",
  benched: "Not tracked",
  deactivated: "Deactivated",
};
const PAGE_SIZE = 9;

/** The department filter's value for people with no department (a name can't be empty). */
const NO_DEPARTMENT = "__none__";

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
  // The header describes the rows in this file. It used to put the filtered row count beside
  // org-wide totals — "12 employees · 87 active" for one department (WP-456).
  const active = list.filter((e) => e.status === "active").length;
  const scored = list.filter((e) => e.productivityScore !== null);
  const avgProductivity = scored.length
    ? Math.round(scored.reduce((s, e) => s + (e.productivityScore ?? 0), 0) / scored.length)
    : null;
  try {
    // Every string through the `PdfText` writer: one character the standard font can't encode
    // garbled the whole line, and a name in another script printed as gaps (WP-225).
    const doc = await buildPdf((text) => {
      const doc = new jsPDF();
      const t = text(doc);
      doc.setFontSize(18);
      t.text("Employee Report", 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(120);
      t.text(
        `${list.length} employees · ${active} active · ${pct(avgProductivity)} avg productivity · WorkPulse`,
        14,
        25,
      );

      const xs = [14, 92, 140, 178];
      let y = 36;
      doc.setTextColor(20);
      doc.setFont("helvetica", "bold");
      ["Name", "Department", "Status", "Prod %"].forEach((c, i) => t.text(c, xs[i], y));
      doc.setDrawColor(210);
      doc.line(14, y + 2, 196, y + 2);
      doc.setFont("helvetica", "normal");
      y += 8;

      for (const e of list) {
        t.text(e.name, xs[0], y);
        t.text(e.department || "—", xs[1], y);
        t.text(e.status, xs[2], y);
        t.text(pct(e.productivityScore), xs[3], y);
        y += 7;
        if (y > 285) {
          doc.addPage();
          y = 18;
        }
      }
      return doc;
    });
    doc.save("employees-report.pdf");
    toast.success("Report exported", {
      description: `employees-report.pdf · ${list.length} people`,
    });
  } catch {
    toast.error("Couldn't build the PDF. Try again.");
  }
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
    const total = allEmployees.length;
    const active = allEmployees.filter((e) => e.status === "active").length;
    // Benched people are still employees but aren't actively working — so the "Active" tile counts
    // active-and-not-benched, shown as "N / total" so the bench is visible at a glance.
    const benched = allEmployees.filter((e) => e.benched).length;
    const activeWorking = allEmployees.filter((e) => e.status === "active" && !e.benched).length;
    // Average only over rows that actually have a score. None do yet (productivity needs the agent),
    // so this is `null` → the stat card shows "—" instead of a fake 0%.
    const scored = allEmployees.filter((e) => e.productivityScore !== null);
    const avgProductivity = scored.length
      ? Math.round(
          scored.reduce((s, e) => s + (e.productivityScore ?? 0), 0) / scored.length,
        )
      : null;
    // The org's own department count. Counting distinct labels on people made "no department" a
    // department and missed the empty ones (WP-111); that count is only the fallback now.
    const departments =
      departmentCount ?? new Set(allEmployees.map((e) => e.department).filter(Boolean)).size;
    return { total, active, activeWorking, benched, avgProductivity, departments };
  }, [allEmployees, departmentCount]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEmployees.filter((e) => {
      if (dept === NO_DEPARTMENT ? e.department !== "" : dept !== "all" && e.department !== dept)
        return false;
      // "benched" (surfaced as "Inactive") is an orthogonal flag, not a lifecycle status. Filter on
      // it directly, and keep it out of "Active" so the two filters stay mutually exclusive.
      if (status === "deactivated") {
        if (e.status !== "deactivated") return false;
      } else if (status === "benched") {
        if (!e.benched) return false;
      } else if (status === "active") {
        if (e.status !== "active" || e.benched) return false;
      }
      if (
        q &&
        !`${e.name} ${e.jobTitle} ${e.empId ?? ""} ${e.id}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [allEmployees, query, dept, status]);

  // Publish the directory's on-screen figures + active filters to the assistant, so a question about
  // "these people" resolves against the same roster/counts the user is looking at.
  useAssistantPageContext({
    facts: [
      { label: "Total employees", value: String(liveStats.total) },
      { label: "Active (not benched)", value: String(liveStats.activeWorking) },
      { label: "On bench", value: String(liveStats.benched) },
      { label: "Departments", value: String(liveStats.departments) },
      ...(liveStats.avgProductivity !== null
        ? [{ label: "Avg productivity", value: `${liveStats.avgProductivity}%` }]
        : []),
      ...(dept !== "all"
        ? [{ label: "Department filter", value: dept === NO_DEPARTMENT ? "No department" : dept }]
        : []),
      ...(status !== "all" ? [{ label: "Status filter", value: status }] : []),
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const canManage = can("employees:manage");
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
          value={
            liveStats.benched > 0
              ? `${liveStats.activeWorking} / ${liveStats.total}`
              : liveStats.activeWorking
          }
          icon={UserCheck}
          hint={
            liveStats.benched > 0
              ? `${liveStats.benched} inactive`
              : "not deactivated"
          }
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
        <StatCard label="Departments" value={liveStats.departments} icon={Building2} hint="across the org" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Search by name, ID, or title…"
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
          onChange={resetPage(setStatus)}
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
                          <div className="min-w-0">
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
                              {e.benched && (
                                // "Not tracked", like the status filter: "Inactive" is what the
                                // profile calls a deactivated leaver — the opposite (WP-233).
                                <Badge className="bg-warning/15 text-warning shrink-0 text-[10px]">
                                  Not tracked
                                </Badge>
                              )}
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
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.roleName}
                      </TableCell>
                      <TableCell
                        className="text-muted-foreground"
                        title={e.department ? undefined : "No department"}
                      >
                        {e.department || "—"}
                      </TableCell>
                      <TableCell>
                        <ProductivityCell value={e.productivityScore} status={scoreStatus} />
                      </TableCell>
                      {canManage && (
                        // Stop the row's navigate-to-profile click when using the menu.
                        <TableCell
                          className="text-right"
                          onClick={(ev) => ev.stopPropagation()}
                        >
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

      {/* Inactive — a dedicated roster of inactive (benched) employees. Renders nothing when the
          list is empty; inactive people are excluded from Attendance + Time-Tracking (filtered in
          those hooks). Managers get an inline "Mark active" here without hunting the main table. */}
      {benchedEmployees.length > 0 && (
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
              Still employed and still able to sign in &mdash; just excluded from Attendance and
              Time-Tracking. Different from deactivated, which ends their access.
            </p>
            <div className="divide-y">
              {benchedEmployees.map((e) => (
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
          </CardContent>
        </Card>
      )}

      {/* Deactivated — its own roster, deliberately NOT merged with the bench above.
          They read as similar and are not: a benched person still signs in, a deactivated one
          cannot. Until this existed they had nowhere to be — no filter, no section — so a
          deactivated person sat unlabelled in "All statuses" and Reactivate was reachable only by
          knowing their profile URL. Reactivating restores access, so it is a link to the profile
          (where the confirmation lives) rather than an inline one-click. */}
      {deactivatedEmployees.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <UserX className="size-4 text-destructive" />
              <h3 className="text-sm font-semibold">Deactivated</h3>
              <Badge className="bg-destructive/15 text-destructive">
                {deactivatedEmployees.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Their sign-in is disabled and their work has been reassigned. They stay in the
              directory so the record survives &mdash; open one to reactivate.
            </p>
            <div className="divide-y">
              {deactivatedEmployees.map((e) => (
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

"use client";

import { useMemo, useState } from "react";
import {
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Search,
  UserRound,
  Users2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initials } from "@/lib/format";
import type {
  ProjectTimesheet,
  TeamMemberTime,
  TimesheetStatus,
} from "@/lib/mock-time";
import { cn } from "@/lib/utils";
import { ActivityDialog, type ActivityView } from "./timesheet-detail";

const STATUS_META: Record<
  TimesheetStatus,
  { label: string; className: string }
> = {
  approved: { label: "Approved", className: "bg-success/12 text-success" },
  pending: { label: "Pending", className: "bg-warning/15 text-warning" },
  flagged: { label: "Flagged", className: "bg-destructive/12 text-destructive" },
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_FULL = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];
const STATUS_FILTERS: { value: "all" | TimesheetStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "flagged", label: "Flagged" },
];
/** Relative weekday load Mon→Sun (weekends light). */
const WEEKDAY_WEIGHT = [1, 1.05, 0.95, 1.02, 0.9, 0.28, 0.12];

/** Fixed week anchor (matches the seed; never Date.now()). */
const WEEK_ANCHOR = "2026-06-23T00:00:00Z";

type GroupBy = "person" | "project";

interface GridRow {
  id: string;
  name: string;
  subtitle: string;
  department: string;
  avatarUrl?: string;
  isProject: boolean;
  badge?: string;
  total: number;
  status: TimesheetStatus;
}

/* ------------------------------ date utils ------------------------------ */

function mondayOf(iso: string): Date {
  const d = new Date(iso);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  d.setUTCDate(d.getUTCDate() - dow);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Decimal hours → "H:MM" (or em dash for zero). */
function fmtHM(hours: number): string {
  if (hours <= 0) return "—";
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function seedOf(id: string): number {
  return [...id].reduce((s, c) => s + c.charCodeAt(0), 0);
}

/** Spread a weekly total across Mon→Sun deterministically (weekends light). */
function distribute(total: number, seed: number, offset: number): number[] {
  const weights = WEEKDAY_WEIGHT.map(
    (w, i) => w * (0.82 + ((seed + i * 7 + offset * 13) % 36) / 100),
  );
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => Math.round((w / sum) * total * 100) / 100);
}

/* ------------------------------ component ------------------------------- */

export function TimesheetGrid({
  personRows,
  projectRows,
  canApprove,
}: {
  personRows: TeamMemberTime[];
  projectRows: ProjectTimesheet[];
  canApprove: boolean;
}) {
  const [group, setGroup] = useState<GroupBy>("person");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TimesheetStatus>(
    "all",
  );
  const [deptFilter, setDeptFilter] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, TimesheetStatus>>({});
  const [selection, setSelection] = useState<
    { rowId: string; kind: "day"; dayIndex: number } | { rowId: string; kind: "week" } | null
  >(null);

  const monday = useMemo(
    () => addDays(mondayOf(WEEK_ANCHOR), weekOffset * 7),
    [weekOffset],
  );
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday],
  );

  const weekRange = (() => {
    const a = dates[0];
    const b = dates[6];
    const m0 = MONTHS[a.getUTCMonth()];
    const m1 = MONTHS[b.getUTCMonth()];
    const sameMonth = a.getUTCMonth() === b.getUTCMonth();
    return sameMonth
      ? `${m0} ${a.getUTCDate()} – ${b.getUTCDate()}, ${b.getUTCFullYear()}`
      : `${m0} ${a.getUTCDate()} – ${m1} ${b.getUTCDate()}, ${b.getUTCFullYear()}`;
  })();

  const baseRows: GridRow[] = useMemo(() => {
    if (group === "person") {
      return personRows.map((r) => ({
        id: r.id,
        name: r.name,
        subtitle: r.department,
        department: r.department,
        avatarUrl: r.avatarUrl,
        isProject: false,
        total: r.trackedHrs,
        status: r.status,
      }));
    }
    return projectRows.map((p) => ({
      id: p.id,
      name: p.name,
      subtitle: `${p.members} members · ${p.department}`,
      department: p.department,
      isProject: true,
      badge: p.key,
      total: p.trackedHrs,
      status: p.status,
    }));
  }, [group, personRows, projectRows]);

  // Team = department, for the team filter.
  const departments = useMemo(
    () => Array.from(new Set(baseRows.map((r) => r.department))).sort(),
    [baseRows],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = baseRows.filter((r) => {
      if (deptFilter !== "all" && r.department !== deptFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.badge?.toLowerCase().includes(q) ?? false)
      );
    });

    return matched
      .map((r) => {
        const days = distribute(r.total, seedOf(r.id), weekOffset);
        const total = days.reduce((s, h) => s + h, 0);
        const status = overrides[r.id] ?? r.status;
        return { ...r, days, total, status };
      })
      .filter((r) => statusFilter === "all" || r.status === statusFilter)
      .sort((a, b) => b.total - a.total);
  }, [baseRows, query, deptFilter, statusFilter, weekOffset, overrides]);

  const hasFilters =
    deptFilter !== "all" || statusFilter !== "all" || query.trim() !== "";
  const clearFilters = () => {
    setDeptFilter("all");
    setStatusFilter("all");
    setQuery("");
  };

  const colTotals = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    for (const r of rows) r.days.forEach((h, i) => (totals[i] += h));
    return totals;
  }, [rows]);
  const grandTotal = colTotals.reduce((s, h) => s + h, 0);
  const approved = rows.filter((r) => r.status === "approved").length;

  const approve = (row: (typeof rows)[number]) => {
    setOverrides((o) => ({ ...o, [row.id]: "approved" }));
    toast.success("Timesheet approved", {
      description: `${row.name} · ${fmtHM(row.total)} this week`,
    });
  };

  // Resolve the open drill-down (day or week) from the current rows.
  const activeView: ActivityView | null = (() => {
    if (!selection) return null;
    const row = rows.find((r) => r.id === selection.rowId);
    if (!row) return null;
    const base = {
      rowId: row.id,
      name: row.name,
      subtitle: row.subtitle,
      isProject: row.isProject,
      status: row.status,
    };
    if (selection.kind === "day") {
      const d = dates[selection.dayIndex];
      return {
        ...base,
        kind: "day",
        dayIndex: selection.dayIndex,
        hours: row.days[selection.dayIndex],
        dateLabel: `${DAY_FULL[selection.dayIndex]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
      };
    }
    return { ...base, kind: "week", weekRange, days: row.days };
  })();

  return (
    <Card className="overflow-hidden p-0">
      {/* Toolbar: week nav + unified filter bar */}
      <div className="flex flex-col gap-3 border-b p-4 sm:p-5">
        {/* Row 1: week nav + all filters in one bar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border p-0.5">
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w - 1)}
                aria-label="Previous week"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => w + 1)}
                aria-label="Next week"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="ml-1 leading-tight">
              <p className="font-heading text-base font-semibold">
                {weekOffset === 0 ? "This Week" : "Week of"}
              </p>
              <p className="text-xs text-muted-foreground">{weekRange}</p>
            </div>
            {weekOffset !== 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="ml-2 h-8 gap-1.5"
                onClick={() => setWeekOffset(0)}
              >
                <CalendarCheck className="size-4" />
                Today
              </Button>
            ) : null}
          </div>

          {/* Unified filter bar: group toggle + status + dept + search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Group toggle */}
            <div className="inline-flex items-center gap-0.5 rounded-md border bg-card p-0.5">
              <FilterTab
                active={group === "person"}
                onClick={() => setGroup("person")}
                icon={UserRound}
                label="Employees"
              />
              <FilterTab
                active={group === "project"}
                onClick={() => setGroup("project")}
                icon={FolderKanban}
                label="Projects"
              />
            </div>

            {/* Status pills */}
            <div className="flex items-center gap-1">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatusFilter(s.value)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    statusFilter === s.value
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Team (department) filter */}
            <Select
              value={deptFilter}
              onValueChange={(v) => setDeptFilter(v as string)}
            >
              <SelectTrigger
                aria-label="Filter by team"
                className="h-8 min-w-[9rem] gap-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Users2 className="size-4 shrink-0 text-muted-foreground" />
                  <SelectValue>
                    {(value) =>
                      value === "all" || value == null
                        ? "All teams"
                        : String(value)
                    }
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent className="min-w-44">
                <SelectItem value="all">All teams</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative min-w-[12rem]">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  group === "person"
                    ? "Search employees…"
                    : "Search projects…"
                }
                className="h-8 pl-8"
              />
            </div>
          </div>
        </div>

        {/* Summary line */}
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{approved}</span> of{" "}
          {rows.length} {group === "person" ? "employees" : "projects"} approved
          ·{" "}
          <span className="font-medium text-foreground">{fmtHM(grandTotal)}</span>{" "}
          total
        </p>

        {/* Active filter tags */}
        {hasFilters ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Filters:</span>
            {deptFilter !== "all" ? (
              <FilterTagChip
                label={`Team: ${deptFilter}`}
                onClear={() => setDeptFilter("all")}
              />
            ) : null}
            {statusFilter !== "all" ? (
              <FilterTagChip
                label={`Status: ${STATUS_META[statusFilter as TimesheetStatus].label}`}
                onClear={() => setStatusFilter("all")}
              />
            ) : null}
            {query.trim() ? (
              <FilterTagChip
                label={`Search: ${query.trim()}`}
                onClear={() => setQuery("")}
              />
            ) : null}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="sticky left-0 z-10 bg-muted/30 px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group === "person" ? "Employee" : "Project"}
              </th>
              {DAY_LABELS.map((d, i) => (
                <th
                  key={d}
                  className={cn(
                    "px-2 py-2 text-center text-xs font-semibold tracking-wide text-muted-foreground",
                    i >= 5 && "bg-muted/50",
                  )}
                >
                  <span className="block">{d}</span>
                  <span className="block text-[0.7rem] font-normal text-muted-foreground/70 tabular-nums">
                    {dates[i].getUTCDate()}
                  </span>
                </th>
              ))}
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Total
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  No matches for “{query}”.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const meta = STATUS_META[r.status];
                return (
                  <tr
                    key={r.id}
                    className="border-b transition-colors last:border-b-0 hover:bg-muted/30"
                  >
                    {/* Entity */}
                    <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        {r.isProject ? (
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-feature-tint text-primary">
                            <FolderKanban className="size-4" />
                          </span>
                        ) : (
                          <Avatar className="size-8">
                            <AvatarImage src={r.avatarUrl} alt={r.name} />
                            <AvatarFallback className="text-xs">
                              {initials(r.name)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium">
                            {r.badge ? (
                              <span className="rounded bg-accent px-1 font-mono text-[0.65rem] font-semibold text-accent-foreground">
                                {r.badge}
                              </span>
                            ) : null}
                            {r.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            <span className="font-mono text-[0.65rem] text-muted-foreground/70">
                              {r.isProject ? "PID" : "EID"} {r.id}
                            </span>{" "}
                            · {r.subtitle}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Day cells — click for daily activity */}
                    {r.days.map((h, i) => (
                      <td
                        key={i}
                        className={cn("p-0 text-center", i >= 5 && "bg-muted/20")}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelection({
                              rowId: r.id,
                              kind: "day",
                              dayIndex: i,
                            })
                          }
                          title="View daily activity"
                          className={cn(
                            "w-full px-2 py-2.5 font-mono tabular-nums transition-colors hover:bg-primary/10 hover:text-primary",
                            h <= 0
                              ? "text-muted-foreground/40"
                              : "text-foreground",
                          )}
                        >
                          {fmtHM(h)}
                        </button>
                      </td>
                    ))}

                    {/* Total — click for weekly activity */}
                    <td className="p-0 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setSelection({ rowId: r.id, kind: "week" })
                        }
                        title="View weekly activity"
                        className="w-full px-3 py-2.5 text-right font-mono font-semibold tabular-nums transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        {fmtHM(r.total)}
                      </button>
                    </td>

                    {/* Status / approve */}
                    <td className="px-4 py-2.5 text-right">
                      {canApprove && r.status !== "approved" ? (
                        <Button
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => approve(r)}
                        >
                          <Check className="size-3.5" />
                          Approve
                        </Button>
                      ) : (
                        <Badge className={meta.className}>{meta.label}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Totals footer */}
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <td className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-xs tracking-wide uppercase">
                  Total time
                </td>
                {colTotals.map((h, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-2 py-3 text-center font-mono tabular-nums",
                      i >= 5 && "bg-muted/50",
                    )}
                  >
                    {fmtHM(h)}
                  </td>
                ))}
                <td className="px-3 py-3 text-right font-mono tabular-nums text-primary">
                  {fmtHM(grandTotal)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <ActivityDialog view={activeView} onClose={() => setSelection(null)} />
    </Card>
  );
}

function FilterTagChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pr-1 pl-2 text-xs font-medium text-accent-foreground">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${label}`}
        className="rounded-full p-0.5 transition-colors hover:bg-foreground/10"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function FilterTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof UserRound;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

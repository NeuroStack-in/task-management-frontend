"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Search,
  UserRound,
  Users2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_WEEKS_BACK } from "../use-weekly-hours";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initials } from "@/lib/format";
import { useOrgHolidays } from "@/hooks/use-org-holidays";
import type {
  ProjectTimesheet,
  TeamMemberTime,
  TimesheetDayEntry,
  TimesheetStatus,
} from "../types";
import { cn } from "@/lib/utils";
import { ActivityDialog, type ActivityView } from "./timesheet-detail";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

type GroupBy = "person" | "project";

interface GridRow {
  id: string;
  name: string;
  subtitle: string;
  department: string;
  avatarUrl?: string;
  isProject: boolean;
  badge?: string;
  /** Real hours per weekday, Mon→Sun. */
  days: number[];
  /** Real per-day entries, Mon→Sun. */
  dayEntries: TimesheetDayEntry[][];
  total: number;
  status: TimesheetStatus;
}

/* ------------------------------ date utils ------------------------------ */

/** `YYYY-MM-DD` → its calendar parts (month is 0-based). */
function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

/** Decimal hours → "H:MM" (or em dash for zero). */
function fmtHM(hours: number): string {
  if (hours <= 0) return "—";
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

/* ------------------------------ component ------------------------------- */

export function TimesheetGrid({
  personRows,
  projectRows,
  dates,
  weekLabel,
  weekOffset,
  onWeekOffsetChange,
}: {
  personRows: TeamMemberTime[];
  projectRows: ProjectTimesheet[];
  /** The 7 iso dates (Mon→Sun) the rows' `days`/`dayEntries` align to. */
  dates: string[];
  /** Human range for the selected week, from the hook. */
  weekLabel: string;
  /** 0 = this week, −1 = last week, … */
  weekOffset: number;
  onWeekOffsetChange: (offset: number) => void;
}) {
  const [group, setGroup] = useState<GroupBy>("person");
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const holidays = useOrgHolidays();
  const [selection, setSelection] = useState<
    | { rowId: string; kind: "day"; dayIndex: number }
    | { rowId: string; kind: "week" }
    | null
  >(null);

  const weekRange = weekLabel;

  const baseRows: GridRow[] = useMemo(() => {
    if (group === "person") {
      return personRows.map((r) => ({
        id: r.id,
        name: r.name,
        subtitle: r.department,
        department: r.department,
        avatarUrl: r.avatarUrl,
        isProject: false,
        days: r.days,
        dayEntries: r.dayEntries,
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
      days: p.days,
      dayEntries: p.dayEntries,
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
        // Real per-day hours; the total is their sum, not a separately-carried number.
        const total = Math.round(r.days.reduce((s, h) => s + h, 0) * 100) / 100;
        return { ...r, total };
      })
      .sort((a, b) => b.total - a.total);
  }, [baseRows, query, deptFilter]);

  const hasFilters = deptFilter !== "all" || query.trim() !== "";
  const clearFilters = () => {
    setDeptFilter("all");
    setQuery("");
  };

  const colTotals = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    for (const r of rows) r.days.forEach((h, i) => (totals[i] += h));
    return totals;
  }, [rows]);
  const grandTotal = colTotals.reduce((s, h) => s + h, 0);

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
      const d = parseIso(dates[selection.dayIndex]);
      return {
        ...base,
        kind: "day",
        hours: row.days[selection.dayIndex],
        entries: row.dayEntries[selection.dayIndex] ?? [],
        dateLabel: `${DAY_FULL[selection.dayIndex]}, ${MONTHS[d.m]} ${d.d}`,
      };
    }
    return {
      ...base,
      kind: "week",
      weekRange,
      days: row.days,
      entriesByDay: row.dayEntries,
    };
  })();

  return (
    <Card className="overflow-hidden p-0 [--card-spacing:0px]">
      {/* Toolbar: week nav + filter + search */}
      <div className="flex flex-col gap-4 border-b p-4 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Week stepper. The per-user endpoints take an arbitrary from/to, so any week is
              readable; stepping re-runs the fan-out for that range. Forward is capped at the
              current week — a future week has no records and would only ever render dashes. */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Previous week"
                onClick={() =>
                  onWeekOffsetChange(Math.max(-MAX_WEEKS_BACK, weekOffset - 1))
                }
                disabled={weekOffset <= -MAX_WEEKS_BACK}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                aria-label="Next week"
                onClick={() => onWeekOffsetChange(Math.min(0, weekOffset + 1))}
                disabled={weekOffset === 0}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="leading-tight">
              <p className="font-heading text-base font-semibold">
                {weekOffset === 0
                  ? "This Week"
                  : weekOffset === -1
                    ? "Last Week"
                    : `${-weekOffset} weeks ago`}
              </p>
              <p className="text-muted-foreground text-xs">{weekRange}</p>
            </div>
            {weekOffset !== 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onWeekOffsetChange(0)}
              >
                Today
              </Button>
            ) : null}
          </div>

          {/* Filter + search */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="bg-card shadow-soft inline-flex items-center gap-0.5 rounded-full border p-0.5">
              <FilterTab
                active={group === "person"}
                onClick={() => setGroup("person")}
                icon={UserRound}
                label="By employee"
              />
              <FilterTab
                active={group === "project"}
                onClick={() => setGroup("project")}
                icon={FolderKanban}
                label="By project"
              />
            </div>
            {/* Team (department) filter */}
            <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v as string)}>
              <SelectTrigger
                aria-label="Filter by department"
                className="h-9 w-full gap-2 sm:w-44"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Users2 className="text-muted-foreground size-4 shrink-0" />
                  <SelectValue>
                    {(value) =>
                      value === "all" || value == null ? "All departments" : String(value)
                    }
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent className="min-w-44">
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative sm:w-56">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  group === "person"
                    ? "Search employees or ID…"
                    : "Search projects or ID…"
                }
                className="pl-8"
              />
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {hasFilters ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-xs">Filters:</span>
            {deptFilter !== "all" ? (
              <FilterTagChip
                label={`Department: ${deptFilter}`}
                onClear={() => setDeptFilter("all")}
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
              className="text-primary text-xs font-medium hover:underline"
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
            <tr className="bg-muted/30 border-b">
              <th className="bg-muted/30 text-muted-foreground sticky left-0 z-10 px-4 py-2.5 text-left align-middle text-xs font-semibold tracking-wide uppercase">
                {group === "person" ? "Employee" : "Project"}
              </th>
              {DAY_LABELS.map((d, i) => {
                const holidayName = dates[i] ? holidays.nameFor(dates[i]) : undefined;
                return (
                  <th
                    key={d}
                    className={cn(
                      "text-muted-foreground px-2 py-2.5 text-center align-middle text-xs font-semibold tracking-wide",
                      i >= 5 && "bg-muted/50",
                    )}
                    title={holidayName ? `Holiday: ${holidayName}` : undefined}
                  >
                    <span className="block">{d}</span>
                    <span className="text-muted-foreground/70 block text-[0.7rem] font-normal tabular-nums">
                      {parseIso(dates[i]).d}
                    </span>
                    {holidayName ? (
                      <span className="text-primary mt-0.5 block text-[0.6rem] font-medium normal-case">
                        Holiday
                      </span>
                    ) : null}
                  </th>
                );
              })}
              <th className="text-muted-foreground px-3 py-2.5 text-center align-middle text-xs font-semibold tracking-wide uppercase">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="text-muted-foreground px-4 py-12 text-center text-sm"
                >
                  {/* An empty grid means "nobody tracked time" far more often than "your search
                      missed" now that past weeks are reachable — saying "no matches for ''" for a
                      quiet week reads as a broken filter. */}
                  {hasFilters
                    ? query.trim()
                      ? `No matches for “${query.trim()}”.`
                      : "No one matches this filter."
                    : "No tracked time in this week."}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-muted/30 border-b transition-colors last:border-b-0"
                >
                  {/* Entity */}
                  <td className="bg-card sticky left-0 z-10 px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      {r.isProject ? (
                        <span className="bg-feature-tint text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
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
                            <span className="bg-accent text-accent-foreground rounded px-1 font-mono text-[0.65rem] font-semibold">
                              {r.badge}
                            </span>
                          ) : null}
                          {r.name}
                        </p>
                        {/* No raw id here — it's an opaque UUID (Cognito sub / project id), not a
                              human-facing code. The project key shows as the badge above. */}
                        <p className="text-muted-foreground truncate text-xs">
                          {r.subtitle}
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
                          "hover:bg-primary/10 hover:text-primary w-full px-2 py-2.5 font-mono tabular-nums transition-colors",
                          h <= 0 ? "text-muted-foreground/40" : "text-foreground",
                        )}
                      >
                        {fmtHM(h)}
                      </button>
                    </td>
                  ))}

                  {/* Total — click for weekly activity */}
                  <td className="p-0 text-center">
                    <button
                      type="button"
                      onClick={() => setSelection({ rowId: r.id, kind: "week" })}
                      title="View weekly activity"
                      className="hover:bg-primary/10 hover:text-primary w-full px-3 py-2.5 text-center font-mono font-semibold tabular-nums transition-colors"
                    >
                      {fmtHM(r.total)}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Totals footer */}
          {rows.length > 0 ? (
            <tfoot>
              <tr className="bg-muted/40 border-t-2 font-semibold">
                <td className="bg-muted/40 sticky left-0 z-10 px-4 py-3 align-middle text-xs tracking-wide uppercase">
                  Total time
                </td>
                {colTotals.map((h, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-2 py-3 text-center align-middle font-mono tabular-nums",
                      i >= 5 && "bg-muted/50",
                    )}
                  >
                    {fmtHM(h)}
                  </td>
                ))}
                <td className="text-primary px-3 py-3 text-center align-middle font-mono tabular-nums">
                  {fmtHM(grandTotal)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <ActivityDialog view={activeView} onClose={() => setSelection(null)} />
    </Card>
  );
}

function FilterTagChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs font-medium">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${label}`}
        className="hover:bg-foreground/10 rounded-full p-0.5 transition-colors"
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
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
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

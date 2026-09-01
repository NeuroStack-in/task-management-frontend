"use client";

import { useMemo, useState } from "react";
import { DepartmentFilter } from "@/components/shared/department-filter";
import { useNow } from "@/hooks/use-now";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Download, FolderKanban, Search, UserRound, X } from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_WEEKS_BACK } from "../use-weekly-hours";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Card } from "@/components/ui/card";
import { useOrgHolidays } from "@/hooks/use-org-holidays";
import type {
  ProjectTimesheet,
  TeamMemberTime,
  TimesheetDayEntry,
  TimesheetStatus,
} from "../types";
import { formatHours } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Period } from "../use-team-timesheet";
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

/**
 * The pinned first column.
 *
 * **The background has to be opaque.** `sticky` does not remove a cell from the flow — the day
 * columns scroll *underneath* it — so a translucent fill lets them show through, and the header read
 * "EMPLOYEE" with `1 2 3 4 5 6 7 8 9` printed across it. The header and footer rows are tinted
 * (`bg-muted/30` and `/40` over the card), so the pinned cell cannot simply reuse that class; it
 * needs the *composited* colour as a solid. `color-mix` computes exactly that, which keeps the cell
 * indistinguishable from its row while remaining opaque.
 *
 * `border-r` is what makes it read as pinned rather than as a column that happens to be first.
 */
const STICKY_COL = "sticky left-0 z-10 border-r";
const STICKY_HEAD = "bg-[color-mix(in_oklab,var(--muted)_30%,var(--card))]";
const STICKY_FOOT = "bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))]";

/**
 * Per-day column width for a month, and the two columns that aren't days.
 *
 * The month table used to ask for `min-w-[1500px]`, which is **below its own min-content width**:
 * 31 day columns plus Employee and Total cannot fit 1500px when an `HH:MM:SS` cell needs ~66px and
 * that budget allots it ~37. Auto table layout therefore ignored the request and collapsed every
 * column onto its content, leaving no gutter at all — which is what made a month read as one
 * undifferentiated block of digits.
 *
 * **The notation is deliberately not the lever.** `lib/format.formatHours` documents `HH:MM:SS` as
 * the product's single duration notation, and says in as many words that dropping the seconds place
 * on some surface is the exact confusion it exists to end. So the columns are given the width the
 * format actually needs instead of the format being trimmed to fit the columns.
 *
 * Deriving the width from `dates.length` rather than hardcoding it keeps a 28-day February and a
 * 31-day March at the *same* column width; a fixed `min-w` would have stretched the short month.
 */
const MONTH_DAY_COL_PX = 88;
const MONTH_FIXED_COLS_PX = 380;

/**
 * A hairline between day columns — **month only**.
 *
 * Width alone does not finish the job: thirty-one columns of monospaced digits with nothing between
 * them still make the reader bin the numbers into columns by eye. A week's seven columns are far
 * enough apart to need no help, so this stays off there rather than adding chrome that view doesn't
 * benefit from. `border-collapse` merges this with the sticky column's `border-r`, so the first day
 * column gets one line, not two.
 */
const MONTH_DIVIDER = "border-l";

/**
 * The header for one column.
 *
 * A week shows the weekday, because seven of them are recognisable at a glance and the date below
 * disambiguates. A month cannot: thirty "MON/TUE/WED" repeats tell you nothing about *which*
 * Tuesday, so the weekday letter moves to the small line and the day number leads.
 */
function columnHeading(iso: string, period: Period): { top: string; sub: string } {
  const [, , d] = iso.split("-").map(Number);
  const dow = (new Date(`${iso}T00:00:00`).getDay() + 6) % 7; // Mon = 0
  return period === "month"
    ? { top: String(d), sub: DAY_LABELS[dow][0] }
    : { top: DAY_LABELS[dow], sub: String(d) };
}
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

/** Decimal hours → `HH:MM:SS` (or em dash for zero — an untracked cell is blank, not `00:00:00`). */
function fmtHM(hours: number): string {
  return hours <= 0 ? "—" : formatHours(hours);
}

/**
 * Extra hours from sessions still **running** in a day's entries — the live top-up over the settled
 * `days[i]`, so a cell (and every total derived from it) ticks in real time. Person rows carry the
 * session on each entry; project rows don't, so those stay at their settled hours.
 */
function runningHours(entries: TimesheetDayEntry[] | undefined, now: number): number {
  if (!entries) return 0;
  let sec = 0;
  for (const e of entries) {
    if (e.session?.running && typeof e.session.startMs === "number") {
      sec += Math.max(0, (now - e.session.startMs) / 1000);
    }
  }
  return sec / 3600;
}

/* ------------------------------ component ------------------------------- */

export function TimesheetGrid({
  personRows,
  projectRows,
  dates,
  weekLabel,
  weekOffset,
  onWeekOffsetChange,
  period,
  onPeriodChange,
}: {
  personRows: TeamMemberTime[];
  projectRows: ProjectTimesheet[];
  /**
   * The iso dates the rows' `days`/`dayEntries` align to — 7 for a week, 28-31 for a month.
   *
   * Everything derives from this array's length rather than assuming seven, which is what lets one
   * grid render both spans.
   */
  dates: string[];
  /** Human range for the selected period, from the hook. */
  weekLabel: string;
  /** 0 = this week/month, −1 = the previous one, … */
  weekOffset: number;
  onWeekOffsetChange: (offset: number) => void;
  period: Period;
  onPeriodChange: (p: Period) => void;
}) {
  const [group, setGroup] = useState<GroupBy>("person");
  const [query, setQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const holidays = useOrgHolidays();
  // Ticks the running sessions' live top-up (see runningHours) so open timers accrue in the grid.
  const now = useNow();
  const [selection, setSelection] = useState<
    | { rowId: string; kind: "day"; dayIndex: number }
    | { rowId: string; kind: "range" }
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
      // Sort by the SETTLED total so a live-accruing timer doesn't reshuffle rows every tick.
      .slice()
      .sort(
        (a, b) =>
          b.days.reduce((s, h) => s + h, 0) - a.days.reduce((s, h) => s + h, 0),
      )
      .map((r) => {
        // Per-day hours = settled `days[i]` + the live top-up of any session still running that day.
        // The total is their sum, not a separately-carried number, so every derived total is live too.
        const days = r.days.map((h, i) => h + runningHours(r.dayEntries[i], now));
        const total = Math.round(days.reduce((s, h) => s + h, 0) * 100) / 100;
        return { ...r, days, total };
      });
  }, [baseRows, query, deptFilter, now]);

  const hasFilters = deptFilter !== "all" || query.trim() !== "";

  /**
   * Download the grid as CSV — **exactly what is on screen**, not a fresh server query.
   *
   * That means the current period, grouping, department filter and search all carry into the file.
   * A download that quietly ignored the filters would hand you a different report from the one you
   * were looking at when you pressed the button, which is the worse surprise.
   *
   * Durations are `HH:MM:SS`, matching the grid — a file that said `6.8` beside a screen showing
   * `06:48:00` would reintroduce exactly the two-notation confusion the product just removed. Empty
   * days are written as `00:00:00` rather than the grid's em dash, because a spreadsheet has to be
   * able to sum the column and `—` is not a number.
   */
  const exportCsv = () => {
    const label = group === "person" ? "Employee" : "Project";
    const fields = [
      label,
      group === "person" ? "Department" : "Details",
      // ISO plus the weekday: the date sorts and is unambiguous, the weekday is what makes a
      // 31-column row readable without counting across.
      ...dates.map((iso) => `${iso} (${DAY_LABELS[(new Date(`${iso}T00:00:00`).getDay() + 6) % 7]})`),
      "Total",
    ];
    const data: string[][] = rows.map((r) => [
      r.name,
      r.subtitle,
      ...r.days.map((h) => formatHours(h)),
      formatHours(r.total),
    ]);
    // The totals row is part of the report, not chrome — a reader reconciling the file against the
    // screen needs the same bottom line.
    if (rows.length > 0) {
      data.push([
        "Total time",
        "",
        ...colTotals.map((h) => formatHours(h)),
        formatHours(grandTotal),
      ]);
    }
    const slug = weekRange.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    downloadBlob(
      new Blob([Papa.unparse({ fields, data })], { type: "text/csv;charset=utf-8;" }),
      `timesheet-${group === "person" ? "employees" : "projects"}-${slug}.csv`,
    );
    toast.success(`${period === "month" ? "Month" : "Week"} exported`, {
      description: `${weekRange} · ${rows.length} ${group === "person" ? "people" : "projects"}${hasFilters ? " (filtered)" : ""}`,
    });
  };

  const clearFilters = () => {
    setDeptFilter("all");
    setQuery("");
  };

  /**
   * Which columns are Sat/Sun, **by their real date**.
   *
   * The header already derived this correctly; the body cells and the totals footer did not — they
   * shaded on `i >= 5`, the raw column index. That is Sat/Sun only in a Monday-aligned week. In a
   * month it is whatever days 6 and 7 happen to be, so the header shaded one pair of columns while
   * the rows underneath shaded a different pair, and the stripe stopped meaning "weekend" at all.
   * One array, read by all three, is what keeps them from drifting apart again.
   */
  const weekendCols = useMemo(
    () => dates.map((iso) => (new Date(`${iso}T00:00:00`).getDay() + 6) % 7 >= 5),
    [dates],
  );

  const colTotals = useMemo(() => {
    // One slot per day column — `dates.length` (7 for a week, 28–31 for a month), not a hardcoded 7,
    // or a month's columns 8+ summed into `undefined` and the footer read "NaN:NaN".
    const totals = new Array(dates.length).fill(0) as number[];
    for (const r of rows) r.days.forEach((h, i) => (totals[i] += h));
    return totals;
  }, [rows, dates.length]);
  const grandTotal = colTotals.reduce((s, h) => s + h, 0);

  // Resolve the open drill-down (a single day, or the whole range) from the current rows.
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
        // Weekday from the actual date, not `dayIndex` — the index is a weekday only for a week; in a
        // month it's the day-of-month (0..30), which would read the wrong name (or `undefined`).
        dateLabel: `${DAY_FULL[(new Date(d.y, d.m, d.d).getDay() + 6) % 7]}, ${MONTHS[d.m]} ${d.d}`,
      };
    }
    return {
      ...base,
      kind: "range",
      rangeLabel: weekRange,
      // The dialog derives every weekday, weekend tint and hover label from these dates rather
      // than from the array index — the index is a weekday only in a Monday-aligned week.
      period,
      dates,
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
          {/* The week label sits BETWEEN the arrows, so the control reads as one stepper rather
              than two buttons with a caption beside them. */}
          {/* `shrink-0`: the stepper is the one thing here that must not compress. Everything that
              gives when the toolbar runs out of room is in the filter group, which wraps. */}
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              aria-label={period === "month" ? "Previous month" : "Previous week"}
              onClick={() =>
                onWeekOffsetChange(Math.max(-MAX_WEEKS_BACK, weekOffset - 1))
              }
              disabled={weekOffset <= -MAX_WEEKS_BACK}
            >
              <ChevronLeft className="size-4" />
            </Button>
            {/* Fixed minimum width: the label changes between "This Week" and "3 weeks ago", and
                without it the right arrow would shift sideways every time you page. */}
            <div className="min-w-[10.5rem] text-center leading-tight">
              <p className="font-heading text-base font-semibold">
                {(() => {
                  const unit = period === "month" ? "Month" : "Week";
                  if (weekOffset === 0) return `This ${unit}`;
                  if (weekOffset === -1) return `Last ${unit}`;
                  return `${-weekOffset} ${unit.toLowerCase()}s ago`;
                })()}
              </p>
              <p className="text-muted-foreground text-xs">{weekRange}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-8 shrink-0"
              aria-label={period === "month" ? "Next month" : "Next week"}
              onClick={() => onWeekOffsetChange(Math.min(0, weekOffset + 1))}
              disabled={weekOffset === 0}
            >
              <ChevronRight className="size-4" />
            </Button>
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

          {/* Filters, then the action.

              **The order is the reading order.** Left to right the controls go from "what is on
              screen" to "what to do with it": the period decides what the COLUMNS are, the grouping
              decides what the ROWS are, department and search narrow those rows, and Download acts
              on whatever the four before it produced. Download used to sit second — between the two
              toggles — which split a pair that belongs together and put an action in the middle of
              a set of view controls.

              **`flex-wrap` and `shrink-0` are load-bearing, not cosmetic.** This was one
              non-wrapping line about 1000px wide inside a card with `overflow-hidden`, and flexbox
              is free to shrink items below their content width: it broke "By employee" onto two
              lines and pushed the search box past the card's right edge, where the card clipped it
              — a control the user could not see or reach. Wrapping costs a second row on a narrow
              viewport; not wrapping cost the control itself. */}
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            {/* 1 · Period — changes what the columns ARE, so it reads first. */}
            <div className="bg-card shadow-soft inline-flex shrink-0 items-center gap-0.5 rounded-full border p-0.5">
              <FilterTab
                active={period === "week"}
                onClick={() => onPeriodChange("week")}
                icon={CalendarDays}
                label="Week"
              />
              <FilterTab
                active={period === "month"}
                onClick={() => onPeriodChange("month")}
                icon={CalendarRange}
                label="Month"
              />
            </div>
            {/* 2 · Grouping — changes what the rows are. Now adjacent to the period toggle: the two
                pills are the same control shape doing the same kind of job, and reading them as a
                pair is most of what makes the toolbar scannable. */}
            <div className="bg-card shadow-soft inline-flex shrink-0 items-center gap-0.5 rounded-full border p-0.5">
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
            {/* 3 · Department — the first of the two narrowing filters. */}
            <DepartmentFilter
              value={deptFilter}
              onChange={setDeptFilter}
              options={departments.map((d) => ({ value: d, label: d }))}
              ariaLabel="Filter timesheet by department"
              className="shrink-0"
            />
            {/* 4 · Search — narrows further, so it follows the coarser filter. Full width on a
                phone (where it gets its own row) and a fixed 14rem from `sm` up, never shrunk. */}
            <div className="relative w-full sm:w-56 sm:shrink-0">
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
            {/* 5 · Download — the only action here, and it exports exactly the grid the four
                controls above just described. Last for that reason. Disabled on an empty grid
                rather than hidden, so it does not appear and vanish as filters change. */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 rounded-full"
              onClick={exportCsv}
              disabled={rows.length === 0}
              title={`Download this ${period === "month" ? "month" : "week"} as CSV`}
            >
              <Download className="size-4" />
              Download
            </Button>
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
        {/* A month is 28-31 day columns, which cannot fit a laptop viewport — the wrapper above
              scrolls horizontally and the Employee column is sticky, so who a row belongs to stays
              visible while you scroll the dates. */}
          <table
            className={cn(
              "w-full border-collapse text-sm",
              period === "week" && "min-w-[760px]",
            )}
            // Month only, and computed rather than a class — see MONTH_DAY_COL_PX.
            style={
              period === "month"
                ? {
                    minWidth: `${dates.length * MONTH_DAY_COL_PX + MONTH_FIXED_COLS_PX}px`,
                  }
                : undefined
            }
          >
          <thead>
            <tr className="bg-muted/30 border-b">
              <th
                className={cn(
                  STICKY_COL,
                  STICKY_HEAD,
                  "text-muted-foreground px-4 py-2.5 text-left align-middle text-xs font-semibold tracking-wide uppercase",
                )}
              >
                {group === "person" ? "Employee" : "Project"}
              </th>
              {/* Driven by `dates`, not a fixed weekday list — a week is 7 of these and a month is
                  28-31. `key` is the iso date rather than the label: two Mondays in a month would
                  otherwise collide on the same key. */}
              {dates.map((iso, i) => {
                const holidayName = holidays.nameFor(iso);
                const heading = columnHeading(iso, period);
                return (
                  <th
                    key={iso}
                    className={cn(
                      "text-muted-foreground px-2 py-2.5 text-center align-middle text-xs font-semibold tracking-wide",
                      period === "month" && MONTH_DIVIDER,
                      // Weekend shading follows the real weekday, shared with the body and the
                      // footer so all three stripe the same columns.
                      weekendCols[i] && "bg-muted/50",
                    )}
                    title={holidayName ? `Holiday: ${holidayName}` : undefined}
                  >
                    <span className="block tabular-nums">{heading.top}</span>
                    <span className="text-muted-foreground/70 block text-[0.7rem] font-normal tabular-nums">
                      {heading.sub}
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
                  colSpan={dates.length + 2}
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
                  // `group`: the pinned cell is opaque, so it cannot inherit the row's hover tint
                  // the way the scrolling cells do — it has to repaint itself to the same composited
                  // colour, or the row lights up everywhere except the name you are pointing at.
                  className="group hover:bg-muted/30 border-b transition-colors last:border-b-0"
                >
                  {/* Entity */}
                  <td
                  className={cn(
                    STICKY_COL,
                    "bg-card px-4 py-2.5 transition-colors",
                    "group-hover:bg-[color-mix(in_oklab,var(--muted)_30%,var(--card))]",
                  )}
                >
                    <div className="flex items-center gap-2.5">
                      {r.isProject ? (
                        <span className="bg-feature-tint text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                          <FolderKanban className="size-4" />
                        </span>
                      ) : (
                        <UserAvatar
                          userId={r.id}
                          name={r.name}
                          className="size-8"
                          fallbackClassName="text-xs"
                        />
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
                      className={cn(
                        "p-0 text-center",
                        period === "month" && MONTH_DIVIDER,
                        weekendCols[i] && "bg-muted/20",
                      )}
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
                      onClick={() => setSelection({ rowId: r.id, kind: "range" })}
                      title={`View ${period === "month" ? "monthly" : "weekly"} activity`}
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
                <td
                  className={cn(
                    STICKY_COL,
                    STICKY_FOOT,
                    "px-4 py-3 align-middle text-xs tracking-wide uppercase",
                  )}
                >
                  Total time
                </td>
                {colTotals.map((h, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-2 py-3 text-center align-middle font-mono tabular-nums",
                      period === "month" && MONTH_DIVIDER,
                      weekendCols[i] && "bg-muted/50",
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
        // `whitespace-nowrap` + `shrink-0`: a two-word label ("By employee") is the first thing a
        // squeezed flex row breaks, and a pill toggle that silently becomes two lines tall drags
        // the whole toolbar's height with it. The label is short enough that wrapping it is never
        // the right answer — wrap the toolbar instead.
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
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

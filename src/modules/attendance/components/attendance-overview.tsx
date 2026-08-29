"use client";

/**
 * At-a-glance attendance for the active filter (Today / Week / Month / Custom, or a specific picked
 * day), optionally narrowed to one department. Owns the shared filter in its top-right. Today by
 * default. **All numbers come from the live backend** via `useOversightAttendance` — passed in as
 * `counts` / `series` / `benchmarkRate` + `label`, never fabricated.
 *
 * The distribution graph adapts to the filter: **Today / a single day** shows a 100%-stacked bar of
 * present · on-leave · absent, plus a `DeltaPill` comparing today's rate to the trailing-workday
 * average (`benchmarkRate`). **A multi-day range** shows a real per-day trend — one bar per closed
 * workday, height = that day's attendance rate — because the shape over time is the actual signal.
 */
import { Card, CardContent } from "@/components/ui/card";
import { DepartmentFilter } from "@/components/shared/department-filter";
import { DatePicker } from "@/components/ui/date-picker";
import { DeltaPill } from "@/components/shared/delta-pill";
import { cn } from "@/lib/utils";
import { todayIso } from "@/lib/format";
import { LogDatePicker } from "./attendance-log";
import { attended, attendanceRate1dp } from "../lib/attended";
import type {
  AttendanceDate,
  AttendanceRange,
  DayPoint,
  OversightCounts,
} from "../use-oversight-attendance";

const RANGE_OPTIONS: { value: AttendanceRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "custom", label: "Custom" },
];

export function AttendanceOverview({
  range,
  onRangeChange,
  date,
  onDateChange,
  start,
  end,
  onStartChange,
  onEndChange,
  dept,
  onDeptChange,
  departments,
  counts,
  series,
  benchmarkRate,
  label,
  loading,
  note,
}: {
  range: AttendanceRange;
  onRangeChange: (r: AttendanceRange) => void;
  date: AttendanceDate;
  onDateChange: (d: AttendanceDate) => void;
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  dept: string;
  onDeptChange: (d: string) => void;
  departments: string[];
  counts: OversightCounts;
  series: DayPoint[];
  benchmarkRate: number | null;
  label: string;
  loading: boolean;
  note: string | null;
}) {
  // Attendance is a record of what already happened, so neither end of a custom range may reach
  // past today. Read per render (not at module scope) so a tab left open overnight still bounds to
  // the real today rather than the day the page was loaded.
  const today = todayIso();

  // Attendance = present + partial, from the shared definition (lib/attended) rather than a local
  // reading of it. This used to fold partial into `present` here while the calendar folded it into
  // absent, so the same day read 38% on this card and 31% there. `late` is always 0 from oversight.
  const total = counts.total || 1;
  const attendedCount = attended(counts) + counts.late;
  const leave = counts.leave;
  const absent = Math.max(0, total - attendedCount - leave);

  const rate = attendanceRate1dp(counts, total);

  // Partial gets its own band: counting it as attendance is not the same as hiding it, and a
  // reviewer needs to see that four of five "attended" were only partly there.
  const presentPct = Math.round((counts.present / total) * 100);
  const partialPct = Math.round((counts.partial / total) * 100);
  const leavePct = Math.round((leave / total) * 100);
  const absentPct = Math.max(0, 100 - presentPct - partialPct - leavePct);

  const context = `${label} · ${dept === "all" ? "All departments" : dept}`;

  return (
    <Card>
      <CardContent className="space-y-5 px-5">
        {/* Top: summary (left) + filters (right). */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-4">
          {/* Summary */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{context}</p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-display text-3xl font-semibold tabular-nums",
                  loading && "animate-pulse text-muted-foreground",
                )}
              >
                {loading ? "—" : `${rate}%`}
              </span>
              <span className="text-xs text-muted-foreground">
                {/* Today counts everyone who has clocked in at all, not who happens to be running a
                    timer at this instant — see `use-oversight-attendance`. Still not the closed verdict
                    (the nightly close adds partial), hence its own wording. */}
                {range === "today" ? "Clocked in today" : "Attendance rate"}
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="inline-flex items-center gap-0.5 rounded-full border bg-card p-0.5 shadow-soft">
                {RANGE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => onRangeChange(r.value)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      range === r.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Pick a specific day — switches the overview to that date. */}
              <LogDatePicker
                value={date}
                onChange={(d) => {
                  onDateChange(d);
                  onRangeChange("day");
                }}
              />

              <DepartmentFilter
                value={dept}
                onChange={onDeptChange}
                options={departments.map((d) => ({ value: d, label: d }))}
                ariaLabel="Filter attendance by department"
              />
            </div>

            {/* Custom range pickers — reserve their row even when hidden, so the card doesn't jump. */}
            <div
              aria-hidden={range !== "custom"}
              className={cn(
                "flex flex-wrap items-center justify-end gap-2",
                range !== "custom" && "invisible",
              )}
            >
              <DatePicker
                value={start}
                onChange={onStartChange}
                max={end || today}
                placeholder="Start date"
              />
              <span className="text-sm text-muted-foreground">–</span>
              <DatePicker
                value={end}
                onChange={onEndChange}
                min={start || undefined}
                max={today}
                placeholder="End date"
              />
            </div>
          </div>
        </div>

        {note ? (
          <p className="text-xs text-muted-foreground">{note}</p>
        ) : null}

        {/* Distribution graph — a multi-day range shows the per-day trend; a single day / Today shows
            the present·leave·absent split plus a "vs recent" delta. Dimmed while loading. */}
        <div className={cn(loading && "opacity-40")}>
          {series.length > 1 ? (
            <TrendBars series={series} benchmarkRate={benchmarkRate} />
          ) : (
            <StackedDistribution
              present={counts.present}
              partial={counts.partial}
              leave={leave}
              absent={absent}
              total={total}
              presentPct={presentPct}
              partialPct={partialPct}
              leavePct={leavePct}
              absentPct={absentPct}
              rate={rate}
              // No "vs recent" delta on the single-day / Today split: Today is a live clocked-in-now
              // snapshot (not comparable to a full-day average), and a single picked day has no
              // baseline. The like-for-like average lives on the multi-day TrendBars instead.
              benchmarkRate={null}
            />
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-4">
          <LegendItem
            dot="bg-success"
            label="Present"
            value={loading ? "—" : `${counts.present}`}
          />
          <LegendItem
            dot="bg-warning"
            label="Partial"
            value={loading ? "—" : `${counts.partial}`}
          />
          <LegendItem dot="bg-primary" label="On leave" value={loading ? "—" : `${leave}`} />
          <LegendItem dot="bg-destructive" label="Absent" value={loading ? "—" : `${absent}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function LegendItem({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <span className="flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", dot)} />
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </span>
      <p className="font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const MONTHS_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Format an ISO date (`2026-07-03`) as `Jul 3`, parsing the string directly (no `Date` in render). */
function fmtDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS_ABBR[m - 1] ?? "?"} ${d}`;
}

/**
 * Today / a single picked day: a 100%-stacked present · on-leave · absent bar. When `benchmarkRate`
 * is set (Today), a `DeltaPill` shows how today's attendance rate compares to the trailing-workday
 * average — the "is this normal?" context a lone percentage can't give.
 */
function StackedDistribution({
  present,
  partial,
  leave,
  absent,
  total,
  presentPct,
  partialPct,
  leavePct,
  absentPct,
  rate,
  benchmarkRate,
}: {
  present: number;
  partial: number;
  leave: number;
  absent: number;
  total: number;
  presentPct: number;
  partialPct: number;
  leavePct: number;
  absentPct: number;
  rate: number;
  benchmarkRate: number | null;
}) {
  // Amber for partial, matching the badge the roster already uses — the same status should not be
  // a different colour depending on which card you are looking at.
  const segs = [
    { key: "present", w: presentPct, className: "bg-success", label: "Present", count: present },
    { key: "partial", w: partialPct, className: "bg-warning", label: "Partial", count: partial },
    { key: "leave", w: leavePct, className: "bg-primary", label: "On leave", count: leave },
    { key: "absent", w: absentPct, className: "bg-destructive/70", label: "Absent", count: absent },
  ].filter((s) => s.w > 0);

  return (
    <div className="space-y-3 py-2">
      {benchmarkRate !== null ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <DeltaPill value={Math.round(rate) - benchmarkRate} />
          <span>
            vs <span className="tabular-nums">{benchmarkRate}%</span> average over recent workdays
          </span>
        </div>
      ) : null}
      <div
        className="flex h-8 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Present ${present}, partial ${partial}, on leave ${leave}, absent ${absent} of ${total}`}
      >
        {segs.map((s) => (
          <div
            key={s.key}
            className={cn("h-full transition-[filter] hover:brightness-90", s.className)}
            style={{ width: `${s.w}%` }}
            title={`${s.label} — ${s.count} of ${total} (${s.w}%)`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * A multi-day range: one bar per closed workday, its height the day's attendance rate, coloured by
 * band (≥85% healthy, ≥60% watch, below that concerning). A dashed line marks the range average.
 * This is what turns the panel from decorative texture into an actual trend.
 */
function TrendBars({
  series,
  benchmarkRate,
}: {
  series: DayPoint[];
  benchmarkRate: number | null;
}) {
  const band = (rate: number) =>
    rate >= 85 ? "bg-success" : rate >= 60 ? "bg-warning" : "bg-destructive/70";

  return (
    <div className="space-y-2">
      {/* One column per day: a faint full-height track (the 0–100 scale) with a bottom-anchored fill
          whose height is the day's attendance rate — so a low day reads as a short fill in a tall
          track, not a floating pill. */}
      <div className="relative flex h-28 items-stretch gap-[3px]">
        {series.map((p) => (
          <div
            key={p.iso}
            className="flex flex-1 items-end overflow-hidden rounded-t-md bg-muted/50"
            title={`${fmtDay(p.iso)} — ${p.rate}% present (${p.present}/${p.total}${
              p.leave ? `, ${p.leave} on leave` : ""
            })`}
          >
            <div
              className={cn(
                "w-full rounded-t-md transition-[filter] hover:brightness-90",
                band(p.rate),
              )}
              style={{ height: `${Math.max(3, p.rate)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{fmtDay(series[0].iso)}</span>
        {benchmarkRate !== null ? (
          <span className="tabular-nums">avg {benchmarkRate}%</span>
        ) : null}
        <span>{fmtDay(series[series.length - 1].iso)}</span>
      </div>
    </div>
  );
}

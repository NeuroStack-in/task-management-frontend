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
import { formatDate, todayIso } from "@/lib/format";
import { LogDatePicker } from "./attendance-log";
import { attended, attendanceRate1dp } from "../lib/attended";
import type {
  AttendanceDate,
  AttendanceRange,
  DayPoint,
  OversightCounts,
} from "../use-oversight-attendance";

const NO_COUNTS: OversightCounts = { present: 0, partial: 0, late: 0, leave: 0, total: 0 };

const RANGE_OPTIONS: { value: AttendanceRange; label: string }[] = [
  { value: "today", label: "Today" },
  // The seven days before today, not the calendar week (WP-475).
  { value: "week", label: "7 days" },
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
  error,
  note,
  lateAfter,
}: {
  range: AttendanceRange;
  onRangeChange: (r: AttendanceRange) => void;
  date: AttendanceDate;
  /** A day was picked; the page decides its range (today's date is the live Today view). */
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
  /** The window's data could not be read — every figure renders "—", never a confident zero. */
  error?: string | null;
  note: string | null;
  /** The org's "Late after" — named beside "Not in yet" on Today (TIME-11). */
  lateAfter?: string;
}) {
  // Attendance is a record of what already happened, so neither end of a custom range may reach
  // past today. Read per render (not at module scope) so a tab left open overnight still bounds to
  // the real today rather than the day the page was loaded.
  const today = todayIso();

  // Attendance = present + partial, from the shared definition (lib/attended) rather than a local
  // reading of it. This used to fold partial into `present` here while the calendar folded it into
  // absent, so the same day read 38% on this card and 31% there. `late` is always 0 from oversight.
  //
  // No `|| 1` on the denominator: with nobody counted (a weekend, a holiday, Custom before dates are
  // picked, an empty department) it invented one absentee and a 100 % red bar (QA audit 2026-10-08,
  // WP-112). Every share below is guarded instead, and the figures read "—". A failed read draws as
  // no data at all — not the previous window's split, not a confident zero (WP-113).
  const shown = error ? NO_COUNTS : counts;
  const total = shown.total;
  // `attended()` only — NOT `+ counts.late`. Oversight hard-wires `late` to 0 (the index carries no
  // per-person late flag), so adding it was inert here, but it is the same shape as the bug that
  // printed "25/20" on the personal calendar: late is a qualifier ON an attended day, never an extra
  // day. Left as it was, it would have started double-counting the moment `late` was populated.
  const attendedCount = attended(shown);
  const leave = shown.leave;
  // Today only: expected, but it's still before "Late after" — not absent yet, so not red
  // (UX audit 2026-10-16, TIME-11). Before 09:00 the bar was solid red and the headline 0 %.
  const notInYet = shown.notInYet ?? 0;
  const absent = Math.max(0, total - attendedCount - leave - notInYet);

  const rate = attendanceRate1dp(shown, total);
  const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Partial gets its own band: counting it as attendance is not the same as hiding it, and a
  // reviewer needs to see that four of five "attended" were only partly there.
  const presentPct = share(shown.present);
  const partialPct = share(shown.partial);
  const leavePct = share(leave);
  const notInYetPct = share(notInYet);
  const absentPct =
    total > 0 && absent > 0
      ? Math.max(0, 100 - presentPct - partialPct - leavePct - notInYetPct)
      : 0;
  const isToday = range === "today";

  const blank = loading || Boolean(error) || total === 0;
  const figure = (n: number) => (loading || error ? "—" : `${n}`);

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
                  !loading && blank && "text-muted-foreground",
                )}
              >
                {blank ? "—" : `${rate}%`}
              </span>
              <span className="text-xs text-muted-foreground">
                {/* Today counts everyone who has clocked in at all, not who happens to be running a
                    timer at this instant — see `use-oversight-attendance`. Still not the closed verdict
                    (the nightly close adds partial), hence its own wording. */}
                {isToday
                  ? notInYet > 0
                    ? "Clocked in so far"
                    : "Clocked in today"
                  : "Attendance rate"}
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
                    aria-pressed={range === r.value}
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

              {/* Pick a specific day — the page switches the overview to that date (or to the live
                  Today view when the pick is today; forcing "day" here emptied the roster, WP-255). */}
              <LogDatePicker value={date} onChange={onDateChange} />

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

        {error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : note ? (
          <p className="text-xs text-muted-foreground">{note}</p>
        ) : null}

        {/* Distribution graph — a multi-day range shows the per-day trend; a single day / Today shows
            the present·leave·absent split plus a "vs recent" delta. Dimmed while loading. */}
        <div className={cn(loading && "opacity-40")}>
          {series.length > 1 && !error ? (
            <TrendBars series={series} benchmarkRate={benchmarkRate} />
          ) : (
            <StackedDistribution
              present={shown.present}
              partial={shown.partial}
              leave={leave}
              absent={absent}
              total={total}
              presentPct={presentPct}
              partialPct={partialPct}
              leavePct={leavePct}
              absentPct={absentPct}
              notInYet={notInYet}
              notInYetPct={notInYetPct}
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
          <LegendItem dot="bg-success" label="Present" value={figure(shown.present)} />
          {/* Today has no partial verdict (the close assigns it tonight), so its slot says who
              hasn't come in yet instead — neutral until "Late after" (TIME-11). */}
          {isToday ? (
            <LegendItem
              dot="bg-muted-foreground/40"
              label="Not in yet"
              value={figure(notInYet)}
              title={
                lateAfter
                  ? `Expected today, no session yet — counted absent after ${lateAfter}, the organization's "Late after" time.`
                  : undefined
              }
            />
          ) : (
            <LegendItem dot="bg-warning" label="Partial" value={figure(shown.partial)} />
          )}
          <LegendItem dot="bg-primary" label="On leave" value={figure(leave)} />
          <LegendItem dot="bg-destructive" label="Absent" value={figure(absent)} />
        </div>
        {isToday && notInYet > 0 && lateAfter && !loading && !error ? (
          <p className="-mt-2 text-xs text-muted-foreground">
            Anyone with no session counts as absent after {lateAfter}, your organization&apos;s
            &ldquo;Late after&rdquo; time.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function LegendItem({
  dot,
  label,
  value,
  title,
}: {
  dot: string;
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="space-y-1" title={title}>
      <span className="flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", dot)} />
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </span>
      <p className="font-display text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * An ISO date (`2026-07-03`) in the shared notation without the year ("3 Jul" / "Jul 3", per the
 * viewer's locale) — UX audit XC-06 / TIME-14. Safe in render: the series only exists after a read.
 */
function fmtDay(iso: string): string {
  return formatDate(iso, { year: false });
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
  notInYet,
  notInYetPct,
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
  notInYet: number;
  notInYetPct: number;
  rate: number;
  benchmarkRate: number | null;
}) {
  // Amber for partial, matching the badge the roster already uses — the same status should not be
  // a different colour depending on which card you are looking at.
  const segs = [
    { key: "present", w: presentPct, className: "bg-success", label: "Present", count: present },
    { key: "partial", w: partialPct, className: "bg-warning", label: "Partial", count: partial },
    { key: "leave", w: leavePct, className: "bg-primary", label: "On leave", count: leave },
    // Neutral, not red: expected, and it's still before "Late after" (TIME-11).
    {
      key: "not-in-yet",
      w: notInYetPct,
      className: "bg-muted-foreground/25",
      label: "Not in yet",
      count: notInYet,
    },
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
        aria-label={`Present ${present}, partial ${partial}, on leave ${leave}, ${
          notInYet ? `not in yet ${notInYet}, ` : ""
        }absent ${absent} of ${total}`}
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
      {/* A list, each bar carrying its own sentence: the per-day figures were only in `title`
          tooltips, which a keyboard or screen reader never reaches (UX audit 2026-10-16, TIME-15). */}
      <ul
        className="relative flex h-28 items-stretch gap-[3px]"
        aria-label={`Attendance by day${benchmarkRate !== null ? `, average ${benchmarkRate}%` : ""}`}
      >
        {series.map((p) => {
          // The rate counts partial days as attended (lib/attended), so the fraction beside it
          // must too — "75% present (2/4)" paired a rate with a count that disagreed (WP-476).
          const story = `${formatDate(p.iso, { weekday: true, year: false })} — ${p.rate}% attended (${
            p.present + p.partial
          } of ${p.total}${p.partial ? `, ${p.partial} partial` : ""}${
            p.leave ? `, ${p.leave} on leave` : ""
          })`;
          return (
          <li
            key={p.iso}
            className="flex flex-1 items-end overflow-hidden rounded-t-md bg-muted/50"
            title={story}
          >
            <span className="sr-only">{story}</span>
            <div
              aria-hidden="true"
              className={cn(
                "w-full rounded-t-md transition-[filter] hover:brightness-90",
                band(p.rate),
              )}
              style={{ height: `${Math.max(3, p.rate)}%` }}
            />
          </li>
          );
        })}
      </ul>
      <div className="flex justify-between text-[11px] text-muted-foreground" aria-hidden="true">
        <span>{fmtDay(series[0].iso)}</span>
        {benchmarkRate !== null ? (
          <span className="tabular-nums">avg {benchmarkRate}%</span>
        ) : null}
        <span>{fmtDay(series[series.length - 1].iso)}</span>
      </div>
    </div>
  );
}

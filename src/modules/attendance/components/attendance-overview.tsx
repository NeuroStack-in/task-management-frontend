"use client";

/**
 * At-a-glance attendance for the active filter (Today / Week / Month / Custom, or a specific picked
 * day), optionally narrowed to one department. Owns the shared filter in its top-right. Today by
 * default. **All numbers come from the live backend** via `useOversightAttendance` — passed in as
 * `counts` + `label`, never fabricated. There is no week-over-week delta because the server serves no
 * comparison baseline, so the old mock `DeltaPill` is intentionally gone.
 */
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { LogDatePicker } from "./attendance-log";
import type {
  AttendanceDate,
  AttendanceRange,
  OversightCounts,
} from "../use-oversight-attendance";

const BARS = 48;

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
  label: string;
  loading: boolean;
  note: string | null;
}) {
  // "Present" counts everyone who showed up (present + partial already fold into counts.present;
  // late is 0 from oversight and adds nothing).
  const present = counts.present + counts.late;
  const total = counts.total || 1;
  const leave = counts.leave;
  const absent = Math.max(0, total - present - leave);

  const rate = Math.round((present / total) * 1000) / 10;

  const presentBars = Math.round((present / total) * BARS);
  const leaveBars = Math.round((leave / total) * BARS);

  const presentPct = Math.round((present / total) * 100);
  const leavePct = Math.round((leave / total) * 100);
  const absentPct = Math.max(0, 100 - presentPct - leavePct);

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
              <span className="text-xs text-muted-foreground">Attendance rate</span>
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

              <Select value={dept} onValueChange={(v) => onDeptChange(v as string)}>
                <SelectTrigger className="h-8 w-[10.5rem]" aria-label="Department">
                  <SelectValue>
                    {(v) =>
                      v == null || v === "all" ? "All departments" : String(v)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d === "all" ? "All departments" : d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                max={end || undefined}
                placeholder="Start date"
              />
              <span className="text-sm text-muted-foreground">–</span>
              <DatePicker
                value={end}
                onChange={onEndChange}
                min={start || undefined}
                placeholder="End date"
              />
            </div>
          </div>
        </div>

        {note ? (
          <p className="text-xs text-muted-foreground">{note}</p>
        ) : null}

        {/* Distribution graph — bar heights are decorative texture; each bar's hover title reveals the
            segment it belongs to (status · count · share). Dimmed while loading. */}
        <div className={cn("flex h-28 items-end gap-[3px]", loading && "opacity-40")}>
          {Array.from({ length: BARS }, (_, i) => {
            const seg =
              i < presentBars
                ? { className: "bg-success", label: "Present", count: present, pct: presentPct }
                : i < presentBars + leaveBars
                  ? { className: "bg-primary", label: "On leave", count: leave, pct: leavePct }
                  : { className: "bg-destructive/70", label: "Absent", count: absent, pct: absentPct };
            const h = 58 + ((i * 11) % 34) - (i / BARS) * 18;
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-full transition-[filter] hover:brightness-75",
                  seg.className,
                )}
                style={{ height: `${Math.max(28, h)}%` }}
                title={`${seg.label} — ${seg.count} of ${total} (${seg.pct}%)`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2 border-t pt-3">
          <LegendItem dot="bg-success" label="Present" value={loading ? "—" : `${present}`} />
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

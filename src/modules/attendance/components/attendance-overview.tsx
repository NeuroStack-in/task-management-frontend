"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { DeltaPill } from "@/components/shared/delta-pill";
import {
  ATTENDANCE_RANGE_OPTIONS,
  OVERVIEW,
  rangeSummary,
  type AttendanceRange,
} from "@/lib/mock-attendance";
import { cn } from "@/lib/utils";
import { LogDatePicker } from "./attendance-log";

const BARS = 48;

interface AttendanceDate {
  year: number;
  month: number;
  day: number;
}

/**
 * At-a-glance attendance for the active filter (a Today / Week / Month range or
 * a specific picked day), optionally narrowed to one department. Owns the shared
 * filter in its top-right. Today by default.
 */
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
}) {
  const { counts, label } = rangeSummary(range, dept, date, start, end);

  // "Present" counts everyone who showed up (on-time + late).
  const present = counts.present + counts.late;
  const total = counts.total || 1;
  const leave = counts.leave;
  const absent = Math.max(0, total - present - leave);

  const isDefault = range === "today" && dept === "all";
  // The week-over-week delta only makes sense for today's org-wide snapshot.
  const delta = isDefault ? (OVERVIEW.rateDelta as number) : null;

  const rate = Math.round((present / total) * 1000) / 10;

  const presentBars = Math.round((present / total) * BARS);
  const leaveBars = Math.round((leave / total) * BARS);

  const context = `${label} · ${dept === "all" ? "All departments" : dept}`;

  return (
    <Card>
      <CardContent className="space-y-5 px-5">
        {/* Top: summary (left) + filters (right). Two columns so the custom-range
            pickers only grow the right side — the rate stays pinned top-left. */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-4">
          {/* Summary */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{context}</p>
            <div className="flex items-center gap-2">
              <span className="font-display text-3xl font-semibold tabular-nums">
                {rate}%
              </span>
              {delta !== null ? <DeltaPill value={delta} /> : null}
              <span className="text-xs text-muted-foreground">
                Attendance rate
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="inline-flex items-center gap-0.5 rounded-full border bg-card p-0.5 shadow-soft">
                {ATTENDANCE_RANGE_OPTIONS.map((r) => (
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

              <Select
                value={dept}
                onValueChange={(v) => onDeptChange(v as string)}
              >
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

            {/* Custom range pickers — always occupy their row (kept invisible when
                not in "Custom") so the card height never changes when toggling. */}
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

        {/* Distribution graph */}
        <div className="flex h-28 items-end gap-[3px]">
          {Array.from({ length: BARS }, (_, i) => {
            const seg =
              i < presentBars
                ? "bg-success"
                : i < presentBars + leaveBars
                  ? "bg-primary"
                  : "bg-destructive/70";
            const h = 58 + ((i * 11) % 34) - (i / BARS) * 18;
            return (
              <div
                key={i}
                className={cn("flex-1 rounded-full", seg)}
                style={{ height: `${Math.max(28, h)}%` }}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2 border-t pt-3">
          <LegendItem dot="bg-success" label="Present" value={`${present}`} />
          <LegendItem dot="bg-primary" label="On leave" value={`${leave}`} />
          <LegendItem dot="bg-destructive" label="Absent" value={`${absent}`} />
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

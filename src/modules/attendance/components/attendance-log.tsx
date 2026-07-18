"use client";

/**
 * `LogDatePicker` — a compact month calendar in a dropdown, used to pick a single (non-future) day.
 *
 * ## Why this file no longer holds an `AttendanceLog`
 *
 * The org/team attendance oversight is served by the live backend and rendered by
 * `oversight-attendance-view.tsx` (`GET /v1/attendance/day` → per-person status + a day summary).
 * The old mock `AttendanceLog` — a multi-day heatmap/log fabricated from `lib/data` `users` and
 * `mock-attendance`'s `dayRecordFor` — was a duplicate of that view backed by invented punches/hours
 * the server does not serve. Per the no-duplicate-components rule it was removed rather than kept as
 * a second, fake oversight. What survives here is the pure date-math picker, which carries no
 * attendance data of its own and is shared by the personal attendance view and the locations module.
 */
import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  isFutureDate,
  monthMatrix,
  MONTH_NAMES,
  WEEKDAY_LABELS,
} from "@/lib/mock-attendance";
import { cn } from "@/lib/utils";

export interface SelectedDate {
  year: number;
  month: number;
  day: number;
}

const dateLabel = (d: SelectedDate) =>
  `${MONTH_NAMES[d.month].slice(0, 3)} ${d.day}, ${d.year}`;

export function LogDatePicker({
  value,
  onChange,
}: {
  value: SelectedDate;
  onChange: (d: SelectedDate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: value.year, month: value.month });

  const weeks = useMemo(() => monthMatrix(view.year, view.month), [view]);

  const step = (dir: -1 | 1) =>
    setView((v) => {
      const m = v.month + dir;
      if (m < 0) return { year: v.year - 1, month: 11 };
      if (m > 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: m };
    });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="h-8 gap-1.5" />}
      >
        <CalendarDays className="size-4" />
        {dateLabel(value)}
        <ChevronDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => step(-1)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-medium">
            {MONTH_NAMES[view.month]} {view.year}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
          {WEEKDAY_LABELS.map((d) => (
            <span key={d}>{d[0]}</span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {weeks.flat().map((cell, i) => {
            const selected =
              cell.inMonth &&
              cell.year === value.year &&
              cell.month === value.month &&
              cell.day === value.day;
            const disabled =
              !cell.inMonth || isFutureDate(cell.year, cell.month, cell.day);
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onChange({
                    year: cell.year,
                    month: cell.month,
                    day: cell.day,
                  });
                  setOpen(false);
                }}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-xs tabular-nums transition-colors",
                  selected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : disabled
                      ? "cursor-default text-muted-foreground/40"
                      : cell.isToday
                        ? "text-primary ring-1 ring-primary hover:bg-muted"
                        : "hover:bg-muted",
                )}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

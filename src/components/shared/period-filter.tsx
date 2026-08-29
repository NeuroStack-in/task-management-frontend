"use client";

import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";

export type Granularity = "daily" | "weekly" | "monthly";

export const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

/**
 * "Which period, ending when" — the pills plus the date, as one control.
 *
 * The two belong together because neither answers the question alone: "Weekly" is meaningless
 * without an anchor date, and a date is ambiguous without knowing whether it means that day, its
 * week or its month. Splitting them across two components let each page pair them differently, and
 * a page could render one without the other.
 *
 * ## What the date means
 *
 * It is the **anchor**, not the start: the period is the one *containing* this date. Daily is the
 * day itself; Weekly is that date's working week; Monthly is its calendar month. The label changes
 * with the granularity so the field never just says "Date" while selecting a month.
 */
export function PeriodFilter({
  granularity,
  onGranularityChange,
  date,
  onDateChange,
  max,
  className,
  /** Hide the pills when a surface has only one meaningful period. */
  showGranularity = true,
}: {
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  /** `YYYY-MM-DD`. Empty renders the picker unset rather than guessing a day. */
  date: string;
  onDateChange: (iso: string) => void;
  max?: string;
  className?: string;
  showGranularity?: boolean;
}) {
  const dateLabel =
    granularity === "daily" ? "Date" : granularity === "weekly" ? "Week of" : "Month of";

  return (
    <div
      className={cn(
        "bg-card shadow-soft flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-2.5",
        className,
      )}
    >
      {showGranularity ? (
        <div
          role="group"
          aria-label="Period"
          className="bg-background flex rounded-full border p-0.5"
        >
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              type="button"
              aria-pressed={granularity === g.key}
              onClick={() => onGranularityChange(g.key)}
              className={cn(
                "rounded-full px-3.5 py-1 text-sm font-medium transition-colors",
                granularity === g.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      ) : (
        <span />
      )}
      <label className="text-muted-foreground flex items-center gap-2 text-sm">
        {dateLabel}
        <DatePicker value={date} max={max} onChange={onDateChange} />
      </label>
    </div>
  );
}

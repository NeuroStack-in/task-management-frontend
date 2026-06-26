"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const monthKeyOf = (iso: string) => +iso.slice(0, 4) * 12 + (+iso.slice(5, 7) - 1);

/**
 * Themed month calendar (Graphite & Indigo). Pure date math — no external deps.
 * `value`/`min`/`max` are ISO "YYYY-MM-DD"; `onSelect("")` clears.
 */
export function Calendar({
  value,
  onSelect,
  min,
  max,
  className,
}: {
  value?: string;
  onSelect: (iso: string) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  const anchor = value || max || min;
  const [view, setView] = useState(() =>
    anchor
      ? { y: +anchor.slice(0, 4), m0: +anchor.slice(5, 7) - 1 }
      : { y: 2026, m0: 5 },
  );

  const firstDow = new Date(view.y, view.m0, 1).getDay();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const dt = new Date(view.y, view.m0, 1 - firstDow + i);
    const iso = toIso(dt.getFullYear(), dt.getMonth(), dt.getDate());
    return {
      iso,
      d: dt.getDate(),
      inMonth: dt.getMonth() === view.m0 && dt.getFullYear() === view.y,
      disabled: (min !== undefined && iso < min) || (max !== undefined && iso > max),
      selected: iso === value,
    };
  });

  const viewKey = view.y * 12 + view.m0;
  const canPrev = viewKey > (min ? monthKeyOf(min) : -Infinity);
  const canNext = viewKey < (max ? monthKeyOf(max) : Infinity);
  const shift = (delta: number) =>
    setView((v) => {
      const total = v.y * 12 + v.m0 + delta;
      return { y: Math.floor(total / 12), m0: ((total % 12) + 12) % 12 };
    });

  const selectToday = () => {
    const now = new Date();
    let iso = toIso(now.getFullYear(), now.getMonth(), now.getDate());
    if (min && iso < min) iso = min;
    if (max && iso > max) iso = max;
    setView({ y: +iso.slice(0, 4), m0: +iso.slice(5, 7) - 1 });
    onSelect(iso);
  };

  return (
    <div
      className={cn(
        "w-64 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">
          {MONTHS[view.m0]} {view.y}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => shift(-1)}
            aria-label="Previous month"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => shift(1)}
            aria-label="Next month"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="flex h-7 items-center justify-center text-xs font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {cells.map((c, i) => (
          <button
            key={i}
            type="button"
            disabled={c.disabled}
            onClick={() => onSelect(c.iso)}
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-sm transition-colors",
              c.selected
                ? "bg-primary font-medium text-primary-foreground hover:bg-primary"
                : c.inMonth
                  ? "text-foreground hover:bg-muted"
                  : "text-muted-foreground/40 hover:bg-muted",
              c.disabled && "pointer-events-none opacity-30",
            )}
          >
            {c.d}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs">
        <button
          type="button"
          onClick={() => onSelect("")}
          className="font-medium text-primary hover:underline"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={selectToday}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          Today
        </button>
      </div>
    </div>
  );
}

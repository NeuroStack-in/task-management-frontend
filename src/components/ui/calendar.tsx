"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const monthKeyOf = (iso: string) => +iso.slice(0, 4) * 12 + (+iso.slice(5, 7) - 1);
/** Years shown per page in the year grid (a 3×4 grid). */
const YEARS_PER_PAGE = 12;

/**
 * Themed month calendar (Graphite & Indigo). Pure date math — no external deps.
 * `value`/`min`/`max` are ISO "YYYY-MM-DD"; `onSelect("")` clears.
 *
 * **Three navigation levels**, so reaching a far-off year (a date of birth, say) is a couple of
 * clicks, not hundreds of month taps: the header title steps *out* — days → months → years — and
 * picking a cell steps back *in*. The arrows page whatever level is showing (a month, a year, or a
 * block of years).
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
  const [mode, setMode] = useState<"days" | "months" | "years">("days");

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

  // A whole month/year is out of range only when *no* day in it falls within [min, max].
  const monthDisabled = (y: number, m0: number) => {
    const last = new Date(y, m0 + 1, 0).getDate();
    return (
      (max !== undefined && toIso(y, m0, 1) > max) ||
      (min !== undefined && toIso(y, m0, last) < min)
    );
  };
  const yearDisabled = (y: number) =>
    (max !== undefined && `${y}-01-01` > max) ||
    (min !== undefined && `${y}-12-31` < min);

  const minYear = min ? +min.slice(0, 4) : -Infinity;
  const maxYear = max ? +max.slice(0, 4) : Infinity;
  const yearPageStart = Math.floor(view.y / YEARS_PER_PAGE) * YEARS_PER_PAGE;

  // Paging is mode-aware: a month, a year, or a block of years.
  const canPrev =
    mode === "days"
      ? view.y * 12 + view.m0 > (min ? monthKeyOf(min) : -Infinity)
      : mode === "months"
        ? view.y - 1 >= minYear
        : yearPageStart - 1 >= minYear;
  const canNext =
    mode === "days"
      ? view.y * 12 + view.m0 < (max ? monthKeyOf(max) : Infinity)
      : mode === "months"
        ? view.y + 1 <= maxYear
        : yearPageStart + YEARS_PER_PAGE <= maxYear;
  const navigate = (dir: -1 | 1) =>
    setView((v) => {
      if (mode === "days") {
        const total = v.y * 12 + v.m0 + dir;
        return { y: Math.floor(total / 12), m0: ((total % 12) + 12) % 12 };
      }
      if (mode === "months") return { ...v, y: v.y + dir };
      return { ...v, y: v.y + dir * YEARS_PER_PAGE };
    });

  const selectToday = () => {
    const now = new Date();
    let iso = toIso(now.getFullYear(), now.getMonth(), now.getDate());
    if (min && iso < min) iso = min;
    if (max && iso > max) iso = max;
    setView({ y: +iso.slice(0, 4), m0: +iso.slice(5, 7) - 1 });
    setMode("days");
    onSelect(iso);
  };

  const title =
    mode === "days"
      ? `${MONTHS[view.m0]} ${view.y}`
      : mode === "months"
        ? `${view.y}`
        : `${yearPageStart} – ${yearPageStart + YEARS_PER_PAGE - 1}`;

  return (
    <div
      className={cn(
        // Compact by design: this opens inside dialogs whose body is only a few hundred pixels tall
        // (Add task), so every row of padding is a row of the month that gets clipped instead.
        "w-60 rounded-lg border bg-popover p-2.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        {/* The title steps OUT a level (days → months → years); at the top level it's inert. */}
        <button
          type="button"
          disabled={mode === "years"}
          onClick={() => setMode((m) => (m === "days" ? "months" : "years"))}
          aria-label="Change month or year"
          className="rounded-md px-1.5 py-0.5 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
        >
          {title}
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => navigate(-1)}
            aria-label="Previous"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => navigate(1)}
            aria-label="Next"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {mode === "days" ? (
        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="flex h-6 items-center justify-center text-[11px] font-medium text-muted-foreground"
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
                "flex size-7 items-center justify-center rounded-md text-[13px] transition-colors",
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
      ) : mode === "months" ? (
        <div className="grid grid-cols-3 gap-1 py-1">
          {MONTHS_SHORT.map((label, m0) => {
            const disabled = monthDisabled(view.y, m0);
            const selected =
              value !== undefined &&
              value !== "" &&
              +value.slice(0, 4) === view.y &&
              +value.slice(5, 7) - 1 === m0;
            return (
              <button
                key={label}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setView((v) => ({ ...v, m0 }));
                  setMode("days");
                }}
                className={cn(
                  "flex h-9 items-center justify-center rounded-md text-[13px] transition-colors",
                  selected
                    ? "bg-primary font-medium text-primary-foreground hover:bg-primary"
                    : "text-foreground hover:bg-muted",
                  disabled && "pointer-events-none opacity-30",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 py-1">
          {Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i).map((y) => {
            const disabled = yearDisabled(y);
            const selected = value !== undefined && value !== "" && +value.slice(0, 4) === y;
            return (
              <button
                key={y}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setView((v) => ({ ...v, y }));
                  setMode("months");
                }}
                className={cn(
                  "flex h-9 items-center justify-center rounded-md text-[13px] tabular-nums transition-colors",
                  selected
                    ? "bg-primary font-medium text-primary-foreground hover:bg-primary"
                    : y === view.y
                      ? "text-foreground ring-1 ring-border hover:bg-muted"
                      : "text-foreground hover:bg-muted",
                  disabled && "pointer-events-none opacity-30",
                )}
              >
                {y}
              </button>
            );
          })}
        </div>
      )}

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

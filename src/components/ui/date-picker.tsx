"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "./calendar";
import { ScrollArea } from "./scroll-area";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${MONTHS_SHORT[+m - 1]} ${+d}, ${y}`;
};

/** Close on outside-click / Escape while open. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

const TRIGGER =
  "flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/**
 * Rough popup extents, used only to choose a side before the popup exists.
 *
 * Measuring for real would need a render-then-measure pass and a reflow; the popup is a fixed
 * layout, so a constant is honest and cheaper. Slightly over-estimating is the safe direction — it
 * flips a fraction early rather than a fraction late.
 */
const CAL_W = 264;
const CAL_H = 320;
const TIME_H = 240;
const EDGE = 8;

/**
 * Which side to open on, given the trigger's position.
 *
 * The horizontal half already existed; the vertical half is new. A picker inside a dialog was
 * hardcoded to `top-full`, so on the Add-task form — where the field sits low in a scrollable body —
 * the calendar opened downward into the dialog's bottom edge and was clipped. The user then had to
 * scroll the dialog to reach dates, and the last week of the month was simply unreachable.
 *
 * Flip up only when there genuinely isn't room below **and** there is more room above: an
 * unconditional flip would just clip against the top edge instead on a short viewport.
 */
function pickSide(rect: DOMRect, height: number) {
  const below = window.innerHeight - rect.bottom;
  const above = rect.top;
  return {
    alignRight: rect.left + CAL_W > window.innerWidth - EDGE,
    dropUp: below < height + EDGE && above > below,
  };
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "mm/dd/yyyy",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState({ alignRight: false, dropUp: false });
  const ref = useDismiss(open, () => setOpen(false));
  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      // Decide the side from the trigger's live position, on every open — the same field can sit high
      // or low depending on how far a scrollable dialog has been scrolled.
      if (next && ref.current) {
        setSide(pickSide(ref.current.getBoundingClientRect(), CAL_H));
      }
      return next;
    });
  };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={toggle} className={cn(TRIGGER, className)}>
        <CalendarIcon className="size-4 text-muted-foreground" />
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value ? formatDate(value) : placeholder}
        </span>
      </button>
      {open ? (
        <div
          className={cn(
            "absolute z-50",
            side.dropUp ? "bottom-full mb-2" : "top-full mt-2",
            side.alignRight ? "right-0" : "left-0",
          )}
        >
          <Calendar
            value={value}
            min={min}
            max={max}
            onSelect={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

// Full 24h in half-hour steps — a filter clipped to office hours can't select an evening
// screenshot (the agent captures whenever a timer runs, not 9-to-5).
const TIMES = (() => {
  const out: string[] = [];
  for (let h = 0; h <= 23; h++) {
    for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return out;
})();

export function TimePicker({
  value,
  onChange,
  placeholder = "--:--",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Same flip-when-there's-no-room-below as DatePicker: this list is ~240px and appears in the same
  // dialogs, so hardcoding `top-full` clipped it against the bottom edge in exactly the same way.
  const [side, setSide] = useState({ alignRight: false, dropUp: false });
  const ref = useDismiss(open, () => setOpen(false));
  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next && ref.current) {
        setSide(pickSide(ref.current.getBoundingClientRect(), TIME_H));
      }
      return next;
    });
  };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className={cn(TRIGGER, "justify-between", className)}
      >
        <Clock className="size-4 text-muted-foreground" />
        <span className={value ? "font-mono text-foreground" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
      </button>
      {open ? (
        <div
          className={cn(
            "absolute z-50 w-32 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
            side.dropUp ? "bottom-full mb-2" : "top-full mt-2",
            side.alignRight ? "right-0" : "left-0",
          )}
        >
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
          >
            Any time
          </button>
          <ScrollArea className="h-48">
            <div className="space-y-0.5 pr-2">
              {TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onChange(t);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-1.5 text-left font-mono text-sm transition-colors hover:bg-muted",
                    value === t && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      ) : null}
    </div>
  );
}

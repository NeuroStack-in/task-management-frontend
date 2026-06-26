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
  "flex h-8 items-center gap-2 rounded-lg border bg-background px-3 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

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
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(TRIGGER, className)}
      >
        <CalendarIcon className="size-4 text-muted-foreground" />
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value ? formatDate(value) : placeholder}
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2">
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

const TIMES = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 21; h++) {
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
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(TRIGGER, "justify-between", className)}
      >
        <Clock className="size-4 text-muted-foreground" />
        <span className={value ? "font-mono text-foreground" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-32 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
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

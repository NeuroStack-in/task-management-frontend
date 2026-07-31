"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/**
 * An anchored popup that a dialog cannot clip.
 *
 * **Why a portal.** The popup used to be `absolute` inside the trigger's box, which put it inside the
 * dialog's scrolling body — so it was clipped by that box. Opening the Add-task date field showed a
 * calendar with its month header cut off and the last week unreachable; flipping it upwards (the
 * previous attempt) only moved the clipping to the other edge. Rendering into `document.body` with
 * `position: fixed` takes it out of that stacking/overflow context entirely, which is what every
 * popover library does and the only thing that actually fixes it.
 *
 * Consequences handled here:
 * - **Outside-click needs both refs.** The panel is no longer a DOM descendant of the trigger, so a
 *   click inside the calendar would look "outside" and close it before the date registered.
 * - **Fixed coordinates go stale.** They're viewport-relative, so any scroll or resize while open
 *   would leave the panel behind. Both recompute the anchor.
 */
function useAnchoredPopup(width: number, height: number) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Prefer below; flip above only when there genuinely isn't room and there is more above —
    // an unconditional flip just clips against the top on a short viewport.
    const below = window.innerHeight - r.bottom;
    const above = r.top;
    const dropUp = below < height + GAP + EDGE && above > below;
    const top = dropUp ? r.top - height - GAP : r.bottom + GAP;
    setPos({
      // Clamp into the viewport on both axes so a trigger near any edge still shows a whole panel.
      top: Math.max(EDGE, Math.min(top, window.innerHeight - height - EDGE)),
      left: Math.max(EDGE, Math.min(r.left, window.innerWidth - width - EDGE)),
    });
  }, [width, height]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // `true` (capture) so a scroll inside the dialog body reaches this — scroll does not bubble.
    const onMove = () => place();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  const toggle = () => {
    if (!open) place();
    setOpen((o) => !o);
  };

  return { open, setOpen, toggle, triggerRef, panelRef, pos };
}

const TRIGGER =
  "flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/**
 * Popup extents, used to place the panel before it exists.
 *
 * Measuring for real would need a render-then-measure pass and a reflow; both panels are fixed
 * layouts, so constants are honest and cheaper. Keep them in step with the components: the calendar
 * is `w-60` (240px) and roughly 250px tall after the compaction; the time list is `w-32` with a
 * 12rem scroll area.
 */
const CAL_W = 240;
const CAL_H = 260;
const TIME_W = 128;
const TIME_H = 240;
/** Breathing room from the trigger, and from the viewport edge. */
const GAP = 6;
const EDGE = 8;

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
  const { open, setOpen, toggle, triggerRef, panelRef, pos } =
    useAnchoredPopup(CAL_W, CAL_H);

  return (
    <div ref={triggerRef} className="relative">
      <button type="button" onClick={toggle} className={cn(TRIGGER, className)}>
        <CalendarIcon className="size-4 text-muted-foreground" />
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value ? formatDate(value) : placeholder}
        </span>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              // z-[60]: above the dialog overlay (z-50), since it is now a sibling of it rather
              // than a descendant.
              className="fixed z-[60]"
              style={{ top: pos.top, left: pos.left }}
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
            </div>,
            document.body,
          )
        : null}
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
  // Same portal treatment as DatePicker — it appears in the same dialogs and was clipped the same way.
  const { open, setOpen, toggle, triggerRef, panelRef, pos } =
    useAnchoredPopup(TIME_W, TIME_H);

  return (
    <div ref={triggerRef} className="relative">
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
      {open && pos ? (
        createPortal(
        <div
          ref={panelRef}
          className="fixed z-[60] w-32 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
          style={{ top: pos.top, left: pos.left }}
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
        </div>,
        document.body,
        )
      ) : null}
    </div>
  );
}

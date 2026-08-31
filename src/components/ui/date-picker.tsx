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
const TIME_W = 232;
const TIME_H = 272;
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

/** `"HH:MM"` (24h) → the three parts the picker works in. */
export function split(value: string): { h12: number | null; m: number | null; ampm: "AM" | "PM" | null } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { h12: null, m: null, ampm: null };
  const h24 = Number(match[1]);
  const m = Number(match[2]);
  if (h24 > 23 || m > 59) return { h12: null, m: null, ampm: null };
  return {
    h12: h24 % 12 === 0 ? 12 : h24 % 12,
    m,
    ampm: h24 < 12 ? "AM" : "PM",
  };
}

/** The three parts → `"HH:MM"` (24h), the format every caller and the API already speak. */
export function join(h12: number, m: number, ampm: "AM" | "PM"): string {
  const h24 = ampm === "AM" ? h12 % 12 : (h12 % 12) + 12;
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** `"HH:MM"` → `"09:00 AM"`, for the trigger. Invalid input falls back to the raw string. */
export function label12(value: string): string {
  const { h12, m, ampm } = split(value);
  if (h12 === null || m === null || ampm === null) return value;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * A time of day, in the app's own styling.
 *
 * **Why this is not `<input type="time">`.** The native control renders the OS picker: its own
 * typeface, its own palette, its own blue selection — the settings screenshot that prompted this
 * showed a stack of bright system-blue tiles sitting inside a warm off-white card, ignoring every
 * token the rest of the page uses. It is also the one control a design system cannot reach: there
 * is no styling hook for the panel in any browser.
 *
 * **Why three columns rather than the flat list this replaced.** The old panel listed every slot in
 * the day — 48 rows at 30-minute steps, 96 at 15. Finding 09:00 meant scrolling a list where every
 * row looks like its neighbours, and finer granularity made it worse, so precision and usability
 * pulled against each other. Hour / minute / meridiem is bounded: twelve, a handful, two.
 *
 * **It closes when the time is complete, not when you click.** A click sets one part; the popup
 * closes on the one that completes all three. Closing on first click would make the common case
 * (changing only the minutes) impossible without reopening, and never closing leaves the panel
 * covering the field you are trying to check.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "--:--",
  className,
  /**
   * Minutes between options in the middle column. 30 by default; a leave permission passes 15
   * because the native input it replaced allowed five-minute precision and half-hours would have
   * made "14:15 to 15:45" unrequestable.
   */
  stepMinutes = 30,
  /**
   * Offer "Any time", which clears the value.
   *
   * Defaults **on** because this began life as a filter control and every existing caller is one —
   * clearing is how you widen a filter back out. A field that must hold a time (working hours)
   * passes `false`: there, an empty value is not a broader question, it is a missing setting.
   */
  clearable = true,
  disabled = false,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  stepMinutes?: number;
  clearable?: boolean;
  disabled?: boolean;
  /** Forwarded to the trigger so a `<Label htmlFor>` still points at something focusable. */
  id?: string;
}) {
  const { open, setOpen, toggle, triggerRef, panelRef, pos } =
    useAnchoredPopup(TIME_W, TIME_H);

  const current = split(value);
  // Draft state, so a half-made selection survives until it is complete. Seeded from `value` each
  // time the panel opens: reopening a field must show what it currently holds, not what someone
  // half-typed into it an hour ago.
  const [draft, setDraft] = useState(current);
  useEffect(() => {
    if (open) setDraft(split(value));
  }, [open, value]);

  const minutes = [];
  for (let m = 0; m < 60; m += stepMinutes) minutes.push(m);

  /** Apply one part, and commit + close only once all three are known. */
  const pick = (part: Partial<typeof draft>) => {
    const next = { ...draft, ...part };
    setDraft(next);
    if (next.h12 !== null && next.m !== null && next.ampm !== null) {
      onChange(join(next.h12, next.m, next.ampm));
      setOpen(false);
    }
  };

  const colBtn = (selected: boolean) =>
    cn(
      "w-full rounded-md px-2 py-1.5 text-center font-mono text-sm transition-colors",
      selected
        ? "bg-primary text-primary-foreground"
        : "text-foreground hover:bg-muted",
    );

  return (
    <div ref={triggerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={cn(
          TRIGGER,
          "justify-between",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <Clock className="size-4 text-muted-foreground" />
        <span className={value ? "font-mono text-foreground" : "text-muted-foreground"}>
          {value ? label12(value) : placeholder}
        </span>
      </button>
      {open && pos ? (
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[60] rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
            style={{ top: pos.top, left: pos.left, width: TIME_W }}
          >
            <div className="grid grid-cols-3 gap-1">
              {/* Column headers: three unlabelled columns of numbers are a puzzle, and the middle
                  one is ambiguous at a glance (is 15 an hour or a minute?). */}
              <div className="text-muted-foreground pb-1 text-center text-[10px] font-medium tracking-wide uppercase">
                Hour
              </div>
              <div className="text-muted-foreground pb-1 text-center text-[10px] font-medium tracking-wide uppercase">
                Min
              </div>
              <div className="text-muted-foreground pb-1 text-center text-[10px] font-medium tracking-wide uppercase">
                AM/PM
              </div>

              <ScrollArea className="h-44">
                <div className="space-y-0.5 pr-1.5">
                  {HOURS_12.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => pick({ h12: h })}
                      className={colBtn(draft.h12 === h)}
                    >
                      {String(h).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </ScrollArea>

              <ScrollArea className="h-44">
                <div className="space-y-0.5 pr-1.5">
                  {minutes.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => pick({ m })}
                      className={colBtn(draft.m === m)}
                    >
                      {String(m).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </ScrollArea>

              <div className="space-y-0.5">
                {(["AM", "PM"] as const).map((ap) => (
                  <button
                    key={ap}
                    type="button"
                    onClick={() => pick({ ampm: ap })}
                    className={colBtn(draft.ampm === ap)}
                  >
                    {ap}
                  </button>
                ))}
              </div>
            </div>

            {clearable ? (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-muted-foreground hover:bg-muted mt-1 flex w-full items-center justify-center rounded-md px-2 py-1.5 text-sm"
              >
                Any time
              </button>
            ) : null}
          </div>,
          document.body,
        )
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Breathing room from the trigger, and from the viewport edge. */
const GAP = 6;
const EDGE = 8;

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
export function useAnchoredPopup(width: number, height: number) {
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


/** The shared trigger styling every anchored control uses, so they line up in a form row. */
export const TRIGGER =
  "flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

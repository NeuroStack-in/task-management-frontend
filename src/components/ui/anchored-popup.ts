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
 * - **The keyboard has to be carried across.** A panel at the end of `<body>` is nowhere near the
 *   trigger in tab order — inside a modal dialog Tab never reached it — and a plain `document`
 *   Escape listener fired alongside the dialog's own, so dismissing the calendar closed the whole
 *   dialog (QA audit 2026-10-08, WP-363). So focus moves into the panel when it opens (onto its
 *   `[data-autofocus]` element, else the first control), Tab cycles inside it, Escape closes only
 *   the popup — intercepted in the capture phase, before any dialog sees it — and focus returns to
 *   the trigger when it closes.
 */
/** Tab stops only — a roving `tabindex="-1"` cell (the calendar's other days) is not one. */
const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  "[tabindex]",
]
  .map((s) => `${s}:not([tabindex="-1"])`)
  .join(", ");

function focusablesIn(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
}

export function useAnchoredPopup(width: number, height: number) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

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
    // Capture phase on `window`, so this runs before any dialog's `document` listener — and stopping
    // the event here means the dialog never sees an Escape that was meant for the popup on top of it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "Tab" && panelRef.current?.contains(document.activeElement)) {
        const items = focusablesIn(panelRef.current);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    // `true` (capture) so a scroll inside the dialog body reaches this — scroll does not bubble.
    const onMove = () => place();
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  // Into the panel once it has mounted (it renders only when `pos` is set).
  useEffect(() => {
    if (!open || !pos) return;
    const frame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      (panel.querySelector<HTMLElement>("[data-autofocus]") ?? focusablesIn(panel)[0])?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, pos]);

  // Back to the trigger on close — when focus was in the panel that just unmounted (it lands on
  // <body>), not when the user clicked into something else on purpose.
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || panelRef.current?.contains(active)) {
      triggerRef.current?.querySelector<HTMLElement>("button")?.focus();
    }
  }, [open]);

  const toggle = () => {
    if (!open) place();
    setOpen((o) => !o);
  };

  return { open, setOpen, toggle, triggerRef, panelRef, pos };
}


/** The shared trigger styling every anchored control uses, so they line up in a form row. */
export const TRIGGER =
  "flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

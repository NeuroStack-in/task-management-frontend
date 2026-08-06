"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTourStore } from "@/stores/tour.store";
import { usePermissions } from "@/hooks/use-permissions";
import { getTour, type TourStep } from "@/modules/help/lib/tours";
import { cn } from "@/lib/utils";

/**
 * Guided product tours — the overlay behind the Help Center's "Start tour" buttons.
 *
 * ## Why this is hand-rolled
 *
 * `react-joyride` was tried first (it was already an unused dependency). Two things killed it: v2
 * calls React DOM APIs removed in React 18, and v3 parses every colour through `hexToRGB`, so the
 * theme's `var(--primary)` tokens became `NaN` — a full-screen grey overlay with an invisible
 * tooltip. Patching around that meant either hardcoding hexes (abandoning light/dark theming) or
 * fighting a library whose API had already changed under us once.
 *
 * The actual requirement is small and entirely ours: dim the page, cut a hole around one element,
 * and float a card near it. Doing it directly costs ~200 lines and buys exact design-system
 * fidelity — real `Button`s, real tokens, correct in both themes — with no third-party CSS.
 *
 * ## The spotlight is a box-shadow, not a mask
 *
 * A `<div>` the size of the target with `box-shadow: 0 0 0 9999px <dim>` paints the dimmer
 * *everywhere except itself*. That gets a spotlight with one CSS property — no SVG mask, no
 * four-rectangle backdrop with seams at the corners, and it animates smoothly when the rect moves.
 *
 * ## Everything is measured from the live element
 *
 * The rect is re-measured on scroll and resize, and the target is scrolled into view before the
 * first measurement, so a step never points at something off-screen or stale.
 */

/** Gap between the spotlight and the tooltip. */
const GAP = 14;
/** Breathing room around the highlighted element. */
const PAD = 8;
/** Tooltip width. Wide enough for two lines of prose, narrow enough to sit beside a sidebar item. */
const CARD_W = 380;
/** Keep the card this far from the viewport edge. */
const MARGIN = 16;
/**
 * How long to wait for a step's target — **budgeted by what we're actually waiting for.**
 *
 * A single 8 s timeout was wrong in both directions. When the target simply doesn't exist for this
 * user, 8 s of "Loading step…" is indistinguishable from a hang; when a route is genuinely being
 * fetched, anything less is too short. So they're separate:
 *
 * - Already on the step's route ⇒ the element is either mounted or a render away. `SAME_ROUTE_MS`.
 * - Changing route ⇒ Next has to fetch a chunk, mount and paint. `NAV_MS`.
 */
const SAME_ROUTE_MS = 1200;
const NAV_MS = 5000;
const POLL_MS = 60;
/**
 * Don't show the loader until a step has actually been slow.
 *
 * Most steps resolve in a frame or two. Rendering a spinner for them makes a smooth tour flicker,
 * which is what made the last one feel broken even on the steps that worked.
 */
const LOADER_DELAY_MS = 450;

type Rect = { top: number; left: number; width: number; height: number };
type Placement = "top" | "bottom" | "left" | "right" | "center";

const selector = (target: string) => `[data-tour="${CSS.escape(target)}"]`;

/**
 * The **visible** element for a target, not merely the first in the DOM.
 *
 * `SidebarNav` is mounted twice — once in the desktop aside, once inside the navbar's mobile sheet —
 * so every `nav:` target has two matches. `querySelector` returns whichever comes first in document
 * order, which can be the hidden one, and the spotlight then draws around a zero-ish rect at the
 * wrong place. That is exactly what put the highlight over the sidebar's logo instead of the nav
 * item someone was being shown.
 *
 * A hidden element (`display:none`, or an unmounted sheet) reports no client rects, so filtering on
 * that picks the one actually on screen — whichever mount it belongs to, at whatever viewport width.
 */
function visibleTarget(sel: string): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(sel));
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (el.getClientRects().length > 0 && r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * Measure once the element has stopped moving.
 *
 * `scrollIntoView({behavior:"smooth"})` animates for an unspecified duration, and the sidebar's nav
 * lives in its own scroll container, so a fixed delay is a guess that is sometimes wrong — measure
 * too early and the spotlight sits where the element *was*. Polling until the rect repeats is the
 * only honest way to know the scroll finished.
 */
function whenStill(el: HTMLElement, done: (r: DOMRect) => void, cancelled: () => boolean) {
  let last: DOMRect | null = null;
  let stable = 0;
  const step = () => {
    if (cancelled()) return;
    const r = el.getBoundingClientRect();
    if (last && Math.abs(r.top - last.top) < 0.5 && Math.abs(r.left - last.left) < 0.5) {
      stable += 1;
    } else {
      stable = 0;
    }
    last = r;
    // Three identical frames: enough to be sure, short enough to feel immediate.
    if (stable >= 3) done(r);
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Choose a side with room for the card, preferring below → above → right → left. */
function place(rect: Rect, cardH: number): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (rect.top + rect.height + GAP + cardH + MARGIN < vh) return "bottom";
  if (rect.top - GAP - cardH - MARGIN > 0) return "top";
  if (rect.left + rect.width + GAP + CARD_W + MARGIN < vw) return "right";
  if (rect.left - GAP - CARD_W - MARGIN > 0) return "left";
  return "bottom";
}

/** Card position for a placement, clamped so it can never leave the viewport. */
function cardPos(rect: Rect, placement: Placement, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), vw - CARD_W - MARGIN);
  const clampY = (y: number) => Math.min(Math.max(y, MARGIN), vh - cardH - MARGIN);

  switch (placement) {
    case "bottom":
      return {
        top: clampY(rect.top + rect.height + GAP),
        left: clampX(rect.left + rect.width / 2 - CARD_W / 2),
      };
    case "top":
      return {
        top: clampY(rect.top - GAP - cardH),
        left: clampX(rect.left + rect.width / 2 - CARD_W / 2),
      };
    case "right":
      return {
        top: clampY(rect.top + rect.height / 2 - cardH / 2),
        left: clampX(rect.left + rect.width + GAP),
      };
    case "left":
      return {
        top: clampY(rect.top + rect.height / 2 - cardH / 2),
        left: clampX(rect.left - GAP - CARD_W),
      };
    default:
      return { top: vh / 2 - cardH / 2, left: vw / 2 - CARD_W / 2 };
  }
}

export function ProductTour() {
  const router = useRouter();
  const pathname = usePathname();
  const { can } = usePermissions();

  const activeTourId = useTourStore((s) => s.activeTourId);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const setStepIndex = useTourStore((s) => s.setStepIndex);
  const stopTour = useTourStore((s) => s.stopTour);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [rect, setRect] = useState<Rect | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [cardH, setCardH] = useState(180);
  const cardRef = useRef<HTMLDivElement>(null);

  /** Steps this caller can actually be shown — see `tours.ts` on why they're removed, not skipped. */
  const steps: TourStep[] = useMemo(() => {
    const tour = activeTourId ? getTour(activeTourId) : undefined;
    if (!tour) return [];
    return tour.steps.filter((s) => !s.permission || can(s.permission));
  }, [activeTourId, can]);

  const step: TourStep | undefined = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  // A tour with nothing to show for this role says so rather than opening empty.
  const checked = useRef<string | null>(null);
  useEffect(() => {
    if (!activeTourId || !mounted) {
      checked.current = null;
      return;
    }
    if (checked.current === activeTourId) return;
    checked.current = activeTourId;
    if (steps.length === 0) {
      toast.info("That walkthrough isn't available for your role.");
      stopTour();
    }
  }, [activeTourId, mounted, steps.length, stopTour]);

  // Navigate to the step's route. Separate from the measuring effect so a re-measure (scroll,
  // resize) never re-triggers navigation.
  useEffect(() => {
    if (!step) return;
    if (step.route && step.route !== pathname) router.push(step.route);
  }, [step, pathname, router]);

  /**
   * Find and measure the step's target, waiting for it to exist.
   *
   * A route change means the element cannot be there yet — Next has to fetch, mount and paint — so
   * this polls rather than assuming. A target that never arrives advances instead of hanging:
   * a stuck overlay with a live Next button that does nothing is the worst available failure, and
   * is exactly what the previous implementation did.
   */
  useEffect(() => {
    if (!mounted || !step) return;
    let cancelled = false;

    // Clear the previous step's spotlight up front. Without this, a step that has to wait keeps
    // drawing the *last* step's rectangle — a highlight that points confidently at the wrong thing,
    // which is worse than none.
    setRect(null);

    // A centred step needs no target — show it immediately. (`target` is required by the type, so
    // this is a guard against data that bypassed it, not a supported shape.)
    if (!step.target) {
      setWaiting(false);
      return;
    }

    // Budget by what we're waiting for: a same-route element is a render away, a route change is a
    // network fetch. Using the navigation budget for both is what turned an absent target into
    // eight seconds of "Loading step…".
    const navigating = !!step.route && step.route !== pathname;
    const deadline = Date.now() + (navigating ? NAV_MS : SAME_ROUTE_MS);

    // The loader appears only if the step is genuinely slow; a fast step never flickers.
    setWaiting(false);
    const loaderTimer = setTimeout(() => !cancelled && setWaiting(true), LOADER_DELAY_MS);

    const settle = () => {
      clearTimeout(loaderTimer);
      setWaiting(false);
    };

    const tick = () => {
      if (cancelled) return;
      // The visible match — `nav:` targets exist twice (desktop aside + mobile sheet).
      const el = visibleTarget(selector(step.target!));
      if (el) {
        // Only scroll when the element isn't already comfortably in view; scrolling something
        // **Always** scroll, and let `block: "nearest"` decide whether anything moves.
        //
        // The previous "is it in view?" check compared the rect against `window.innerHeight`, which
        // is wrong for anything inside a scroll container: a sidebar item scrolled out of the nav's
        // own ScrollArea still reports a rect within the window — usually overlapping the header —
        // so the check said "visible", the scroll was skipped, and the spotlight was drawn over the
        // logo. `nearest` is a no-op when the element is genuinely visible (so nothing twitches)
        // and scrolls the right container when it isn't.
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
        // Measure once it has stopped moving, however long the scroll takes.
        whenStill(
          el,
          (r) => {
            setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
            settle();
          },
          () => cancelled,
        );
        return;
      }
      if (Date.now() > deadline) {
        // The target doesn't exist for this user. Skip on rather than strand them — a stuck overlay
        // with a live Next button that does nothing is the worst failure available.
        settle();
        if (stepIndex + 1 < steps.length) setStepIndex(stepIndex + 1);
        else stopTour();
        return;
      }
      setTimeout(tick, POLL_MS);
    };
    // `querySelector` uses the selector built in tours.ts; assert non-null after the guard above.
    tick();

    return () => {
      cancelled = true;
      clearTimeout(loaderTimer);
    };
    // `step.target` is the identity that matters; pathname re-runs it after a navigation lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, step?.target, step?.route, pathname, stepIndex, steps.length]);

  /**
   * Keep the spotlight glued to its element, every frame.
   *
   * This was `scroll` + `resize` listeners, which only cover the ways we thought of. An element can
   * also move because a container scrolled without bubbling a window-level event, because a layout
   * shifted as data loaded, because a CSS transition ran, or because a breakpoint swapped which of
   * the two sidebar mounts is live. Every one of those leaves a spotlight sitting confidently over
   * the wrong thing — the failure this tour has produced in three different disguises.
   *
   * A rAF loop is immune to all of them: it re-reads the rect from the DOM rather than inferring
   * that it might have changed. It runs only while a step is on screen, and `setRect` is called only
   * when the numbers actually differ, so React re-renders no more than the listeners caused.
   */
  useEffect(() => {
    if (!step?.target || waiting) return;
    let raf = 0;
    let last: Rect | null = null;

    const follow = () => {
      // Same visible-match rule as the initial measure — a resize across the `lg` breakpoint swaps
      // which sidebar mount is on screen, and following the hidden one would jump the spotlight.
      const el = visibleTarget(selector(step.target!));
      if (el) {
        const r = el.getBoundingClientRect();
        if (
          !last ||
          Math.abs(r.top - last.top) > 0.5 ||
          Math.abs(r.left - last.left) > 0.5 ||
          Math.abs(r.width - last.width) > 0.5 ||
          Math.abs(r.height - last.height) > 0.5
        ) {
          last = { top: r.top, left: r.left, width: r.width, height: r.height };
          setRect(last);
        }
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [step?.target, waiting]);

  // Measure the card so placement can account for its real height rather than a guess.
  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [step, waiting]);

  const next = useCallback(() => {
    if (isLast) stopTour();
    else setStepIndex(stepIndex + 1);
  }, [isLast, stepIndex, setStepIndex, stopTour]);

  const back = useCallback(() => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }, [stepIndex, setStepIndex]);

  // Escape exits, arrows navigate. A tour is a modal state; leaving the keyboard inert in it is the
  // kind of thing that reads as broken.
  useEffect(() => {
    if (!activeTourId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopTour();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTourId, next, back, stopTour]);

  if (!mounted || !activeTourId || !step) return null;

  const placement: Placement = rect ? place(rect, cardH) : "center";
  const pos = rect ? cardPos(rect, placement, cardH) : cardPos({ top: 0, left: 0, width: 0, height: 0 }, "center", cardH);

  return createPortal(
    <div className="fixed inset-0 z-[9998]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* Dimmer + spotlight in one element: the box-shadow paints everywhere EXCEPT this rect. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-lg ring-2 ring-primary/70 transition-all duration-300 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.62)",
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(2,6,23,0.62)]" />
      )}

      {/* Swallows clicks on the dimmed area so the page can't be interacted with mid-tour, without
          closing the tour — a misclick shouldn't lose someone's place. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {waiting ? (
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5 rounded-full bg-card px-4 py-2.5 text-sm text-card-foreground shadow-lg">
          <Loader2 className="size-4 animate-spin text-primary" />
          Loading step…
          <button
            onClick={stopTour}
            className="ml-1 text-muted-foreground underline-offset-2 hover:underline"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div
          ref={cardRef}
          className={cn(
            "absolute rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xl",
            "transition-all duration-300 ease-out",
          )}
          style={{ top: pos.top, left: pos.left, width: CARD_W }}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                Step {stepIndex + 1} of {steps.length}
              </p>
              <h3 className="font-display text-base font-semibold leading-snug">{step.title}</h3>
            </div>
            <button
              onClick={stopTour}
              aria-label="Close tour"
              className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">{step.content}</p>

          {/* Progress bar doubles as the step map — a count alone doesn't show how much is left. */}
          <div className="mt-4 flex gap-1" aria-hidden>
            {steps.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= stepIndex ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={stopTour}
              className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <Button size="sm" variant="outline" onClick={back}>
                  <ArrowLeft className="size-3.5" />
                  Back
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {isLast ? (
                  <>
                    <Check className="size-3.5" />
                    Done
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

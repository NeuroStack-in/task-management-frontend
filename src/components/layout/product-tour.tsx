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
/** How long to wait for a step's target after navigating before giving up on it. */
const WAIT_MS = 8000;
const POLL_MS = 80;

type Rect = { top: number; left: number; width: number; height: number };
type Placement = "top" | "bottom" | "left" | "right" | "center";

const selector = (target: string) => `[data-tour="${CSS.escape(target)}"]`;

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

    // A centred step needs no target — show it immediately.
    if (!step.target) {
      setRect(null);
      setWaiting(false);
      return;
    }

    setWaiting(true);
    const deadline = Date.now() + WAIT_MS;

    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector(selector(step.target!)) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        // Let the smooth scroll settle before measuring, or the spotlight lands where the element
        // *was* and slides away from it.
        setTimeout(() => {
          if (cancelled) return;
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          setWaiting(false);
        }, 320);
        return;
      }
      if (Date.now() > deadline) {
        // Don't strand them: move on if there's anywhere to go.
        setWaiting(false);
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
    };
    // `step.target` is the identity that matters; pathname re-runs it after a navigation lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, step?.target, step?.route, pathname, stepIndex, steps.length]);

  // Keep the spotlight glued to the element while the page moves under it.
  useEffect(() => {
    if (!step?.target || waiting) return;
    const remeasure = () => {
      const el = document.querySelector(selector(step.target!)) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener("scroll", remeasure, true);
    window.addEventListener("resize", remeasure);
    return () => {
      window.removeEventListener("scroll", remeasure, true);
      window.removeEventListener("resize", remeasure);
    };
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { EVENTS, STATUS, type EventData, type Step } from "react-joyride";
import { useTourStore } from "@/stores/tour.store";
import { usePermissions } from "@/hooks/use-permissions";
import { getTour, type TourStep } from "@/modules/help/lib/tours";

/**
 * Joyride measures the DOM as it initialises, so it cannot render on the server — a plain import
 * makes the whole route bail out of prerendering. Loading it lazily also keeps it out of the bundle
 * for the majority of sessions that never start a tour.
 *
 * **v3 has no default export**, only the named `Joyride`, so the promise is mapped explicitly.
 */
const Joyride = dynamic(() => import("react-joyride").then((m) => m.Joyride), {
  ssr: false,
});

/**
 * How long a step waits for its target after we navigate.
 *
 * Joyride's own `targetWaitTimeout` (default 1000 ms) covers an element that renders late; this is
 * the budget for a *route change* — Next has to fetch the route, mount it and paint before the
 * element can exist at all, which is comfortably more than a second on a cold chunk.
 */
const STEP_WAIT_MS = 8000;
const POLL_MS = 80;

const selector = (target: string) => `[data-tour="${CSS.escape(target)}"]`;

/**
 * Drives the guided walkthroughs launched from the Help Center.
 *
 * Mounted once in the app shell, **not** on the Help page: a tour's later steps live on other
 * routes, by which point the Help page has unmounted and would have taken the tour with it. Living
 * in the shell is precisely what lets a tour walk someone across the product.
 *
 * ## Route changes are the whole problem
 *
 * Joyride positions a tooltip against an element that must already exist. Across a route change
 * there is a window where the old page is gone and the new one hasn't painted, and a tooltip
 * rendered into that gap pins itself to the corner over nothing.
 *
 * v3 solves this properly with `options.before`: an async hook per step that the tour **waits on**,
 * showing a loader. So navigation lives there — push the route, poll until the target exists, then
 * resolve. No manual pausing, no racing Joyride's internal state machine.
 *
 * ## Steps that can't apply are removed, not skipped
 *
 * The sidebar is generated from the caller's permissions, so an employee genuinely has no Employees
 * or Settings link — a tour written for an owner would dead-end for them. Steps declaring a
 * permission the caller lacks are filtered out **before** the tour starts, so the progress counter
 * reads "2 of 3" rather than "2 of 6" with four silent skips. If that leaves nothing, we say so
 * rather than opening an empty tour.
 */
export function ProductTour() {
  const router = useRouter();
  const pathname = usePathname();
  const { can } = usePermissions();

  const activeTourId = useTourStore((s) => s.activeTourId);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const running = useTourStore((s) => s.running);
  const setStepIndex = useTourStore((s) => s.setStepIndex);
  const stopTour = useTourStore((s) => s.stopTour);

  // `dynamic(ssr:false)` still renders nothing on the first client pass; starting before that would
  // measure a DOM that hasn't settled.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /** The steps this caller can actually be shown. */
  const steps: TourStep[] = useMemo(() => {
    const tour = activeTourId ? getTour(activeTourId) : undefined;
    if (!tour) return [];
    return tour.steps.filter((s) => !s.permission || can(s.permission));
  }, [activeTourId, can]);

  // `before` runs inside Joyride and must see the *current* route and step list without being
  // re-created on every render (a changing hook identity restarts the step).
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const indexRef = useRef(stepIndex);
  indexRef.current = stepIndex;

  /**
   * Put the app on the right route and wait for the step's target.
   *
   * Resolves either way — a target that never appears must not hang the tour behind a loader. In
   * that case Joyride raises `TARGET_NOT_FOUND`, which {@link onEvent} advances past.
   */
  const before = useCallback(async () => {
    const step = stepsRef.current[indexRef.current];
    if (!step) return;

    if (step.route && step.route !== pathnameRef.current) {
      router.push(step.route);
    }
    if (!step.target) return;

    const deadline = Date.now() + STEP_WAIT_MS;
    while (Date.now() < deadline) {
      if (document.querySelector(selector(step.target))) return;
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }, [router]);

  // Opening a tour: validate it can be shown at all before anything renders.
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!activeTourId || !mounted) {
      startedFor.current = null;
      return;
    }
    if (startedFor.current === activeTourId) return;
    startedFor.current = activeTourId;

    if (steps.length === 0) {
      toast.info("That walkthrough isn't available for your role.");
      stopTour();
    }
  }, [activeTourId, mounted, steps.length, stopTour]);

  const joyrideSteps: Step[] = useMemo(
    () =>
      steps.map((s) => ({
        target: s.target ? selector(s.target) : "body",
        placement: s.target ? "auto" : "center",
        title: s.title,
        content: s.content,
        // Go straight to the tooltip. A beacon is for a tour the user opts into from the page
        // itself; this one was started by pressing a button that said "Start tour".
        skipBeacon: true,
      })),
    [steps],
  );

  const onEvent = useCallback(
    (data: EventData) => {
      const { index, status, type } = data;

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        stopTour();
        return;
      }
      // STEP_AFTER fires once a step is dismissed; TARGET_NOT_FOUND covers an element that never
      // arrived despite `before` waiting for it. Both mean "move on".
      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        const next = index + 1;
        if (next >= steps.length) {
          stopTour();
          return;
        }
        setStepIndex(next);
        return;
      }
      // Closing the tooltip, pressing Escape, or the tour ending on its own.
      if (type === EVENTS.TOUR_END) {
        stopTour();
      }
    },
    [steps.length, setStepIndex, stopTour],
  );

  if (!mounted || !activeTourId || joyrideSteps.length === 0) return null;

  return (
    <Joyride
      steps={joyrideSteps}
      stepIndex={stepIndex}
      run={running}
      continuous
      onEvent={onEvent}
      options={{
        before,
        // The route change is the slow part, so allow for it and show the loader almost at once
        // rather than leaving a dead overlay while Next fetches a chunk.
        beforeTimeout: STEP_WAIT_MS + 1000,
        loaderDelay: 250,
        targetWaitTimeout: 2000,
        showProgress: true,
        // Read from the theme so the tour follows light/dark and the Graphite & Indigo palette
        // instead of shipping its own hardcoded blue.
        primaryColor: "var(--primary)",
        textColor: "var(--foreground)",
        backgroundColor: "var(--card)",
        arrowColor: "var(--card)",
        overlayColor: "rgba(0,0,0,0.55)",
        spotlightPadding: 6,
        spotlightRadius: 10,
        zIndex: 10000,
        width: 380,
        // Clicking the dimmed backdrop should not silently kill a tour someone is halfway through;
        // Skip and the close button are the deliberate exits.
        overlayClickAction: false,
        dismissKeyAction: "close",
        buttons: ["back", "skip", "primary", "close"],
      }}
      // `locale` is on the component, not in `options` — v3 keeps the strings with the other
      // presentation props (`styles`, `*Component`) rather than with behaviour.
      locale={{ back: "Back", close: "Close", last: "Done", next: "Next", skip: "Skip tour" }}
    />
  );
}

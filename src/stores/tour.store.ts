/**
 * The running product tour.
 *
 * Deliberately **not persisted**. Every other `wp-*` store keeps a durable preference; a tour is a
 * transient thing you are doing right now, and rehydrating one on next login would drop someone
 * into step 3 of a walkthrough they finished last week.
 *
 * It lives in a store rather than in the Help page's own state because the tour outlives that page:
 * step 2 is usually on a different route, at which point the Help page has unmounted. The driver
 * (`components/layout/product-tour.tsx`) mounts in the app shell and reads from here.
 */
import { create } from "zustand";

interface TourState {
  /** Id of the running tour (a key of `TOURS`), or null when nothing is running. */
  activeTourId: string | null;
  /** Index into the *resolved* step list — the one with unavailable steps already removed. */
  stepIndex: number;
  /**
   * False while the driver is navigating between routes.
   *
   * Joyride positions a step against an element that must already be on screen. Across a route
   * change there is a window where the old page is gone and the new one hasn't painted, and a
   * tooltip rendered into that gap lands in the top-left corner over nothing. The driver pauses
   * here, waits for the target, and resumes.
   */
  running: boolean;
  startTour: (id: string) => void;
  stopTour: () => void;
  setStepIndex: (i: number) => void;
  setRunning: (running: boolean) => void;
}

export const useTourStore = create<TourState>((set) => ({
  activeTourId: null,
  stepIndex: 0,
  running: false,
  startTour: (id) => set({ activeTourId: id, stepIndex: 0, running: true }),
  stopTour: () => set({ activeTourId: null, stepIndex: 0, running: false }),
  setStepIndex: (stepIndex) => set({ stepIndex }),
  setRunning: (running) => set({ running }),
}));

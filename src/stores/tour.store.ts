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
  // (A Joyride-era `running`/`setRunning` pause flag lived here; nothing read it once the tour went
  // hand-rolled — the driver waits for each step's target itself.)
  startTour: (id: string) => void;
  stopTour: () => void;
  setStepIndex: (i: number) => void;
}

export const useTourStore = create<TourState>((set) => ({
  activeTourId: null,
  stepIndex: 0,
  startTour: (id) => set({ activeTourId: id, stepIndex: 0 }),
  stopTour: () => set({ activeTourId: null, stepIndex: 0 }),
  setStepIndex: (stepIndex) => set({ stepIndex }),
}));

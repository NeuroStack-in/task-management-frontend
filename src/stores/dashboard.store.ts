import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DashboardWidget } from "@/types";

/**
 * id === type for these built-in widgets (one instance of each).
 *
 * Default first row (left→right): Attendance, Team Comparison, AI Summary —
 * followed by the at-a-glance exec snapshot. The first six are all single-width
 * tiles and are the default dashboard (two clean rows of three, no scroll). The
 * remaining widgets ship hidden — users opt into them via the Customize control.
 * The grid picks its own column count to stay gap-free, so the exact span total
 * isn't load-bearing.
 */
export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "attendance", title: "Attendance", type: "attendance", position: 0, visible: true },
  { id: "team-comparison", title: "Team comparison", type: "team-comparison", position: 1, visible: true },
  { id: "ai-summary", title: "AI summary", type: "ai-summary", position: 2, visible: true },
  { id: "top-employees", title: "Top performers", type: "top-employees", position: 3, visible: true },
  { id: "screenshots", title: "Screenshots captured", type: "screenshots", position: 4, visible: true },
  { id: "alerts-deadlines", title: "Alerts & deadlines", type: "alerts-deadlines", position: 5, visible: true },
  { id: "active-inactive", title: "Active vs inactive", type: "active-inactive", position: 6, visible: false },
  { id: "productivity-trends", title: "Productivity trends", type: "productivity-trends", position: 7, visible: false },
  { id: "upcoming-tasks", title: "Upcoming tasks", type: "upcoming-tasks", position: 8, visible: false },
  { id: "heatmap", title: "Productivity heatmap", type: "heatmap", position: 9, visible: false },
  { id: "headcount", title: "Headcount by status", type: "headcount", position: 10, visible: false },
  { id: "billing", title: "Billing overview", type: "billing", position: 11, visible: false },
];

interface DashboardState {
  widgets: DashboardWidget[];
  toggleWidget: (id: string) => void;
  reorder: (orderedIds: string[]) => void;
  reset: () => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,

      toggleWidget: (id) =>
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === id ? { ...w, visible: !w.visible } : w,
          ),
        })),

      reorder: (orderedIds) =>
        set((s) => ({
          widgets: s.widgets.map((w) => ({
            ...w,
            position: orderedIds.indexOf(w.id),
          })),
        })),

      reset: () => set({ widgets: DEFAULT_WIDGETS }),
    }),
    {
      name: "wp-dashboard",
      // Bumped when the widget set or default order changed shape; older persisted
      // layouts are discarded so everyone picks up the new default order.
      version: 10,
      migrate: () => ({ widgets: DEFAULT_WIDGETS }) as DashboardState,
    },
  ),
);

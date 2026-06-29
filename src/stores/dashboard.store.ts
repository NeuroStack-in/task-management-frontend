import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DashboardWidget } from "@/types";

/**
 * id === type for these built-in widgets (one instance of each).
 *
 * AI-first order (the product is AI-led): the AI Summary leads, followed by the
 * at-a-glance exec snapshot. The first six are single-width tiles, so the
 * collapsed view is two clean rows of three; the rest sit behind "Show more".
 */
export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "ai-summary", title: "AI Summary", type: "ai-summary", position: 0, visible: true },
  { id: "attendance", title: "Attendance", type: "attendance", position: 1, visible: true },
  { id: "team-comparison", title: "Team Comparison", type: "team-comparison", position: 2, visible: true },
  { id: "top-employees", title: "Top Employees", type: "top-employees", position: 3, visible: true },
  { id: "screenshots", title: "Screenshots Captured", type: "screenshots", position: 4, visible: true },
  { id: "productivity-trends", title: "Productivity Trends", type: "productivity-trends", position: 5, visible: true },
  { id: "heatmap", title: "Productivity Heatmap", type: "heatmap", position: 6, visible: true },
  { id: "headcount", title: "Headcount by Status", type: "headcount", position: 7, visible: true },
  { id: "billing", title: "Billing Overview", type: "billing", position: 8, visible: true },
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
      // Bumped when the widget set or default order changed shape; older
      // persisted layouts are discarded so everyone picks up the new AI-first
      // default order.
      version: 10,
      migrate: () => ({ widgets: DEFAULT_WIDGETS }) as DashboardState,
    },
  ),
);

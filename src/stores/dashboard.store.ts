import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DashboardWidget } from "@/types";

/** id === type for these built-in widgets (one instance of each). */
export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "heatmap", title: "Productivity Heatmap", type: "heatmap", position: 0, visible: true },
  { id: "attendance", title: "Attendance", type: "attendance", position: 1, visible: true },
  { id: "team-comparison", title: "Team Comparison", type: "team-comparison", position: 2, visible: true },
  { id: "active-inactive", title: "Active vs Inactive", type: "active-inactive", position: 3, visible: true },
  { id: "top-employees", title: "Top Employees", type: "top-employees", position: 4, visible: true },
  { id: "ai-summary", title: "AI Summary", type: "ai-summary", position: 5, visible: true },
  { id: "alerts", title: "Recent Alerts", type: "alerts", position: 6, visible: true },
  { id: "deadlines", title: "Deadline Warnings", type: "deadlines", position: 7, visible: true },
  { id: "upcoming-tasks", title: "Upcoming Tasks", type: "upcoming-tasks", position: 8, visible: true },
  { id: "screenshots", title: "Screenshots Captured", type: "screenshots", position: 9, visible: false },
  { id: "headcount", title: "Headcount by Status", type: "headcount", position: 10, visible: false },
  { id: "billing", title: "Billing Overview", type: "billing", position: 11, visible: false },
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
      // Bumped when the widget set changed shape; older persisted layouts are
      // discarded so they don't reference removed widget types.
      version: 2,
      migrate: () => ({ widgets: DEFAULT_WIDGETS }) as DashboardState,
    },
  ),
);

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DashboardWidget } from "@/types";

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "w-productivity", title: "Productivity Score", type: "productivity", position: 0, visible: true },
  { id: "w-activity", title: "Activity Trends", type: "activity", position: 1, visible: true },
  { id: "w-tasks", title: "Open Tasks", type: "tasks", position: 2, visible: true },
  { id: "w-projects", title: "Projects", type: "projects", position: 3, visible: true },
  { id: "w-deadlines", title: "Upcoming Deadlines", type: "deadlines", position: 4, visible: true },
  { id: "w-ai", title: "AI Summary", type: "ai-summary", position: 5, visible: true },
  { id: "w-employees", title: "Top Performers", type: "employees", position: 6, visible: false },
  { id: "w-billing", title: "Billing Snapshot", type: "billing", position: 7, visible: false },
];

interface DashboardState {
  widgets: DashboardWidget[];
  setWidgets: (widgets: DashboardWidget[]) => void;
  toggleWidget: (id: string) => void;
  reorder: (orderedIds: string[]) => void;
  reset: () => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,

      setWidgets: (widgets) => set({ widgets }),

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
    { name: "wp-dashboard" },
  ),
);

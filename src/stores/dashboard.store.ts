import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RealWidgetType } from "@/modules/dashboard/widget-registry";

/** One customizable tile. `id === type` — a single instance of each real widget. */
export interface DashboardWidget {
  id: string;
  title: string;
  type: RealWidgetType;
  position: number;
  visible: boolean;
}

/**
 * Default layout for the org dashboard's real widget grid — two rows of three, all live data. Users
 * hide/show and reorder via the Customize control; the layout persists per browser.
 */
export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "ai-summary", title: "AI daily summary", type: "ai-summary", position: 0, visible: true },
  { id: "projects-overview", title: "Projects overview", type: "projects-overview", position: 1, visible: true },
  { id: "attendance-today", title: "Attendance", type: "attendance-today", position: 2, visible: true },
  { id: "active-inactive", title: "Active vs inactive", type: "active-inactive", position: 3, visible: true },
  { id: "department-headcount", title: "Headcount by department", type: "department-headcount", position: 4, visible: true },
  { id: "billing", title: "Billing overview", type: "billing", position: 5, visible: true },
  { id: "headcount-status", title: "Headcount by status", type: "headcount-status", position: 6, visible: true },
  { id: "monitoring-pending", title: "Activity monitoring", type: "monitoring-pending", position: 7, visible: true },
  // Agent-pending placeholders — available in the Customize picker, hidden by default so the board
  // isn't dominated by "waiting on the agent" cards until monitoring is live.
  { id: "productivity-heatmap", title: "Productivity heatmap", type: "productivity-heatmap", position: 8, visible: false },
  { id: "team-comparison", title: "Team comparison", type: "team-comparison", position: 9, visible: false },
  { id: "top-performers", title: "Top performers", type: "top-performers", position: 10, visible: false },
  { id: "recent-alerts", title: "Recent alerts", type: "recent-alerts", position: 11, visible: false },
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
      // Bumped to 12: added the AI-summary + attendance real widgets and four agent-pending
      // placeholders. The default set changed, so any older persisted layout is discarded (migrate
      // returns the fresh defaults) rather than migrated — existing users pick up the new widgets.
      version: 12,
      migrate: () => ({ widgets: DEFAULT_WIDGETS }) as DashboardState,
    },
  ),
);

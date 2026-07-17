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
  { id: "projects-overview", title: "Projects overview", type: "projects-overview", position: 0, visible: true },
  { id: "active-inactive", title: "Active vs inactive", type: "active-inactive", position: 1, visible: true },
  { id: "department-headcount", title: "Headcount by department", type: "department-headcount", position: 2, visible: true },
  { id: "billing", title: "Billing overview", type: "billing", position: 3, visible: true },
  { id: "headcount-status", title: "Headcount by status", type: "headcount-status", position: 4, visible: true },
  { id: "monitoring-pending", title: "Activity monitoring", type: "monitoring-pending", position: 5, visible: true },
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
      // Bumped to 11: the widget set changed shape entirely (real widgets replaced the mock ones), so
      // any layout persisted under the old vocabulary must be discarded rather than migrated.
      version: 11,
      migrate: () => ({ widgets: DEFAULT_WIDGETS }) as DashboardState,
    },
  ),
);

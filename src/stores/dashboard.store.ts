import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The org dashboard's customizable widget grid. One instance of each built-in widget (`id === type`),
 * reorderable + hide/show-able via the Customize control; the layout persists per browser.
 *
 * Every widget is fed **live backend data** (or an honest empty state where a source needs the desktop
 * agent that isn't reporting yet) — see `use-dashboard-data.ts` and `widget-registry.tsx`.
 */
export type WidgetType =
  | "productivity-trends"
  | "heatmap"
  | "team-comparison"
  | "attendance"
  | "active-inactive"
  | "headcount"
  | "screenshots"
  | "top-employees"
  | "ai-summary"
  | "billing"
  | "alerts-deadlines"
  | "upcoming-tasks";

/** One customizable tile. `id === type` — a single instance of each widget. */
export interface DashboardWidget {
  id: string;
  title: string;
  type: WidgetType;
  position: number;
  visible: boolean;
}

/**
 * Default layout (left→right): Attendance, Team comparison, AI summary — then the exec snapshot. The
 * first six are single-width tiles (two clean rows of three); the rest ship hidden and are opt-in via
 * Customize. The grid picks its own column count to stay gap-free, so the exact span total isn't
 * load-bearing.
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
      // Bumped to 13: the widget set moved to the preview grid (live-data widgets + honest empties).
      // Older persisted layouts are discarded (migrate returns fresh defaults) so everyone picks up
      // the new default order.
      version: 13,
      migrate: () => ({ widgets: DEFAULT_WIDGETS }) as DashboardState,
    },
  ),
);

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The org dashboard's customizable widget grid. One instance of each built-in widget (`id === type`),
 * reorderable + hide/show-able via the Customize control. The layout persists per browser (this
 * store) **and** per user on the server (`PUT /v1/me/dashboard-layouts/oversight` — see
 * `modules/dashboard/use-layout-sync.ts`); local state is the optimistic source of truth.
 *
 * Every widget is fed **live backend data** (or an honest empty state where a source needs the desktop
 * agent that isn't reporting yet) — see `use-dashboard-data.ts` and `widget-registry.tsx`.
 *
 * **Widget ids mirror the server catalog** (`backend/crates/wp-contracts/src/widgets.rs`, LLD §3):
 * a widget's type is either a catalog `widget_id` verbatim (`org_attendance`) or
 * `<catalog_id>.<variant>` (`org_activity.heatmap`) when the frontend has several distinct
 * visualizations of one catalog entry. The part before the first `.` is always a valid catalog id —
 * placements store it as `widget_id` and the variant rides in the placement's `config`
 * (see `modules/dashboard/services/dashboard.service.ts`).
 */
export type WidgetType =
  | "org_activity.trends"
  | "org_activity.heatmap"
  | "team_activity"
  | "org_attendance"
  | "org_activity.active_ring"
  | "reports.headcount"
  | "org_activity.screenshots"
  | "org_activity.top_performers"
  | "attention_list.ai_summary"
  | "payroll_summary"
  | "attention_list.alerts"
  | "reports.upcoming_tasks";

/** The catalog `widget_id` a frontend widget type is stored under (the part before the variant). */
export function catalogIdOf(type: WidgetType): string {
  const dot = type.indexOf(".");
  return dot === -1 ? type : type.slice(0, dot);
}

/** The variant discriminator for many-to-one catalog entries, or `undefined` for 1:1 widgets. */
export function variantOf(type: WidgetType): string | undefined {
  const dot = type.indexOf(".");
  return dot === -1 ? undefined : type.slice(dot + 1);
}

/**
 * Pre-catalog frontend ids → today's catalog-aligned types. Used by the persist `migrate`
 * (v13 → v14) and by the server-layout decoder's legacy `config.wp_widget` fallback.
 */
export const LEGACY_WIDGET_TYPE: Record<string, WidgetType> = {
  attendance: "org_attendance",
  "team-comparison": "team_activity",
  "active-inactive": "org_activity.active_ring",
  "productivity-trends": "org_activity.trends",
  heatmap: "org_activity.heatmap",
  screenshots: "org_activity.screenshots",
  "top-employees": "org_activity.top_performers",
  "ai-summary": "attention_list.ai_summary",
  "alerts-deadlines": "attention_list.alerts",
  "upcoming-tasks": "reports.upcoming_tasks",
  headcount: "reports.headcount",
  billing: "payroll_summary",
};

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
  { id: "org_attendance", title: "Attendance", type: "org_attendance", position: 0, visible: true },
  { id: "team_activity", title: "Team comparison", type: "team_activity", position: 1, visible: true },
  { id: "attention_list.ai_summary", title: "AI summary", type: "attention_list.ai_summary", position: 2, visible: true },
  { id: "org_activity.top_performers", title: "Top performers", type: "org_activity.top_performers", position: 3, visible: true },
  { id: "org_activity.screenshots", title: "Screenshots", type: "org_activity.screenshots", position: 4, visible: true },
  { id: "attention_list.alerts", title: "Needs attention", type: "attention_list.alerts", position: 5, visible: true },
  { id: "org_activity.active_ring", title: "Active vs inactive", type: "org_activity.active_ring", position: 6, visible: false },
  { id: "org_activity.trends", title: "Productivity trends", type: "org_activity.trends", position: 7, visible: false },
  { id: "reports.upcoming_tasks", title: "Upcoming tasks", type: "reports.upcoming_tasks", position: 8, visible: false },
  { id: "org_activity.heatmap", title: "Activity heatmap", type: "org_activity.heatmap", position: 9, visible: false },
  { id: "reports.headcount", title: "Headcount by status", type: "reports.headcount", position: 10, visible: false },
  { id: "payroll_summary", title: "Billing overview", type: "payroll_summary", position: 11, visible: false },
];

const KNOWN_TYPES = new Set<string>(DEFAULT_WIDGETS.map((w) => w.type));

interface DashboardState {
  widgets: DashboardWidget[];
  toggleWidget: (id: string) => void;
  reorder: (orderedIds: string[]) => void;
  reset: () => void;
  /**
   * Replace the layout wholesale with the server-stored one (`use-layout-sync.ts`). The local
   * (persisted) state stays the optimistic source of truth between hydrations.
   */
  hydrate: (widgets: DashboardWidget[]) => void;
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

      hydrate: (widgets) => set({ widgets }),
    }),
    {
      name: "wp-dashboard",
      // v13: the widget set moved to the preview grid. v14: frontend widget ids converged on the
      // wp-contracts catalog ids (`attendance` → `org_attendance`, `heatmap` → `org_activity.heatmap`,
      // …) — v13 layouts are renamed in place so the user's order/visibility survives.
      version: 14,
      migrate: (persisted, version) => {
        if (version < 13) return { widgets: DEFAULT_WIDGETS } as DashboardState;

        const old = (persisted as { widgets?: unknown } | null | undefined)?.widgets;
        if (!Array.isArray(old)) return { widgets: DEFAULT_WIDGETS } as DashboardState;

        const seen = new Set<string>();
        const widgets: DashboardWidget[] = [];
        const byPosition = [...old].sort(
          (a, b) => (Number(a?.position) || 0) - (Number(b?.position) || 0),
        );
        for (const w of byPosition) {
          const oldType = typeof w?.type === "string" ? w.type : null;
          if (!oldType) continue;
          const type =
            LEGACY_WIDGET_TYPE[oldType] ??
            (KNOWN_TYPES.has(oldType) ? (oldType as WidgetType) : null);
          if (!type || seen.has(type)) continue;
          const def = DEFAULT_WIDGETS.find((d) => d.type === type);
          if (!def) continue;
          seen.add(type);
          widgets.push({
            ...def,
            position: widgets.length,
            visible: w?.visible !== false,
          });
        }
        if (widgets.length === 0) return { widgets: DEFAULT_WIDGETS } as DashboardState;

        // Widgets added to the app since the layout was saved: append hidden.
        for (const def of DEFAULT_WIDGETS) {
          if (seen.has(def.type)) continue;
          widgets.push({ ...def, position: widgets.length, visible: false });
        }
        return { widgets } as DashboardState;
      },
    },
  ),
);

"use client";

import { Loader2 } from "lucide-react";
import { DepartmentFilter } from "@/components/shared/department-filter";
import { RefreshButton } from "@/components/shared/refresh-button";
import { PageActions } from "@/components/shared/page-actions";
import {
  RANGE_OPTIONS,
  type DashboardRange,
  type TeamOption,
} from "@/modules/dashboard/lib/dashboard-data";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { todayIso } from "@/lib/format";

export function DashboardControls({
  range,
  onRangeChange,
  team,
  onTeamChange,
  teams,
  lastUpdated,
  loading = false,
  onRefresh,
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  range: DashboardRange;
  onRangeChange: (r: DashboardRange) => void;
  /** `"all"` or a `department_id` — the id, never the label (see `DashboardFilters.team`). */
  team: string;
  onTeamChange: (t: string) => void;
  teams: TeamOption[];
  lastUpdated: string;
  /** A refetch is in flight (e.g. the range just changed) — shown as "Updating…" so it isn't silent. */
  loading?: boolean;
  /** Manual refetch. The board stays on screen (the full loader only shows before first data), so
   *  this refreshes the numbers in place rather than reloading the page. */
  onRefresh?: () => void;
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}) {
  // The dashboard summarises recorded activity, so a range can never extend into the future. Read
  // per render (not at module scope) so a tab left open overnight bounds to the real today.
  const today = todayIso();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Range segmented control + custom-range pickers */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="inline-flex items-center gap-0.5 self-start rounded-full border bg-card p-0.5 shadow-soft">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => onRangeChange(r.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                range === r.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {range === "range" ? (
          <div className="flex items-center gap-2 self-start">
            <DatePicker
              value={start}
              onChange={onStartChange}
              max={end || today}
              placeholder="Start date"
            />
            <span className="text-sm text-muted-foreground">–</span>
            <DatePicker
              value={end}
              onChange={onEndChange}
              min={start || undefined}
              max={today}
              placeholder="End date"
            />
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
          {loading ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Updating…
            </>
          ) : (
            `Updated ${lastUpdated || "just now"}`
          )}
        </span>
        {/* Refresh lives in the top-navbar action slot — the app-wide fixed spot — not in this
            in-page controls row. The "Updated …" status and the department filter stay here. */}
        {onRefresh ? (
          <PageActions>
            <RefreshButton onRefresh={onRefresh} refreshing={loading} />
          </PageActions>
        ) : null}
        {/* Departments, not teams. `team_id` is not in the Directory GSI projection, so the server
            cannot filter by team at all (workforce::directory_list::data) — this axis has always
            been the department. Saying "team" made a working filter look broken to anyone who
            expected their team in the list. */}
        <DepartmentFilter
          value={team}
          onChange={onTeamChange}
          options={teams.map((t) => ({ value: t.id, label: t.label }))}
          ariaLabel="Filter by department"
          className="w-52"
        />
      </div>
    </div>
  );
}

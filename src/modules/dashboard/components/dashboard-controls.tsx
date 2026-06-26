"use client";

import { Users2 } from "lucide-react";
import {
  RANGE_OPTIONS,
  type DashboardRange,
} from "@/modules/dashboard/lib/dashboard-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function DashboardControls({
  range,
  onRangeChange,
  team,
  onTeamChange,
  teams,
  lastUpdated,
}: {
  range: DashboardRange;
  onRangeChange: (r: DashboardRange) => void;
  team: string;
  onTeamChange: (t: string) => void;
  teams: string[];
  lastUpdated: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Range segmented control */}
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

      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Updated {lastUpdated || "just now"}
        </span>
        <Select value={team} onValueChange={(v) => onTeamChange(v as string)}>
          <SelectTrigger aria-label="Filter by team" className="h-9 w-52 gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Users2 className="size-4 shrink-0 text-muted-foreground" />
              <SelectValue className="truncate whitespace-nowrap">
                {(value) =>
                  value === "all" || value == null ? "All teams" : String(value)
                }
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent className="min-w-44">
            <SelectItem value="all">All teams</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

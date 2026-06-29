"use client";

import {
  Activity,
  AlertTriangle,
  FolderKanban,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStats } from "../lib";

interface Segment {
  key: string;
  label: string;
  value: string | number;
  sub: string;
  icon: LucideIcon;
  chip: string;
  alert?: boolean;
}

/**
 * A single connected KPI band (not four floating cards) — reads as an admin
 * control strip. 1px gaps over a border-coloured parent form the dividers.
 */
export function ProjectsStatBand({ stats }: { stats: ProjectStats }) {
  const segments: Segment[] = [
    {
      key: "total",
      label: "Total projects",
      value: stats.total,
      sub: "across the organization",
      icon: FolderKanban,
      chip: "bg-muted text-primary",
    },
    {
      key: "active",
      label: "Active",
      value: stats.active,
      sub: "currently underway",
      icon: Activity,
      chip: "bg-muted text-primary",
    },
    {
      key: "avg",
      label: "Avg progress",
      value: `${stats.avgProgress}%`,
      sub: "live projects",
      icon: Gauge,
      chip: "bg-muted text-primary",
    },
    {
      key: "atRisk",
      label: "At risk",
      value: stats.atRisk,
      sub: "overdue & unfinished",
      icon: AlertTriangle,
      chip:
        stats.atRisk > 0
          ? "bg-warning/15 text-warning"
          : "bg-muted text-muted-foreground",
      alert: stats.atRisk > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
      {segments.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex flex-col gap-4 bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-md",
                  s.chip,
                )}
              >
                <Icon className="size-4" />
              </span>
            </div>
            <div className="space-y-1">
              <p
                className={cn(
                  "font-display text-3xl leading-none font-semibold tracking-tight tabular-nums",
                  s.alert && "text-warning",
                )}
              >
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground">{s.sub}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

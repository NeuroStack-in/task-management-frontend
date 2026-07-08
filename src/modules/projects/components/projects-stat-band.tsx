"use client";

import {
  Activity,
  AlertTriangle,
  FolderKanban,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { Sparkline } from "@/components/shared/sparkline";
import { cn } from "@/lib/utils";
import type { ProjectStats } from "../lib";

interface Segment {
  key: string;
  label: string;
  value: string | number;
  sub: string;
  icon: LucideIcon;
  chip: string;
  primary?: boolean;
  spark?: number[];
  /** Optional accent colour for the value (e.g. amber for at-risk). */
  accent?: string;
}

/**
 * A single connected KPI band (not four floating cards) — reads as an admin
 * control strip. The primary cell carries the indigo feature tint + the
 * aggregate project pulse; 1px gaps over a border-coloured parent form the dividers.
 */
export function ProjectsStatBand({ stats }: { stats: ProjectStats }) {
  const segments: Segment[] = [
    {
      key: "total",
      label: "Total projects",
      value: stats.total,
      sub: "across the organization",
      icon: FolderKanban,
      chip: "bg-primary/10 text-primary",
      primary: true,
      spark: stats.pulse,
    },
    {
      key: "active",
      label: "Active",
      value: stats.active,
      sub: "currently underway",
      icon: Activity,
      chip: "bg-feature-tint text-primary",
    },
    {
      key: "avg",
      label: "Avg progress",
      value: `${stats.avgProgress}%`,
      sub: "live projects",
      icon: Gauge,
      chip: "bg-feature-tint text-primary",
    },
    {
      key: "atRisk",
      label: "Overdue",
      value: stats.atRisk,
      sub: "past due & unfinished",
      icon: AlertTriangle,
      chip: "bg-warning/15 text-warning",
      accent: "text-warning",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {segments.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.key}
            className={cn(
              "flex flex-col gap-4 bg-card p-5",
              s.primary && "bg-feature-tint/60",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full",
                  s.chip,
                )}
              >
                <Icon className="size-4" />
              </span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="space-y-1">
                <p
                  className={cn(
                    "font-display text-3xl leading-none font-semibold tracking-tight tabular-nums",
                    s.accent,
                  )}
                >
                  {s.value}
                </p>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              </div>
              {s.spark ? (
                <Sparkline
                  data={s.spark}
                  width={84}
                  height={36}
                  area
                  showDot={false}
                  className="text-primary"
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

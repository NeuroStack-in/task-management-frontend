"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BatteryWarning,
  Check,
  Clock,
  Moon,
  ShieldAlert,
  TrendingDown,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { initials } from "@/lib/format";
import {
  ANOMALIES,
  SEVERITY_META,
  type Anomaly,
  type AnomalyKind,
  type AnomalySeverity,
} from "@/lib/mock-insights";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<AnomalyKind, LucideIcon> = {
  inactivity: Clock,
  "productivity-drop": TrendingDown,
  burnout: BatteryWarning,
  "after-hours": Moon,
  policy: ShieldAlert,
};

const FILTERS: { value: AnomalySeverity | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function AnomaliesView() {
  const [items, setItems] = useState<Anomaly[]>(ANOMALIES);
  const [filter, setFilter] = useState<AnomalySeverity | "all">("all");

  const counts = {
    high: items.filter((a) => a.severity === "high").length,
    medium: items.filter((a) => a.severity === "medium").length,
    low: items.filter((a) => a.severity === "low").length,
  };

  const visible =
    filter === "all" ? items : items.filter((a) => a.severity === filter);

  const resolve = (a: Anomaly, dismissed = false) => {
    setItems((prev) => prev.filter((x) => x.id !== a.id));
    toast.success(dismissed ? "Anomaly dismissed" : "Anomaly resolved", {
      description: `${a.title} · ${a.user.name}`,
    });
  };

  return (
    <div className="space-y-5">
      {/* Severity summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile severity="high" count={counts.high} />
        <SummaryTile severity="medium" count={counts.medium} />
        <SummaryTile severity="low" count={counts.low} />
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground shadow-soft hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Check}
          title="All clear"
          description="No anomalies match this filter. New signals appear here as they're detected."
        />
      ) : (
        <div className="space-y-3">
          {visible.map((a) => {
            const Icon = KIND_ICON[a.kind];
            const meta = SEVERITY_META[a.severity];
            return (
              <Card key={a.id} className="p-0">
                <CardContent className="flex items-start gap-4 px-5 py-4">
                  <span
                    className={cn(
                      "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full",
                      meta.badge,
                    )}
                  >
                    <Icon className="size-5" />
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.title}</span>
                      <Badge className={cn("border-0", meta.badge)}>
                        {meta.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {a.time}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.detail}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <Avatar className="size-5">
                        <AvatarImage src={a.user.avatarUrl} alt={a.user.name} />
                        <AvatarFallback className="text-[9px]">
                          {initials(a.user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {a.user.name} · {a.user.department}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resolve(a)}
                    >
                      <Check className="size-4" /> Resolve
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      aria-label="Dismiss"
                      onClick={() => resolve(a, true)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  severity,
  count,
}: {
  severity: AnomalySeverity;
  count: number;
}) {
  const meta = SEVERITY_META[severity];
  return (
    <Card>
      <CardContent className="flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <span className={cn("size-2.5 rounded-full", meta.dot)} />
          <span className="text-sm text-muted-foreground">
            {meta.label} severity
          </span>
        </div>
        <span className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-muted-foreground" />
          <span className="font-display text-2xl font-semibold tabular-nums">
            {count}
          </span>
        </span>
      </CardContent>
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ANOMALIES,
  SEVERITY_META,
  type Anomaly,
  type AnomalySeverity,
} from "@/lib/mock-insights";
import { cn } from "@/lib/utils";
import {
  AttentionDialog,
  ATTENTION_KINDS,
  KIND_ICON,
  type Status,
} from "./ai-insights-tab";

type SeverityFilter = AnomalySeverity | "all";
const SEVERITY_FILTERS: SeverityFilter[] = ["all", "high", "medium", "low"];

/**
 * The people-attention list — employees showing burnout, productivity-drop, or
 * after-hours signals that a manager should act on. Self-contained (owns its
 * resolve/dismiss state) and reuses the AI Insights detail dialog so the two
 * surfaces stay in sync. Title is configurable so each surface can name it to
 * suit its context.
 */
export function PeopleAttentionCard({
  title = "People to check in on",
}: {
  title?: string;
}) {
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [active, setActive] = useState<Anomaly | null>(null);

  const attention = useMemo(
    () => ANOMALIES.filter((a) => ATTENTION_KINDS.includes(a.kind)),
    [],
  );

  const open = useMemo(
    () => attention.filter((a) => (status[a.id] ?? "open") === "open"),
    [attention, status],
  );

  const high = open.filter((a) => a.severity === "high").length;
  const burnout = open.filter((a) => a.kind === "burnout").length;
  const drops = open.filter((a) => a.kind === "productivity-drop").length;
  const clearedCount = attention.length - open.length;

  const visible = open.filter(
    (a) => severity === "all" || a.severity === severity,
  );

  const decide = (a: Anomaly, next: Status) => {
    setStatus((s) => ({ ...s, [a.id]: next }));
    setActive(null);
    toast.success(next === "resolved" ? "Marked resolved" : "Dismissed", {
      description: `${a.title} · ${a.user.name}`,
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <CardTitle>
              {title} ({open.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {high} high priority · {burnout} burnout · {drops} productivity
              drops
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {clearedCount > 0 ? (
              <span className="text-xs text-muted-foreground">
                {clearedCount} cleared
              </span>
            ) : null}
            {SEVERITY_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  severity === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "all" ? "All" : SEVERITY_META[s as AnomalySeverity].label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <EmptyState
              icon={Check}
              title={open.length === 0 ? "All clear" : "Nothing at this level"}
              description={
                open.length === 0
                  ? "Everything's been reviewed. New items will appear here."
                  : "No open items match this filter."
              }
              className="m-4 border-0"
            />
          ) : (
            <div className="divide-y">
              {visible.map((a) => {
                const sev = SEVERITY_META[a.severity];
                const Icon = KIND_ICON[a.kind];
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setActive(a)}
                    className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent/50"
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${sev.dot}`}
                    />
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-feature-tint text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{a.title}</span>
                        <Badge className={sev.badge}>{sev.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          · {a.user.name}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {a.detail}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {a.time}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AttentionDialog
        anomaly={active}
        onClose={() => setActive(null)}
        onDecide={decide}
      />
    </>
  );
}

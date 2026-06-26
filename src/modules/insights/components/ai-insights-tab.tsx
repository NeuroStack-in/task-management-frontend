"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  BatteryWarning,
  Bell,
  Check,
  Clock,
  Lightbulb,
  Moon,
  ShieldAlert,
  TrendingDown,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { initials } from "@/lib/format";
import {
  ANOMALIES,
  ANOMALY_KIND_LABEL,
  ANOMALY_KIND_SIGNAL,
  ANOMALY_TREND,
  SEVERITY_META,
  type Anomaly,
  type AnomalyKind,
  type AnomalySeverity,
} from "@/lib/mock-insights";
import { AiReportCard, type AiSignal } from "./ai-report-card";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<AnomalyKind, LucideIcon> = {
  inactivity: Clock,
  "productivity-drop": TrendingDown,
  burnout: BatteryWarning,
  "after-hours": Moon,
  policy: ShieldAlert,
};

/**
 * People-health signals an org head actually acts on. Operational/IT signals
 * (idle time, offline agents, distracting-site spikes) are intentionally left
 * out of this view — they belong to a manager/admin scope, not the exec one.
 */
const ATTENTION_KINDS: AnomalyKind[] = [
  "burnout",
  "productivity-drop",
  "after-hours",
];

type Status = "open" | "resolved" | "dismissed";
type SeverityFilter = AnomalySeverity | "all";

const SEVERITY_FILTERS: SeverityFilter[] = ["all", "high", "medium", "low"];

/** Derive recommendations from the items that are actually open. */
function buildRecommendations(open: Anomaly[]) {
  const recs: { id: string; title: string; detail: string }[] = [];
  const burnout = open.filter((a) => a.kind === "burnout");
  const drops = open.filter((a) => a.kind === "productivity-drop");
  const afterHours = open.filter((a) => a.kind === "after-hours");

  if (burnout.length)
    recs.push({
      id: "rec-burnout",
      title: "Rebalance workload",
      detail: `${burnout[0].user.name} shows burnout signals — consider redistributing in-flight tasks.`,
    });
  if (drops.length)
    recs.push({
      id: "rec-drop",
      title: "Check in on a drop",
      detail: `${drops[0].user.name}'s activity fell sharply — a quick check-in can surface blockers.`,
    });
  if (afterHours.length)
    recs.push({
      id: "rec-hours",
      title: "Review after-hours work",
      detail: `${afterHours[0].user.name} logged late hours — confirm it's intended, not overload.`,
    });
  recs.push({
    id: "rec-recognize",
    title: "Recognize top performers",
    detail: "Five people sustained 90%+ productivity this week — recognition keeps momentum.",
  });
  return recs.slice(0, 4);
}

export function AiInsightsTab() {
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

  const recommendations = useMemo(() => buildRecommendations(open), [open]);

  const signals: AiSignal[] = [
    { label: "Productivity", value: "+3% WoW", tone: "up" },
    {
      label: "Burnout risks",
      value: String(burnout),
      tone: burnout > 0 ? "down" : "up",
    },
    {
      label: "Needs attention",
      value: String(open.length),
      tone: open.length > 0 ? "down" : "up",
    },
  ];

  const summary =
    open.length === 0
      ? "Productivity rose 3% week-over-week. Nothing needs your attention right now — the team looks healthy."
      : `Productivity rose 3% week-over-week, led by Engineering and Product. ${open.length} ${open.length === 1 ? "person needs" : "people need"} a closer look${high ? `, ${high} high-priority` : ""} — see below.`;

  const decide = (a: Anomaly, next: Status) => {
    setStatus((s) => ({ ...s, [a.id]: next }));
    setActive(null);
    toast.success(next === "resolved" ? "Marked resolved" : "Dismissed", {
      description: `${a.title} · ${a.user.name}`,
    });
  };

  return (
    <div className="space-y-4">
      <AiReportCard title="Weekly summary" summary={summary} signals={signals} />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" /> Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {recommendations.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <AttentionTrend />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Needs attention" value={open.length} icon={Bell} hint="this week" featured />
        <StatCard label="High priority" value={high} icon={ShieldAlert} hint="act first" />
        <StatCard label="Burnout signals" value={burnout} icon={Activity} hint="people flagged" />
        <StatCard label="Productivity drops" value={drops} icon={TrendingDown} hint="sharp declines" />
      </div>

      {/* Needs-attention list */}
      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>Needs attention</CardTitle>
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
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${sev.dot}`} />
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
    </div>
  );
}

function AttentionTrend() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Attention this week</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[176px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ANOMALY_TREND} margin={{ left: -24, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
              />
              <Bar dataKey="high" stackId="a" name="High" fill="var(--destructive)" />
              <Bar dataKey="medium" stackId="a" name="Medium" fill="var(--warning)" />
              <Bar
                dataKey="low"
                stackId="a"
                name="Low"
                fill="var(--muted-foreground)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function AttentionDialog({
  anomaly: a,
  onClose,
  onDecide,
}: {
  anomaly: Anomaly | null;
  onClose: () => void;
  onDecide: (a: Anomaly, next: Status) => void;
}) {
  return (
    <Dialog open={!!a} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {a ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {a.title}
                <Badge className={SEVERITY_META[a.severity].badge}>
                  {SEVERITY_META[a.severity].label}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {ANOMALY_KIND_LABEL[a.kind]} · detected {a.time}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
              <Avatar className="size-10">
                <AvatarImage src={a.user.avatarUrl} alt={a.user.name} />
                <AvatarFallback>{initials(a.user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.user.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {a.user.jobTitle} · {a.user.department}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/employees/${a.user.id}`} />}
                nativeButton={false}
              >
                View profile
              </Button>
            </div>

            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  What triggered it
                </dt>
                <dd className="mt-0.5">{ANOMALY_KIND_SIGNAL[a.kind]}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Detail
                </dt>
                <dd className="mt-0.5 text-muted-foreground">{a.detail}</dd>
              </div>
            </dl>

            <DialogFooter>
              <Button variant="outline" onClick={() => onDecide(a, "dismissed")}>
                <X className="size-4" /> Dismiss
              </Button>
              <Button onClick={() => onDecide(a, "resolved")}>
                <Check className="size-4" /> Resolve
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

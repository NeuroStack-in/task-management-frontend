"use client";

import {
  AlertTriangle,
  ShieldAlert,
  Activity,
  CameraOff,
  Lightbulb,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { initials } from "@/lib/format";
import { ANOMALIES, SEVERITY_META } from "@/lib/mock-insights";
import { AiReportCard, type AiSignal } from "./ai-report-card";

const WEEKLY_SIGNALS: AiSignal[] = [
  { label: "Productivity", value: "+3% WoW", tone: "up" },
  { label: "Burnout risks", value: "2 flagged", tone: "down" },
  { label: "Utilization", value: "78%", tone: "flat" },
];

const RECOMMENDATIONS = [
  { id: "r1", title: "Rebalance Backend workload", detail: "Backend is down 8% and shows burnout signals. Consider redistributing two in-flight tasks." },
  { id: "r2", title: "Recognize top performers", detail: "Five people sustained 90%+ productivity this week — recognition helps keep momentum." },
  { id: "r3", title: "Close screenshot gaps", detail: "Three desktop agents went offline today. Check them to restore monitoring coverage." },
  { id: "r4", title: "Review weekend activity", detail: "A few people logged weekend hours — confirm it's intended, not overload." },
];

export function AiInsightsTab() {
  const high = ANOMALIES.filter((a) => a.severity === "high").length;
  const burnout = ANOMALIES.filter((a) => a.kind === "burnout").length;
  const missing = ANOMALIES.filter(
    (a) => a.kind === "inactivity" && a.detail.includes("Agent"),
  ).length;

  return (
    <div className="space-y-4">
      {/* AI weekly summary */}
      <AiReportCard
        title="Weekly summary"
        summary="Productivity rose 3% week-over-week, led by Engineering and Product. Weekend activity was minimal. Two teams show early burnout signals — see the detected anomalies below."
        signals={WEEKLY_SIGNALS}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            Today is tracking slightly above average. Engineering and Product are
            driving output and weekend carry-over is minimal. No critical
            anomalies have been detected so far today.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" /> Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {RECOMMENDATIONS.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Detected anomalies */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open anomalies" value={ANOMALIES.length} icon={AlertTriangle} hint="last 24 hours" featured />
        <StatCard label="High severity" value={high} icon={ShieldAlert} hint="need attention" />
        <StatCard label="Burnout signals" value={burnout} icon={Activity} hint="people flagged" />
        <StatCard label="Missing data" value={missing} icon={CameraOff} hint="agents offline" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detected anomalies</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {ANOMALIES.map((a) => {
            const sev = SEVERITY_META[a.severity];
            return (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${sev.dot}`} />
                <Avatar className="size-9">
                  <AvatarImage src={a.user.avatarUrl} alt={a.user.name} />
                  <AvatarFallback className="text-xs">
                    {initials(a.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{a.title}</span>
                    <Badge className={sev.badge}>{sev.label}</Badge>
                    <span className="text-xs text-muted-foreground">· {a.user.name}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{a.detail}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-xs text-muted-foreground">{a.time}</span>
                  <Button size="sm" variant="ghost" className="h-7 text-xs">
                    Review
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

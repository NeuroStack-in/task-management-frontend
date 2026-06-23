"use client";

import { AlertTriangle, ShieldAlert, Activity, CameraOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { initials } from "@/lib/format";
import { ANOMALIES, SEVERITY_META } from "@/lib/mock-insights";

export function AnomaliesTab() {
  const high = ANOMALIES.filter((a) => a.severity === "high").length;
  const burnout = ANOMALIES.filter((a) => a.kind === "burnout").length;
  const missing = ANOMALIES.filter((a) => a.kind === "inactivity" && a.detail.includes("Agent")).length;

  return (
    <div className="space-y-4">
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

"use client";

import { Sparkles, Lightbulb, ArrowUpRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const INSIGHTS = [
  { label: "Productivity", value: "+3% WoW", tone: "up" as const },
  { label: "Burnout risks", value: "2 flagged", tone: "down" as const },
  { label: "Utilization", value: "78%", tone: "flat" as const },
];

const RECOMMENDATIONS = [
  { id: "r1", title: "Rebalance Backend workload", detail: "Backend is down 8% and shows burnout signals. Consider redistributing two in-flight tasks." },
  { id: "r2", title: "Recognize top performers", detail: "Five people sustained 90%+ productivity this week — recognition helps keep momentum." },
  { id: "r3", title: "Close screenshot gaps", detail: "Three desktop agents went offline today. Check them to restore monitoring coverage." },
  { id: "r4", title: "Review weekend activity", detail: "A few people logged weekend hours — confirm it's intended, not overload." },
];

const ToneIcon = { up: TrendingUp, down: TrendingDown, flat: Minus };

export function AiTab() {
  return (
    <div className="space-y-4">
      {/* Weekly summary — featured */}
      <Card className="bg-feature text-feature-foreground shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> Weekly summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-feature-foreground/90">
            Productivity rose 3% week-over-week, led by Engineering and Product.
            Weekend activity was minimal. Two teams show early burnout signals worth
            a closer look in the Anomalies tab.
          </p>
          <div className="flex flex-wrap gap-2">
            {INSIGHTS.map((i) => {
              const Icon = ToneIcon[i.tone];
              return (
                <span
                  key={i.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white"
                >
                  <Icon className="size-3.5" />
                  {i.label}: {i.value}
                </span>
              );
            })}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.info("Open the assistant from the button at the bottom-right.")}
          >
            Ask the assistant <ArrowUpRight className="size-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-muted-foreground">
            Today is tracking slightly above average. Engineering and Product are
            driving output and weekend carry-over is minimal. No critical anomalies
            have been detected so far today.
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
    </div>
  );
}

"use client";

import {
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type AiTone = "up" | "down" | "flat";
export interface AiSignal {
  label: string;
  value: string;
  tone: AiTone;
}

const ToneIcon: Record<AiTone, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

/**
 * The shared AI report — a featured indigo card with an AI-written summary,
 * a few key signals, and a hand-off to the assistant. Reused on every Insights
 * page so each surface carries its own AI read.
 */
export function AiReportCard({
  title = "AI report",
  summary,
  signals = [],
}: {
  title?: string;
  summary: string;
  signals?: AiSignal[];
}) {
  return (
    <Card className="border-0 bg-feature text-feature-foreground shadow-none">
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        <p className="text-sm leading-relaxed text-feature-foreground/90">
          {summary}
        </p>
        {signals.length ? (
          <div className="flex flex-wrap gap-2">
            {signals.map((s) => {
              const Icon = ToneIcon[s.tone];
              return (
                <span
                  key={s.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white"
                >
                  <Icon className="size-3.5" />
                  {s.label}: {s.value}
                </span>
              );
            })}
          </div>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            toast.info("Open the assistant from the button at the bottom-right.")
          }
        >
          Ask the assistant <ArrowUpRight className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

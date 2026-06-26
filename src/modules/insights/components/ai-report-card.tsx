"use client";

import {
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAssistantStore } from "@/stores/assistant.store";
import { cn } from "@/lib/utils";

export type AiTone = "up" | "down" | "flat";
export interface AiSignal {
  label: string;
  value: string;
  tone: AiTone;
}

/** A headline figure rendered inside the AI hero card. */
export interface AiMetric {
  label: string;
  value: string | number;
  /** Percentage delta vs previous period; omit for none. */
  delta?: number;
  /** Small qualifier shown next to the value, e.g. "live". */
  hint?: string;
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
  metrics = [],
}: {
  title?: string;
  summary: string;
  signals?: AiSignal[];
  metrics?: AiMetric[];
}) {
  const openAssistant = useAssistantStore((s) => s.openAssistant);
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

        {metrics.length ? (
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-3">
            {metrics.map((m) => {
              const up = (m.delta ?? 0) >= 0;
              return (
                <div key={m.label}>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-semibold tabular-nums">
                      {m.value}
                    </span>
                    {m.hint ? (
                      <span className="text-xs text-feature-foreground/70">
                        {m.hint}
                      </span>
                    ) : null}
                    {m.delta !== undefined ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 text-xs font-medium",
                          up ? "text-emerald-200" : "text-rose-200",
                        )}
                      >
                        {up ? (
                          <TrendingUp className="size-3" />
                        ) : (
                          <TrendingDown className="size-3" />
                        )}
                        {Math.abs(m.delta)}%
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-feature-foreground/75">
                    {m.label}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}

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
          onClick={() => openAssistant()}
        >
          Ask the assistant <ArrowUpRight className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

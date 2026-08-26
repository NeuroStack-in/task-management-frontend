"use client";

import {
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAssistantStore } from "@/stores/assistant.store";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/shared/markdown";

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
  title = "AI summary",
  summary,
  signals = [],
  metrics = [],
  action,
  onRegenerate,
  regenerating = false,
}: {
  title?: string;
  summary: string;
  signals?: AiSignal[];
  metrics?: AiMetric[];
  /**
   * A control rendered beside the title — the scope this summary is written about.
   *
   * It belongs in the card rather than above it: a filter that sits outside looks like it filters
   * the whole page, and the Activity tab already has a date/granularity bar that does exactly that.
   * Inside, it plainly reads as "which slice this narrative describes".
   */
  action?: React.ReactNode;
  /** Re-run the model for this period (the narrative is otherwise generate-once-cached).
   *  Omit to hide the button — e.g. while locked behind the add-on or before data loads. */
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const openAssistant = useAssistantStore((s) => s.openAssistant);
  return (
    <Card className="border-0 bg-feature text-feature-foreground shadow-none">
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" /> {title}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        {/* The model writes Markdown; printed raw it arrived as literal `**` and pipes. */}
        <Markdown className="text-feature-foreground/90">{summary}</Markdown>

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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openAssistant()}
          >
            Ask the assistant <ArrowUpRight className="size-4" />
          </Button>
          {onRegenerate ? (
            // Each press is a fresh, billed model run over the period's current data — the
            // narrative is otherwise served from cache, so this is the deliberate re-spend.
            <Button
              variant="secondary"
              size="sm"
              onClick={onRegenerate}
              disabled={regenerating}
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <RefreshCw className={cn("size-4", regenerating && "animate-spin")} />
              {regenerating ? "Regenerating…" : "Regenerate"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

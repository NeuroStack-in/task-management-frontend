"use client";

import {
  Sparkles,
  ArrowUpRight,
  FileText,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAssistantStore } from "@/stores/assistant.store";
import { useAssistantAccess } from "@/hooks/use-assistant-access";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/shared/markdown";
import { provenanceLine, type Provenance } from "../lib/ai-provenance";

export type AiTone = "up" | "down" | "flat";
export interface AiSignal {
  label: string;
  value: string;
  tone: AiTone;
}

/** A headline figure rendered inside the AI hero card. */
export interface AiMetric {
  label: string;
  /** A node too, so a named person can be a link (UX audit MON-04). */
  value: React.ReactNode;
  /** Percentage delta vs previous period; omit for none. */
  delta?: number;
  /** Small qualifier shown next to the value, e.g. "live". */
  hint?: string;
  /**
   * Make the figure a filter (UX audit 2026-10-16, MON-11): a button that toggles what the page
   * shows — "Needs review 3" narrows the gallery to those three. `aria-pressed` says whether it is on;
   * `label` is the button's full accessible name ("Show only captures needing review").
   */
  toggle?: { pressed: boolean; onToggle: () => void; label: string };
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
 *
 * **Pass `provenance`** and the card says who wrote the text (UX audit 2026-10-16, MON-08): the
 * sparkle only on text a model wrote, with "AI-generated · time · may be wrong"; a template
 * fallback gets a plain icon and "not written by AI". Without it the card renders as it always did
 * — callers outside Analytics still rely on that.
 */
export function AiReportCard({
  title = "AI summary",
  summary,
  signals = [],
  metrics = [],
  action,
  onRegenerate,
  regenerating = false,
  onRetry,
  notice,
  provenance,
  footnote,
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
   *  Omit to hide the button — pass it only when `canRegenerate` (`lib/ai-provenance`) holds: there
   *  is data to analyse and a narrative to replace (UX audit MON-21). Never over an empty period. */
  onRegenerate?: () => void;
  regenerating?: boolean;
  /** Shown as "Try again" when the summary failed to **load** — a plain re-read, not a re-run. */
  onRetry?: () => void;
  /** A one-line status under the summary, e.g. a failed re-run that kept the previous text. */
  notice?: string | null;
  /** Who wrote `summary` — see `lib/ai-provenance`. Omit to keep the card's original look. */
  provenance?: Provenance;
  /** A small note under the figures — e.g. the thresholds behind them (UX audit MON-18). */
  footnote?: React.ReactNode;
}) {
  const openAssistant = useAssistantStore((s) => s.openAssistant);
  // The floating assistant's own gate — a button it can't answer is a button that does nothing.
  const canAsk = useAssistantAccess().chat;
  return (
    <Card className="border-0 bg-feature text-feature-foreground shadow-none">
      <CardHeader className="pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {provenance && provenance.kind !== "ai" ? (
              <FileText className="size-4" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}{" "}
            {title}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-3">
        {/* The model writes Markdown; printed raw it arrived as literal `**` and pipes. */}
        {/* The shared Markdown inks bold text and headings `text-foreground`, which is dark on this
            card — "**65/100**" rendered as near-invisible text. Re-ink them for the feature surface. */}
        <Markdown
          className="text-feature-foreground/90 [&_.text-foreground]:text-feature-foreground"
          links="same-origin"
        >
          {summary}
        </Markdown>
        {provenance && provenanceLine(provenance) ? (
          <p className="text-xs text-feature-foreground/85">{provenanceLine(provenance)}</p>
        ) : null}
        {notice ? (
          <p className="text-xs text-feature-foreground/85" role="status">
            {notice}
          </p>
        ) : null}

        {metrics.length ? (
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-3">
            {metrics.map((m) => {
              const up = (m.delta ?? 0) >= 0;
              const body = (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-semibold tabular-nums">
                      {m.value}
                    </span>
                    {m.hint ? (
                      <span className="text-xs text-feature-foreground/85">
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
                  <p className="mt-0.5 text-xs text-feature-foreground/85">
                    {m.label}
                    {m.toggle ? (
                      <span className="ml-1 text-feature-foreground/90">
                        {m.toggle.pressed ? "· showing only these" : "· show only these"}
                      </span>
                    ) : null}
                  </p>
                </>
              );
              return m.toggle ? (
                <button
                  key={m.label}
                  type="button"
                  aria-pressed={m.toggle.pressed}
                  aria-label={m.toggle.label}
                  onClick={m.toggle.onToggle}
                  className={cn(
                    "-mx-2 -my-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none",
                    m.toggle.pressed && "bg-white/15 ring-1 ring-white/40",
                  )}
                >
                  {body}
                </button>
              ) : (
                <div key={m.label}>{body}</div>
              );
            })}
          </div>
        ) : null}
        {footnote ? <p className="text-xs text-feature-foreground/85">{footnote}</p> : null}

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
          {canAsk ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openAssistant()}
            >
              Ask the assistant <ArrowUpRight className="size-4" />
            </Button>
          ) : null}
          {onRetry ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRetry}
              className="bg-white/15 text-white hover:bg-white/25"
            >
              <RefreshCw className="size-4" /> Try again
            </Button>
          ) : null}
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

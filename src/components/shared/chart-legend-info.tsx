"use client";

/**
 * The "what am I looking at" affordance for a chart card — an info button beside the title that
 * reveals the series definitions on hover or focus.
 *
 * **Why not printed under the chart.** Every chart here plots something a reader cannot guess, so
 * the definitions have to exist somewhere. Printed inline they cost more vertical space than the
 * chart itself on a dashboard tile — the productivity card spent roughly a third of its height on
 * two sentences that a returning user already knows. Moving them behind the title keeps the answer
 * one pointer away for the person seeing it the first time, and out of the way for everyone after.
 *
 * **Hover is not the only way in.** `Tooltip` opens on focus as well as hover, and the trigger is a
 * real `<button>` with an accessible name, so this is reachable by keyboard and announced by a
 * screen reader. A hover-only tooltip would put the explanation out of reach of exactly the users
 * most likely to need it — and on touch, where there is no hover at all, a tap opens it.
 *
 * The button is deliberately *beside* the title rather than wrapping it: a title that is itself a
 * hover target gives no visual hint that anything is there, which is how these get missed.
 */

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** One series and what it measures. `term` is the label as it appears in the chart's legend. */
export interface ChartTerm {
  term: string;
  /** Prose. Keep it to a sentence — this is a tooltip, not documentation. */
  definition: React.ReactNode;
}

export function ChartLegendInfo({
  terms,
  label = "What these series mean",
  className,
}: {
  terms: ChartTerm[];
  /** Accessible name for the button — say what it explains, not "info". */
  label?: string;
  className?: string;
}) {
  if (!terms.length) return null;
  return (
    // `delay`, not `delayDuration` — Base UI, not Radix (see frontend/CLAUDE.md).
    <TooltipProvider delay={120}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={label}
              className={cn(
                "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none",
                className,
              )}
            />
          }
        >
          <Info className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <dl className="space-y-1.5 text-left text-[11px] leading-relaxed">
            {terms.map((t) => (
              <div key={t.term}>
                <dt className="font-medium">{t.term}</dt>
                <dd className="opacity-90">{t.definition}</dd>
              </div>
            ))}
          </dl>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

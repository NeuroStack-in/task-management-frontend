"use client";

/**
 * The org dashboard's AI summary card — self-fetching, on the live department-summary endpoint.
 * Kept in its own file (no imports from the registry or the customizable shell) so the registry can
 * import it without a cycle.
 *
 * (This file also held four cards nothing rendered — projects overview, department headcount,
 * billing, attendance today — and the `use-dashboard-summary` hook only they read; all removed,
 * QA audit 2026-10-08, WP-440.)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import {
  getDeptSummary,
  regenerateDeptSummary,
  type DeptSummaryArgs,
} from "@/modules/insights/services/insights.service";
import { type DashboardRange } from "../lib/dashboard-data";
import { Markdown } from "@/components/shared/markdown";
import {
  canRegenerate,
  deptSummaryProvenance,
  formatGeneratedAt,
  provenanceLine,
  type Provenance,
} from "@/modules/insights/lib/ai-provenance";
import { useAssistantStore } from "@/stores/assistant.store";
import { useAssistantAccess } from "@/hooks/use-assistant-access";

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to this data.";
    return e.message;
  }
  return fallback;
}

function AiSummaryPending({ label }: { label: string }) {
  return (
    <div className="flex-1 space-y-2.5" aria-live="polite" aria-busy>
      <p className="flex items-center gap-2 text-feature-foreground/75">
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
        {label}
      </p>
      <div className="space-y-1.5" aria-hidden>
        <div className="h-2.5 w-full animate-pulse rounded-full bg-white/15" />
        <div className="h-2.5 w-11/12 animate-pulse rounded-full bg-white/15 [animation-delay:120ms]" />
        <div className="h-2.5 w-8/12 animate-pulse rounded-full bg-white/15 [animation-delay:240ms]" />
      </div>
    </div>
  );
}

/** What the narrative covers, stated on the card — the same window the KPIs beside it cover. */
const PERIOD_NOTE: Record<DashboardRange, string> = {
  today: "today, in progress",
  "7d": "last 7 days",
  "30d": "this month so far",
  range: "",
};

/**
 * The org AI narrative, **following the dashboard's range control**.
 *
 * One endpoint for every range: `GET /v1/insights/reports/dept-summary` (`force` → its regenerate
 * twin) over **exactly the KPI window** — `days[0]..days[last]` from the board, in the selected
 * department. Today is today (in progress); every other range is the window the KPIs describe, so
 * the narrative and the tiles beside it are always about the same days. (The table that stood here
 * described per-period daily/weekly/monthly report endpoints this card no longer calls, and a Week
 * that was an ISO week while the KPIs were a rolling seven days — QA audit 2026-10-08, WP-431.)
 */
export function OrgAiSummaryWidget({
  range = "today",
  rangeLabel,
  days,
  department = "all",
  departmentLabel,
}: {
  range?: DashboardRange;
  rangeLabel?: string;
  /** The days the KPIs cover, resolved — the summary window is drawn from these. */
  days?: string[];
  /** Selected department id, or `"all"` for the whole org. Makes the summary respect the dropdown. */
  department?: string;
  /** Display label for that department (undefined for `"all"`). */
  departmentLabel?: string;
}) {
  const openAssistant = useAssistantStore((s) => s.openAssistant);
  // The floating assistant's own gate — a button it can't answer is a button that does nothing.
  const canAsk = useAssistantAccess().chat;
  const [narrative, setNarrative] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  /** Did anyone in the window get a score? With nobody scored the server writes its own fixed
   *  sentence and never calls the model, so a re-run could only repeat it (MON-21). */
  const [hasData, setHasData] = useState(false);
  /** Who wrote the narrative — the AI mark and the "generated" line follow it (XC-08, MON-08). */
  const [provenance, setProvenance] = useState<Provenance>({ kind: "none" });
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The window the summary covers — the KPI window's own bounds, so ANY range is summarisable.
  const span = useMemo(() => {
    // "Today" summarises TODAY. Today's numbers are still accruing (attendance verdicts land at the
    // 00:15 close, scores rise as agents report), so the card labels this window "today, in
    // progress" rather than presenting a moving figure as final.
    if (range === "today") {
      const t = new Date();
      const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
      return { from: iso, to: iso };
    }
    // No resolved days — a custom range still being picked. There is nothing to summarise, so
    // nothing is read: this fell back to the last workday, a day the board was not showing
    // (QA audit 2026-10-08, WP-432).
    if (!days || days.length === 0) return null;
    return { from: days[0], to: days[days.length - 1] };
  }, [range, days]);
  // Primitives, so a fresh `days` array from each 30 s poll does not refetch the narrative.
  const from = span?.from ?? null;
  const to = span?.to ?? null;

  // One department-scoped endpoint for every range (`force` picks its regenerate twin). Gated on
  // `ai.insights` — the same gate the old attention fallback used — so respecting the department
  // dropdown never changes which orgs can read a summary. The plain GET serves the server-cached
  // narrative; Regenerate forces a fresh model run.
  const fetchSummary = useCallback(
    async (
      force: boolean,
    ): Promise<{
      narrative: string;
      generatedAt: number | null;
      scored: number;
      provenance: Provenance;
    }> => {
      if (!from || !to) throw new Error("No window to summarize.");
      const args: DeptSummaryArgs = {
        department,
        label: departmentLabel,
        from,
        to,
        period: rangeLabel,
      };
      const r = force ? await regenerateDeptSummary(args) : await getDeptSummary(args);
      return {
        narrative: r.narrative,
        generatedAt: r.generated_at,
        scored: r.metrics?.scored_people ?? 0,
        provenance: deptSummaryProvenance({
          ...r,
          metrics: { scored_people: r.metrics?.scored_people ?? 0 },
        }),
      };
    },
    [department, departmentLabel, from, to, rangeLabel],
  );

  // Every read — the load below and Regenerate — takes a ticket, and only the latest may land. A
  // Regenerate (a multi-second model run) that finished after a range switch put the old window's
  // narrative under the new window's heading (QA audit 2026-10-08, WP-432).
  const ticket = useRef(0);

  useEffect(() => {
    const id = ++ticket.current;
    setError(null);
    if (!from || !to) {
      setNarrative(null);
      setGeneratedAt(null);
      setHasData(false);
      setProvenance({ kind: "none" });
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchSummary(false)
      .then((r) => {
        if (id !== ticket.current) return;
        setNarrative(r.narrative);
        setGeneratedAt(r.generatedAt);
        setHasData(r.scored > 0);
        setProvenance(r.provenance);
      })
      .catch((e) => {
        if (id === ticket.current) setError(errorMessage(e, "Couldn't load the AI summary."));
      })
      .finally(() => {
        if (id === ticket.current) setLoading(false);
      });
  }, [fetchSummary, from, to]);

  /**
   * Regenerate is a fresh, billed model run, so it is offered only when there is something to
   * analyse and text on screen to replace — the shared rule every AI card follows (UX audit
   * 2026-10-16, MON-21). It stays up while a run is in flight so its spinner has somewhere to be.
   */
  const offerRegenerate = regenerating || canRegenerate(hasData, narrative);

  async function regenerate() {
    if (regenerating || loading || !from || !to || !canRegenerate(hasData, narrative)) return;
    const id = ++ticket.current;
    setRegenerating(true);
    setError(null);
    try {
      const r = await fetchSummary(true);
      if (id !== ticket.current) return; // the window changed while the model ran
      setNarrative(r.narrative);
      setGeneratedAt(r.generatedAt);
      setHasData(r.scored > 0);
      setProvenance(r.provenance);
    } catch (e) {
      // Keep the previous narrative on screen — a failed re-run shouldn't blank a good summary.
      if (id === ticket.current) setError(errorMessage(e, "Couldn't regenerate the summary."));
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Card className="bg-feature text-feature-foreground shadow-none">
      {/* No control in the top-right. The dashboard shell floats this widget's drag and remove
          buttons there on hover (`customizable-dashboard`, `absolute right-3 top-3`), so anything
          the header right-aligns collides with them — and it collides precisely when someone is
          hovering the widget, which is when they'd reach for either. Reserving ~72px of permanent
          dead space to dodge it would be worse in a tile this narrow, so Regenerate sits with the
          other action at the foot of the card instead. */}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {/* The AI mark only on model output (UX audit XC-08): with nobody scored the server sends its
              own fixed sentence, which was presented as an "AI summary" with the sparkle. */}
          {provenance.kind === "computed" ? (
            "Summary"
          ) : (
            <>
              <Sparkles className="size-4" /> AI summary
            </>
          )}
          {PERIOD_NOTE[range] ? (
            <span className="text-[11px] font-normal text-feature-foreground/60">
              · {PERIOD_NOTE[range]}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm leading-relaxed text-feature-foreground/90">
        {loading || regenerating ? (
          <AiSummaryPending
            label={regenerating ? "Regenerating the summary…" : "Generating the summary…"}
          />
        ) : narrative ? (
          <>
            {/* The prompt returns a markdown bullet list; a bare <p> printed the "- " literally
                and ran every bullet into one line. */}
            <Markdown className="flex-1">{narrative}</Markdown>
            {/* Who wrote it, in the line every AI card prints (`provenanceLine`, MON-08); the one
                date-time notation either way (`formatGeneratedAt` → `formatDateTime`, XC-06). */}
            {provenance.kind !== "none" ? (
              <p className="text-[11px] text-feature-foreground/60">{provenanceLine(provenance)}</p>
            ) : formatGeneratedAt(generatedAt) ? (
              <p className="text-[11px] text-feature-foreground/60">
                Generated {formatGeneratedAt(generatedAt)}
              </p>
            ) : null}
          </>
        ) : null}
        {error ? <p className="text-feature-foreground/70">{error}</p> : null}
        {/* Both of the widget's actions, together and out of the shell's way. `flex-wrap` so the
            pair stacks rather than overflowing when the tile is narrow. */}
        <div className="flex flex-wrap items-center gap-2">
          {canAsk ? (
            <button
              type="button"
              onClick={() =>
                openAssistant(
                  `Summarize ${rangeLabel ?? "this week"}'s productivity and flag any burnout risks.`,
                )
              }
              className="inline-flex w-fit items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white hover:bg-white/25"
            >
              Ask the assistant <ArrowUpRight className="size-3.5" />
            </button>
          ) : null}
          {offerRegenerate ? (
            <button
              type="button"
              onClick={regenerate}
              disabled={loading || regenerating}
              title="Regenerate summary"
              className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-feature-foreground/80 transition-colors hover:bg-white/15 hover:text-feature-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
              {regenerating ? "Regenerating…" : "Regenerate"}
            </button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

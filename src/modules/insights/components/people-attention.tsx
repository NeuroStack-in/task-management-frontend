"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { cn } from "@/lib/utils";
import { useAttention } from "../use-attention";
import type { AttentionRow } from "../services/insights.service";

/**
 * People who need attention — the AI reduce (`GET /v1/insights/attention`, LLD §12 ⑧). The server
 * ranks the org **deterministically** (low productivity + anomaly load) and the model narrates it;
 * this renders that ranking with the concrete anomaly reasons. **Real, monitoring-fed:** the list is
 * empty on a day no agent reported — an honest "all clear", never a fabricated flag.
 */

type SeverityFilter = "all" | "high" | "medium" | "low";
const SEVERITY_FILTERS: SeverityFilter[] = ["all", "high", "medium", "low"];

const SEVERITY_META: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  high: { label: "High", dot: "bg-destructive", badge: "bg-destructive/12 text-destructive" },
  medium: { label: "Medium", dot: "bg-warning", badge: "bg-warning/15 text-warning" },
  low: { label: "Low", dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground" },
};

/** Anomaly-type slugs (server) → human labels. */
const REASON_LABEL: Record<string, string> = {
  inactivity: "Productivity drop",
  overtime: "Overtime / after-hours",
  idle: "Idle (low engagement)",
  burnout: "Burnout risk",
  policy: "Policy concern",
};

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days));
}

export function PeopleAttentionCard({
  title = "People to check in on",
}: {
  title?: string;
}) {
  // Default to yesterday (a completed, fully-scored day); client-side to avoid an SSR date mismatch.
  const [date, setDate] = useState<string>("");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  useEffect(() => setDate(shiftIso(isoOf(new Date()), -1)), []);

  const { data, loading, error } = useAttention(date);
  const today = isoOf(new Date());

  const people = useMemo(() => data?.people ?? [], [data]);
  const high = people.filter((p) => p.top_severity === "high").length;
  const withFlags = people.filter((p) => p.anomaly_count > 0).length;
  const visible = useMemo(
    () => people.filter((p) => severity === "all" || p.top_severity === severity),
    [people, severity],
  );

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1">
          <CardTitle>
            {title} ({people.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {high} high priority · {withFlags} with anomaly flags
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous day"
              disabled={!date}
              onClick={() => setDate((d) => (d ? shiftIso(d, -1) : d))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 w-36"
            />
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next day"
              disabled={!date || date >= today}
              onClick={() => setDate((d) => (d && d < today ? shiftIso(d, 1) : d))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
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
              {s === "all" ? "All" : SEVERITY_META[s].label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-0">
        {/* AI narrative over the ranking (or the factual fallback). */}
        {data?.narrative ? (
          <div className="mx-4 flex gap-2.5 rounded-lg bg-feature-tint/60 p-3 text-sm text-foreground">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="leading-relaxed">{data.narrative}</p>
          </div>
        ) : null}

        {loading && !data ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            <Loader label="Ranking the team…" />
          </div>
        ) : error ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">{error}</p>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Check}
            title={people.length === 0 ? "All clear" : "Nothing at this level"}
            description={
              people.length === 0
                ? "No one is flagged for this day — scores are in range and no anomalies fired."
                : "No flagged people match this severity."
            }
            className="m-4 border-0"
          />
        ) : (
          <div className="divide-y">
            {visible.map((p) => (
              <AttentionItem key={p.user_id} row={p} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttentionItem({ row }: { row: AttentionRow }) {
  const sev = SEVERITY_META[row.top_severity] ?? SEVERITY_META.low;
  const reasons = row.reasons.map((r) => REASON_LABEL[r] ?? r);
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", sev.dot)} />
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-feature-tint text-primary">
        <AlertTriangle className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{row.name}</span>
          <Badge className="bg-muted text-muted-foreground">score {row.score}</Badge>
          {row.top_severity ? <Badge className={sev.badge}>{sev.label}</Badge> : null}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {reasons.length > 0
            ? reasons.join(" · ")
            : "Low productivity score — no specific anomaly, worth a check-in."}
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronLeft, ChevronRight, Gauge as GaugeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AgentPending } from "@/components/shared/agent-pending";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Gauge } from "@/components/shared/gauge";
import { Sparkline } from "@/components/shared/sparkline";
import { DeltaPill } from "@/components/shared/delta-pill";
import { cn } from "@/lib/utils";
import { useOrgActivity, useSelfActivity } from "../use-activity";
import type { PersonScore } from "../services/insights.service";

/**
 * Activity — the productivity-score read models (LLD §12). This surface renders exactly what the
 * scorer stores and no more:
 *  • **Org day rollup** (`GET /v1/insights/activity`) — an average-score gauge, the productive /
 *    neutral / distracting category split, and a per-person leaderboard ranked by score. People the
 *    agent isn't reporting for are shown as an honest gap, never a zero.
 *  • **Personal trend** (`GET /v1/me/insights/activity`) — a 14-day daily-score sparkline + trend.
 *
 * The server has **no hourly buckets and no per-app / per-URL data** (that needs minute-level agent
 * capture), so those mock sections degrade to `<AgentPending>` rather than fabricating a curve.
 */

const SELF_WINDOW_DAYS = 14;

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days));
}

const fmtHours = (sec: number): string => {
  const h = sec / 3600;
  return `${h.toFixed(h >= 10 ? 0 : 1)}h`;
};

const CATEGORIES = [
  { key: "productive", label: "Productive", cls: "bg-success" },
  { key: "neutral", label: "Neutral", cls: "bg-warning" },
  { key: "distracting", label: "Distracting", cls: "bg-destructive" },
] as const;

export function ActivityTab() {
  // Default to yesterday (a completed, fully-scored day); client-side to avoid an SSR date mismatch.
  const [date, setDate] = useState<string>("");
  useEffect(() => setDate(shiftIso(isoOf(new Date()), -1)), []);

  const today = isoOf(new Date());
  const selfFrom = date ? shiftIso(date, -(SELF_WINDOW_DAYS - 1)) : "";

  const org = useOrgActivity(date);
  const self = useSelfActivity(selfFrom, date);

  return (
    <div className="space-y-4">
      {/* Date filter (mirrors People-attention) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-4 py-2.5 shadow-soft">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Productivity scores</p>
          <p className="text-xs text-muted-foreground">
            Deterministic U/Q/F/R scoring from reported activity.
          </p>
        </div>
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
      </div>

      <OrgSection state={org} />

      <SelfTrendCard state={self} />

      {/* Honest degradation: the scorer stores daily totals only — no minute-level buckets. */}
      <Card>
        <CardContent className="p-2">
          <AgentPending
            title="Hour-by-hour activity"
            detail="Hour-by-hour activity heatmaps and app / website usage appear here once the desktop agent reports minute-level capture. Today the server stores daily totals only."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function OrgSection({ state }: { state: ReturnType<typeof useOrgActivity> }) {
  const { data, loading, error } = state;

  const rollup = data?.rollup;
  const catTotal = rollup
    ? rollup.productive_sec_total + rollup.neutral_sec_total + rollup.distracting_sec_total
    : 0;
  const catValues: Record<string, number> = {
    productive: rollup?.productive_sec_total ?? 0,
    neutral: rollup?.neutral_sec_total ?? 0,
    distracting: rollup?.distracting_sec_total ?? 0,
  };

  // Rank: scored people by score desc, then the un-reported at the bottom.
  const ranked = useMemo(() => {
    const people = data?.people ?? [];
    const scored = people
      .filter((p) => p.breakdown)
      .sort((a, b) => (b.breakdown!.score - a.breakdown!.score));
    const missing = people.filter((p) => !p.breakdown);
    return { scored, missing };
  }, [data]);

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="flex min-h-[12rem] items-center justify-center">
          <Loader label="Scoring the team…" />
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const scoredCount = rollup?.scored_people ?? 0;
  const totalCount = rollup?.total_people ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Org average score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GaugeIcon className="size-4 text-primary" /> Team average score
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-2">
          {rollup && rollup.avg_score !== null ? (
            <>
              <Gauge value={rollup.avg_score} />
              <p className="text-xs text-muted-foreground">
                {scoredCount} of {totalCount}{" "}
                {totalCount === 1 ? "person" : "people"} scored ·{" "}
                {fmtHours(rollup.active_sec_total)} active
              </p>
            </>
          ) : (
            <EmptyState
              icon={Activity}
              title="No scores yet"
              description="No one reported activity on this day, so there's no score to average. Scores appear once the desktop agent reports."
              className="border-0"
            />
          )}
        </CardContent>
      </Card>

      {/* Category split */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Time by category</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-3">
          {catTotal > 0 ? (
            <>
              {CATEGORIES.map((cat) => {
                const pct = Math.round((catValues[cat.key] / catTotal) * 100);
                return (
                  <div key={cat.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2.5 rounded-full", cat.cls)} />
                        {cat.label}
                      </span>
                      <span className="font-medium tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", cat.cls)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <p className="mt-auto pt-1 text-xs text-muted-foreground">
                Based on {fmtHours(catTotal)} of categorised activity across the team.
              </p>
            </>
          ) : (
            <EmptyState
              icon={Activity}
              title="No activity to categorise"
              description="Category time appears once agents report productive / neutral / distracting activity for this day."
              className="border-0"
            />
          )}
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">
            Leaderboard{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({ranked.scored.length} scored)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ranked.scored.length === 0 && ranked.missing.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No people to rank"
              description="No one is in scope for this day."
              className="m-4 border-0"
            />
          ) : (
            <div className="divide-y">
              {ranked.scored.map((p, i) => (
                <LeaderRow key={p.user_id} rank={i + 1} person={p} />
              ))}
              {ranked.missing.map((p) => (
                <LeaderRow key={p.user_id} person={p} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LeaderRow({ rank, person }: { rank?: number; person: PersonScore }) {
  const b = person.breakdown;
  const active = person.totals?.active_sec ?? 0;

  if (!b) {
    return (
      <div className="flex items-center gap-3 px-5 py-3">
        <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">—</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
          {person.name}
        </span>
        <Badge variant="outline" className="text-muted-foreground">
          no activity reported
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
      <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{person.name}</span>
      <div className="flex items-center gap-1.5">
        <SubScore label="U" value={b.u} />
        <SubScore label="Q" value={b.q} />
        <SubScore label="F" value={b.f} />
        <SubScore label="R" value={b.r} />
      </div>
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {fmtHours(active)} active
      </span>
      <Badge className="w-14 justify-center bg-primary/10 text-primary tabular-nums">
        {Math.round(b.score)}
      </Badge>
    </div>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/70">{label}</span>
      <span className="tabular-nums">{Math.round(value)}</span>
    </span>
  );
}

function SelfTrendCard({ state }: { state: ReturnType<typeof useSelfActivity> }) {
  const { data, loading, error } = state;

  const days = useMemo(
    () => (data?.days ?? []).slice().sort((a, b) => a.date.localeCompare(b.date)),
    [data],
  );
  const scores = days.map((d) => d.score);
  const trend = data?.trend;
  const baselineDelta =
    trend && trend.avg_score !== null && trend.baseline !== null
      ? Math.round(trend.avg_score - trend.baseline)
      : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Your {SELF_WINDOW_DAYS}-day trend</CardTitle>
        {baselineDelta !== null ? <DeltaPill value={baselineDelta} /> : null}
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            <Loader label="Loading your trend…" />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{error}</p>
        ) : scores.length < 2 ? (
          <EmptyState
            icon={Activity}
            title="Not enough scored days"
            description="Your daily productivity scores appear here once the desktop agent has reported activity across a few days."
            className="border-0"
          />
        ) : (
          <div className="space-y-4">
            <div className="text-primary">
              <Sparkline data={scores} area showDot height={72} strokeWidth={2} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TrendStat label="Average" value={trend?.avg_score} />
              <TrendStat label="Best" value={trend?.best?.score ?? null} sub={trend?.best?.date} />
              <TrendStat label="Worst" value={trend?.worst?.score ?? null} sub={trend?.worst?.date} />
              <TrendStat label="Baseline" value={trend?.baseline ?? null} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | null | undefined;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-semibold tabular-nums">
        {value === null || value === undefined ? "—" : Math.round(value)}
      </p>
      {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

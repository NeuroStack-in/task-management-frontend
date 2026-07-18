"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gauge,
  Lock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { StatCard } from "@/components/shared/stat-card";
import { cn } from "@/lib/utils";
import { PeopleAttentionCard } from "./people-attention";
import { useAiReport, useReportsCatalog } from "../use-reports";
import type { AiReport, NamedScore, ReportType } from "../services/insights.service";

/* -------------------------------- date utils ------------------------------- */

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days));
}
function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/* -------------------------------- component ------------------------------- */

export function ReportsExperimental() {
  // Default to yesterday (a completed, fully-scored day); client-side to avoid an SSR date mismatch.
  const [date, setDate] = useState<string>("");
  useEffect(() => setDate(shiftIso(isoOf(new Date()), -1)), []);

  const today = isoOf(new Date());
  const aiReport = useAiReport(date);
  const catalog = useReportsCatalog();

  return (
    <div className="wp-enter space-y-8">
      {/* ================================ HEADER =============================== */}
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          AI reports
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          An AI-written executive read of the workforce, plus every report you
          can export.
        </p>
      </div>

      {/* ========================= AI EXECUTIVE REPORT ======================== */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel
            icon={Sparkles}
            title="Executive report"
            hint="AI summary of org productivity for the day"
          />
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
              className="h-8 w-40"
            />
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next day"
              disabled={!date || date >= today}
              onClick={() =>
                setDate((d) => (d && d < today ? shiftIso(d, 1) : d))
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {aiReport.locked ? (
          <EmptyState
            icon={Lock}
            title="Requires the AI Reports add-on"
            description="The AI executive report is part of the AI Reports add-on (insights.reports.ai_pdf). Ask an owner to enable it to generate day-over-day AI briefings and PDF exports."
          />
        ) : aiReport.loading && !aiReport.data ? (
          <Card>
            <CardContent className="flex min-h-[10rem] items-center justify-center">
              <Loader label="Generating the executive report…" />
            </CardContent>
          </Card>
        ) : aiReport.error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {aiReport.error}
            </CardContent>
          </Card>
        ) : aiReport.data ? (
          <AiExecutiveReport report={aiReport.data} />
        ) : null}
      </section>

      {/* ====================== PEOPLE TO CHECK IN ON ====================== */}
      <PeopleAttentionCard title="People to check in on" />

      {/* ============================ REPORT CATALOG ========================== */}
      <section className="space-y-4">
        <SectionLabel
          icon={FileText}
          title="All reports"
          hint="Every report available to your organization"
        />

        {catalog.loading && catalog.reports.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-[8rem] items-center justify-center">
              <Loader label="Loading reports…" />
            </CardContent>
          </Card>
        ) : catalog.error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {catalog.error}
            </CardContent>
          </Card>
        ) : catalog.reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No reports available"
            description="No reports are enabled for your organization yet."
          />
        ) : (
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.reports.map((r) => (
              <ReportCatalogCard key={r.key} report={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------ section label ----------------------------- */

function SectionLabel({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

/* --------------------------- AI executive report -------------------------- */

const hrs = (h: number) => `${h.toFixed(1)}h`;

function AiExecutiveReport({ report }: { report: AiReport }) {
  const m = report.metrics;
  const generated = new Date(report.generated_at * 1000);

  return (
    <div className="space-y-4">
      {/* Headline metrics — real org rollup for the day. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Org avg score"
          value={m.avg_score === null ? "—" : `${Math.round(m.avg_score)}`}
          icon={Gauge}
          hint={m.avg_score === null ? "no scored days" : "/ 100"}
          featured
        />
        <StatCard
          label="People scored"
          value={`${m.scored_people}/${m.total_people}`}
          icon={Users}
          hint="agents reporting"
        />
        <StatCard
          label="Active hours"
          value={hrs(m.active_hours_total)}
          icon={TrendingUp}
        />
        <StatCard
          label="Productive hours"
          value={hrs(m.productive_hours_total)}
          icon={TrendingUp}
        />
      </div>

      {/* AI narrative prose. */}
      <Card className="border-0 bg-feature text-feature-foreground shadow-none">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" /> Executive summary ·{" "}
            {prettyDate(report.date)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          <p className="text-sm leading-relaxed text-feature-foreground/90">
            {report.narrative}
          </p>
          <p className="text-xs text-feature-foreground/70">
            Generated {generated.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* Top performers vs needs attention. */}
      <div className="grid gap-4 md:grid-cols-2">
        <NamedScoreList
          title="Top performers"
          icon={TrendingUp}
          tone="up"
          people={m.top_performers}
          emptyText="No scored people for this day yet."
        />
        <NamedScoreList
          title="Needs attention"
          icon={TrendingDown}
          tone="down"
          people={m.needs_attention}
          emptyText="No one flagged for this day."
        />
      </div>
    </div>
  );
}

function NamedScoreList({
  title,
  icon: Icon,
  tone,
  people,
  emptyText,
}: {
  title: string;
  icon: LucideIcon;
  tone: "up" | "down";
  people: NamedScore[];
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon
            className={cn(
              "size-4",
              tone === "up" ? "text-success" : "text-warning",
            )}
          />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {people.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <div className="divide-y">
            {people.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <span className="min-w-0 truncate text-sm font-medium">
                  {p.name}
                </span>
                <Badge
                  className={cn(
                    tone === "up"
                      ? "bg-success/12 text-success"
                      : "bg-warning/15 text-warning",
                  )}
                >
                  score {Math.round(p.score)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ----------------------------- report catalog card ------------------------ */

function ReportCatalogCard({ report }: { report: ReportType }) {
  const locked = !report.available;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-feature-tint text-primary">
          <FileText className="size-5" />
        </span>
        {locked ? (
          <Badge variant="outline" className="gap-1">
            <Lock className="size-3" /> Add-on
          </Badge>
        ) : null}
      </div>

      <h3 className="mt-3 font-heading text-base font-semibold">
        {report.title}
      </h3>
      <p className="mt-1.5 line-clamp-3 min-h-[3.75rem] text-sm text-muted-foreground">
        {report.description}
      </p>

      <div className="mt-auto flex items-center justify-between pt-3 text-xs">
        {locked ? (
          <span className="text-muted-foreground">
            Requires{" "}
            <span className="font-medium text-foreground">
              {report.requires_entitlement ?? "an add-on"}
            </span>
          </span>
        ) : (
          <span className="font-medium text-primary">
            Open report
          </span>
        )}
        {locked ? (
          <Lock className="size-4 text-muted-foreground" />
        ) : (
          <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-0.5" />
        )}
      </div>
    </>
  );

  if (locked) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-dashed border-border bg-muted/30 p-5">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={report.route}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {body}
    </Link>
  );
}

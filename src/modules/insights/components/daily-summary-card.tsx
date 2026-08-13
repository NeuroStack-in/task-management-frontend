"use client";

/**
 * "Your day" — a real, self-scoped AI briefing backed by `GET /v1/me/insights/summary`. Real metrics
 * (worked/tracked/billable time, tasks, attendance) plus an AI-written narrative, for a date the user
 * picks. Defaults to today (use the picker for a completed prior day). Not agent-gated — it reads
 * attendance + timesheet.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import { AiReportCard, type AiSignal, type AiMetric } from "./ai-report-card";
import {
  getDailySummary,
  regenerateDailySummary,
  type DailySummary,
} from "../services/insights.service";

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
const hrs = (secs: number) => `${(secs / 3600).toFixed(1)}h`;

function toMetrics(s: DailySummary): AiMetric[] {
  const m = s.metrics;
  const metrics: AiMetric[] = [];
  // The productivity score leads when the agent reported activity that day (else it's absent — the
  // score needs the desktop agent's active/idle/keystroke/app data, 80% of the formula).
  if (s.score) metrics.push({ label: "Productivity score", value: `${s.score.score}/100` });
  metrics.push(
    { label: "Hours worked", value: `${(m.worked_minutes / 60).toFixed(1)}h` },
    { label: "Tracked", value: hrs(m.tracked_secs) },
    { label: "Billable", value: hrs(m.billable_secs) },
    { label: "Tasks", value: m.task_count },
  );
  return metrics;
}

function toSignals(s: DailySummary): AiSignal[] {
  const m = s.metrics;
  const out: AiSignal[] = [
    {
      label: "Attendance",
      value: m.attendance.replace(/_/g, " "),
      tone: m.attendance === "present" ? "up" : m.attendance === "absent" ? "down" : "flat",
    },
  ];
  // The U/Q/F/R breakdown behind the score, when present — the four levers the number is made of.
  if (s.score) {
    const round = (n: number) => Math.round(n);
    out.push({ label: "Utilization", value: `${round(s.score.u)}`, tone: "flat" });
    // **Quality is omitted when it wasn't measured** (PRODUCTIVITY.md §1.4). On a day with no
    // classified app time the server drops Q, renormalises the rest, and reports `q: 0` — which is
    // indistinguishable on the wire from a day spent entirely on distracting apps. Rendering it
    // would put "Quality 0" against someone's name for an instrumentation gap. Absent flag means
    // measured, so older summaries are unaffected.
    if (s.score.q_measured !== false) {
      out.push({ label: "Quality", value: `${round(s.score.q)}`, tone: "flat" });
    }
    out.push(
      { label: "Focus", value: `${round(s.score.f)}`, tone: "flat" },
      { label: "Reliability", value: `${round(s.score.r)}`, tone: "flat" },
    );
  }
  if (m.late) out.push({ label: "Late arrival", value: "yes", tone: "down" });
  if (m.entry_count > 0) out.push({ label: "Time entries", value: String(m.entry_count), tone: "flat" });
  return out;
}

export function DailySummaryCard() {
  // Default to today; set client-side to avoid an SSR/client date mismatch.
  const [date, setDate] = useState<string>("");
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // The narrative is generate-once-cached server-side; this is the deliberate re-spend.
  const regenerate = () => {
    if (!date || regenerating) return;
    setRegenerating(true);
    regenerateDailySummary(date)
      .then((s) => setSummary(s))
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Couldn't regenerate your summary."),
      )
      .finally(() => setRegenerating(false));
  };

  useEffect(() => setDate(isoOf(new Date())), []);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setLoading(true);
    setError(null);
    getDailySummary(date)
      .then((s) => {
        if (live) setSummary(s);
      })
      .catch((e) => {
        if (live) setError(e instanceof ApiError ? e.message : "Couldn't load your summary.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [date]);

  const today = isoOf(new Date());

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your day
        </h2>
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
          <DatePicker
            value={date}
            max={today}
            onChange={setDate}
            className="w-40"
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

      {loading && !summary ? (
        <Card className="border-0 bg-feature">
          <CardContent className="flex min-h-[8rem] items-center justify-center">
            <Loader label="Generating your summary…" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">{error}</CardContent>
        </Card>
      ) : summary ? (
        <AiReportCard
          title={`Your day · ${prettyDate(summary.date)}`}
          summary={summary.narrative}
          metrics={toMetrics(summary)}
          signals={toSignals(summary)}
          onRegenerate={summary.narrative ? regenerate : undefined}
          regenerating={regenerating}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  Gauge,
  Clock,
  DollarSign,
  CalendarCheck,
  AlertTriangle,
  Sparkles,
  FileDown,
  Sheet,
  FlaskConical,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { Sparkline } from "@/components/shared/sparkline";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportCsv, exportPdf } from "@/modules/insights/lib/report-export";
import { SAMPLE_PEOPLE, type ReportDef, type UsageCategory } from "@/lib/mock-insights";
import {
  executiveSummary,
  dayTimeline,
  projectProfitability,
  timeOff,
  currency,
} from "./lib/report-data";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "executive", label: "Executive Summary" },
  { id: "timeline", label: "Day Timeline" },
  { id: "profitability", label: "Project Profitability" },
  { id: "timeoff", label: "Time-off" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const CAT: Record<UsageCategory, { dot: string; label: string; text: string }> = {
  productive: { dot: "bg-success", label: "Productive", text: "text-success" },
  neutral: { dot: "bg-muted-foreground", label: "Neutral", text: "text-muted-foreground" },
  distracting: { dot: "bg-destructive", label: "Distracting", text: "text-destructive" },
};

function ExportButtons({ report }: { report: ReportDef }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => exportCsv(report)}>
        <Sheet className="size-4" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportPdf(report)}>
        <FileDown className="size-4" /> PDF
      </Button>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  report,
  actions,
}: {
  title: string;
  description: string;
  report: ReportDef;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ExportButtons report={report} />
      </div>
    </div>
  );
}

export function DevReportsView() {
  const [tab, setTab] = useState<TabId>("executive");
  const [personId, setPersonId] = useState(SAMPLE_PEOPLE[0].id);

  const exec = useMemo(() => executiveSummary(), []);
  const timeline = useMemo(() => dayTimeline(personId), [personId]);
  const profit = useMemo(() => projectProfitability(), []);
  const off = useMemo(() => timeOff(), []);

  return (
    <div className="space-y-6">
      {/* Sandbox banner */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-dashed border-primary/40 bg-primary/[0.04] px-5 py-3 text-sm">
        <FlaskConical className="size-4 shrink-0 text-primary" />
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">Prototype sandbox</span> —{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/dev/reports</code>. Preview
          of the proposed P0 reports; move into{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/insights/ai-reports</code>{" "}
          once approved.
        </span>
      </div>

      {/* Tab switcher */}
      <div className="inline-flex flex-wrap items-center gap-0.5 rounded-full border bg-card p-0.5 shadow-soft">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "executive" ? <ExecutiveReport data={exec} /> : null}
      {tab === "timeline" ? (
        <TimelineReport
          data={timeline}
          personId={personId}
          onPerson={setPersonId}
        />
      ) : null}
      {tab === "profitability" ? <ProfitabilityReport data={profit} /> : null}
      {tab === "timeoff" ? <TimeOffReport data={off} /> : null}
    </div>
  );
}

/* ------------------------------- Executive ------------------------------- */

function ExecutiveReport({ data }: { data: ReturnType<typeof executiveSummary> }) {
  const icons = [Gauge, DollarSign, Clock, DollarSign, CalendarCheck, AlertTriangle];
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Executive Summary"
        description="One-page workforce rollup for leadership · This week"
        report={data.report}
      />

      {/* AI narrative */}
      <Card className="gap-3 bg-feature p-6 text-feature-foreground shadow-none">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4" /> AI narrative
        </div>
        <p className="text-sm leading-relaxed text-feature-foreground/90">
          {data.narrative}
        </p>
        <div className="flex items-end gap-4">
          <Sparkline
            data={data.trend}
            area
            width={200}
            height={44}
            className="text-white"
          />
          <span className="text-xs text-feature-foreground/70">
            5-week productivity trend
          </span>
        </div>
      </Card>

      {/* KPI grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.kpis.map((k, i) => (
          <StatCard
            key={k.label}
            label={k.label}
            value={k.value}
            icon={icons[i]}
            hint={k.hint}
          />
        ))}
      </div>

      {/* Recommendations */}
      <Card className="gap-0 p-0">
        <div className="border-b border-border px-5 py-4">
          <h3 className="font-display text-base font-semibold tracking-tight">
            Recommended actions
          </h3>
        </div>
        <ul className="divide-y divide-border">
          {data.recommendations.map((r) => (
            <li key={r} className="flex items-start gap-3 px-5 py-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------- Timeline ------------------------------- */

function TimelineReport({
  data,
  personId,
  onPerson,
}: {
  data: ReturnType<typeof dayTimeline>;
  personId: string;
  onPerson: (id: string) => void;
}) {
  const maxActivity = 100;
  return (
    <div className="space-y-5">
      <SectionHeader
        title={`Day Timeline`}
        description="Chronological view of one person's workday · Today"
        report={data.report}
        actions={
          <Select value={personId} onValueChange={(v) => onPerson(v as string)}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {SAMPLE_PEOPLE.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Summary chips */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Clock in" value={data.summary.clockIn} icon={Clock} />
        <StatCard label="Clock out" value={data.summary.clockOut} icon={Clock} />
        <StatCard label="Hours" value={data.summary.hours.toFixed(1)} icon={Clock} />
        <StatCard
          label="Avg activity"
          value={`${data.summary.avgActivity}%`}
          icon={Gauge}
          featured
        />
      </div>

      {/* Timeline */}
      <Card className="gap-0 p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-display text-base font-semibold tracking-tight">
            {data.person.name} · {data.person.jobTitle}
          </h3>
          <div className="flex items-center gap-4">
            {(Object.keys(CAT) as UsageCategory[]).map((c) => (
              <span key={c} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-2.5 rounded-full", CAT[c].dot)} />
                {CAT[c].label}
              </span>
            ))}
          </div>
        </div>
        <ul className="divide-y divide-border">
          {data.segs.map((s) => (
            <li key={s.time} className="flex items-center gap-4 px-5 py-2.5 text-sm">
              <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {s.time}
              </span>
              <span className={cn("size-2.5 shrink-0 rounded-full", CAT[s.category].dot)} />
              <span className="w-32 shrink-0 font-medium">{s.app}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", CAT[s.category].dot)}
                  style={{ width: `${(s.activity / maxActivity) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                {s.activity}%
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ----------------------------- Profitability ----------------------------- */

function ProfitabilityReport({
  data,
}: {
  data: ReturnType<typeof projectProfitability>;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Project Profitability"
        description="Budget burn and margin per project · To date"
        report={data.report}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total budget" value={currency(data.totals.budget)} icon={DollarSign} featured />
        <StatCard label="Total spent" value={currency(data.totals.spent)} icon={DollarSign} hint={`${Math.round((data.totals.spent / data.totals.budget) * 100)}% of budget`} />
        <StatCard label="Over budget" value={data.totals.over} icon={AlertTriangle} hint="projects" />
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="w-40">Burn</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">
                  <span className="mr-2 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                    {r.key}
                  </span>
                  {r.name}
                </TableCell>
                <TableCell className="text-right tabular-nums">{currency(r.budget)}</TableCell>
                <TableCell className="text-right tabular-nums">{currency(r.spent)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", r.over ? "bg-destructive" : "bg-primary")}
                        style={{ width: `${Math.min(100, r.burn)}%` }}
                      />
                    </div>
                    <span className={cn("w-9 text-right text-xs tabular-nums", r.over ? "text-destructive" : "text-muted-foreground")}>
                      {r.burn}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.hours}</TableCell>
                <TableCell className={cn("text-right font-medium tabular-nums", r.margin < 0 ? "text-destructive" : "")}>
                  {currency(r.margin)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ------------------------------- Time-off ------------------------------- */

function TimeOffReport({ data }: { data: ReturnType<typeof timeOff> }) {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Time-off Report"
        description="Leave taken, balances, and upcoming time off · This year"
        report={data.report}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Days taken" value={data.summary.totalUsed} icon={CalendarCheck} featured />
        <StatCard label="Upcoming leave" value={data.summary.upcoming} icon={CalendarCheck} hint="people with time off booked" />
        <StatCard label="Off within 3 days" value={data.summary.offSoon} icon={AlertTriangle} hint="plan around these" />
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Days used</TableHead>
              <TableHead className="w-40">Remaining</TableHead>
              <TableHead>Next time off</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.dept}</TableCell>
                <TableCell>
                  <Badge className="bg-primary/12 font-medium text-primary">{r.type}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.used}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-success"
                        style={{ width: `${(r.remaining / 20) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
                      {r.remaining}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.upcomingIn != null ? `in ${r.upcomingIn}d` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

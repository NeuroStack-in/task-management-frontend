"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock,
  Download,
  FileText,
  FolderKanban,
  Gauge as GaugeIcon,
  ListFilter,
  Lock,
  MonitorSmartphone,
  Search,
  ShieldAlert,
  Sheet,
  Sparkles,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeltaPill } from "@/components/shared/delta-pill";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useAssistantStore } from "@/stores/assistant.store";
import { useDataScope } from "@/hooks/use-data-scope";
import { PeopleAttentionCard } from "./people-attention";
import {
  exportAllPdf,
  exportCsv,
  exportPdf,
  exportSelectedCsv,
} from "@/modules/insights/lib/report-export";
import {
  ANOMALIES,
  EMPLOYEE_TIME,
  PROJECT_HOURS,
  REPORTS,
  REPORT_CATEGORY_LABEL,
  type ReportCategory,
  type ReportDef,
} from "@/lib/mock-insights";

/* --------------------------------- meta ---------------------------------- */

const CATEGORY_ICON: Record<ReportCategory, LucideIcon> = {
  workforce: Users,
  time: Clock,
  attendance: CalendarCheck,
  activity: Activity,
  monitoring: MonitorSmartphone,
  projects: FolderKanban,
};

/**
 * Purpose-driven "smart collections" — how an analyst would group reports for an
 * executive, rather than by raw data category. Each collection maps to one or
 * more underlying categories.
 */
const SMART_GROUPS: {
  id: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  categories: ReportCategory[];
}[] = [
  {
    id: "performance",
    title: "Performance & Productivity",
    blurb: "How the team is performing",
    icon: TrendingUp,
    categories: ["workforce"],
  },
  {
    id: "billing",
    title: "Time, Billing & Projects",
    blurb: "Capacity, billable hours, and where time goes",
    icon: Clock,
    categories: ["time", "projects"],
  },
  {
    id: "risk",
    title: "Risk & Compliance",
    blurb: "Anomalies, burnout, and monitoring coverage",
    icon: ShieldAlert,
    categories: ["monitoring"],
  },
  {
    id: "activity",
    title: "Attendance & Activity",
    blurb: "Presence and how time is spent",
    icon: Activity,
    categories: ["attendance", "activity"],
  },
];

const byId = (id: string) => REPORTS.find((r) => r.id === id);

/** Which smart collection a report belongs to (by its category). */
const collectionOf = (r: ReportDef) =>
  SMART_GROUPS.find((g) => g.categories.includes(r.category))?.id ?? "other";

/* ------------------------------- derivations ------------------------------ */

const mean = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;

function healthBand(score: number) {
  if (score >= 80)
    return { label: "Healthy", color: "var(--success)", text: "text-success" };
  if (score >= 65)
    return { label: "Stable", color: "var(--primary)", text: "text-primary" };
  if (score >= 50)
    return { label: "Watch", color: "var(--warning)", text: "text-warning" };
  return {
    label: "At risk",
    color: "var(--destructive)",
    text: "text-destructive",
  };
}

/* -------------------------------- component ------------------------------- */

export function ReportsExperimental() {
  const { can } = usePermissions();
  const canExport = can("reports:export");
  const openAssistant = useAssistantStore((s) => s.openAssistant);
  const { ids: scopeIds } = useDataScope();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<ReportDef | null>(null);
  // Selected category collections (empty = show all).
  const [cats, setCats] = useState<Set<string>>(new Set());

  const searching = query.trim().length > 0;

  /* ----- executive metrics (real, derived data, scoped to the role) ----- */
  const kpis = useMemo(() => {
    // Team leads see only their team's people; org roles see the whole workforce.
    const emp = EMPLOYEE_TIME.filter(
      (e) => scopeIds === null || scopeIds.has(e.id),
    );
    const flags = ANOMALIES.filter(
      (a) => scopeIds === null || scopeIds.has(a.user.id),
    );

    const avgUtil = mean(emp.map((e) => e.utilization));
    const avgProd = mean(emp.map((e) => e.productivity));
    const tracked = emp.reduce((a, e) => a + e.tracked, 0);
    const atRisk = PROJECT_HOURS.filter((p) => !p.onTrack).length;
    const atRiskPct = Math.round((atRisk / (PROJECT_HOURS.length || 1)) * 100);
    const highFlags = flags.filter((a) => a.severity === "high").length;

    // Wellbeing / engagement signals — distinct from the utilization/productivity
    // figures already shown in the AI summary and KPIs above.
    const focus = mean(
      emp.map((e) =>
        e.tracked > 0 ? Math.round(((e.tracked - e.idle) / e.tracked) * 100) : 0,
      ),
    );
    const billable = mean(emp.map((e) => e.billable));
    const burnout = flags.filter((a) => a.kind === "burnout").length;
    const afterHours = flags.filter((a) => a.kind === "after-hours").length;

    // Composite "health" — a weighted blend of the four drivers.
    const score = Math.round(
      0.4 * avgProd + 0.35 * avgUtil + 0.25 * (100 - atRiskPct),
    );
    return {
      empCount: emp.length,
      avgUtil,
      avgProd,
      tracked,
      atRisk,
      atRiskPct,
      highFlags,
      focus,
      billable,
      burnout,
      afterHours,
      score,
    };
  }, [scopeIds]);

  const band = healthBand(kpis.score);

  /* ----- AI "needs attention" items for the briefing ----- */
  const attention = useMemo(
    () =>
      [
        {
          id: "project",
          icon: FolderKanban,
          text: `${kpis.atRisk} projects flagged at risk`,
        },
        {
          id: "anomalies",
          icon: ShieldAlert,
          text: `Burnout & productivity-drop anomalies on ${kpis.highFlags} people`,
        },
        {
          id: "utilization",
          icon: GaugeIcon,
          text: `Utilization at ${kpis.avgUtil}% — nearing capacity`,
        },
      ]
        .map((a) => ({ ...a, report: byId(a.id) }))
        .filter((a): a is typeof a & { report: ReportDef } => Boolean(a.report)),
    [kpis],
  );

  /* ----- search across the whole library ----- */
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return REPORTS;
    return REPORTS.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        REPORT_CATEGORY_LABEL[r.category].toLowerCase().includes(q),
    );
  }, [query]);

  // Per-collection counts (within the current search) drive the filter chips.
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of matches) {
      const id = collectionOf(r);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, [matches]);

  const shownGroups = SMART_GROUPS.filter(
    (g) => (collectionCounts[g.id] ?? 0) > 0,
  );

  const toggleCat = (id: string) =>
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visibleReports = useMemo(
    () => matches.filter((r) => cats.size === 0 || cats.has(collectionOf(r))),
    [matches, cats],
  );

  // Trigger summary label for the category dropdown.
  const catLabel =
    cats.size === 0
      ? "All categories"
      : cats.size === 1
        ? (SMART_GROUPS.find((g) => g.id === [...cats][0])?.title ??
          "1 category")
        : `${cats.size} categories`;

  const selectedReports = useMemo(
    () => REPORTS.filter((r) => selected.has(r.id)),
    [selected],
  );

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="wp-enter space-y-8">
      {/* ================================ HEADER =============================== */}
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Insights & Reports
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Your AI analyst has organized everything — read the brief, act on what
          matters.
        </p>
      </div>

      {/* ========================= EXECUTIVE OVERVIEW ======================== */}
      <section className="grid gap-4 xl:grid-cols-12">
        <AiBriefing
          empCount={kpis.empCount}
          projCount={PROJECT_HOURS.length}
          atRisk={kpis.atRisk}
          attention={attention}
          onAsk={openAssistant}
          onOpen={setPreview}
        />
        <HealthScoreCard kpis={kpis} band={band} />
      </section>

      {/* ====================== PEOPLE TO CHECK IN ON ====================== */}
      <PeopleAttentionCard title="People to check in on" />

      {/* ============================ ALL REPORTS ========================== */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel icon={Search} title="All reports">
            {searching
              ? `${matches.length} ${matches.length === 1 ? "match" : "matches"} for “${query.trim()}”`
              : "Every report, organized by purpose"}
          </SectionLabel>
          <div className="flex items-center gap-2">
            {selected.size > 0 ? (
              <SelectionBar
                count={selected.size}
                canExport={canExport}
                reports={selectedReports}
                onClear={() => setSelected(new Set())}
              />
            ) : null}
            <DownloadAllButton canExport={canExport} />
          </div>
        </div>

        {!canExport ? (
          <div className="flex items-center gap-2.5 rounded-xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" />
            You can view and preview reports, but exporting requires the{" "}
            <span className="font-medium text-foreground">Export Reports</span>{" "}
            permission.
          </div>
        ) : null}

        {/* Category filter — one dropdown, multi-select (no checkboxes) */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="gap-2" />}
          >
            <ListFilter className="size-4" />
            {catLabel}
            <ChevronDown className="size-4 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="flex w-64 flex-col gap-0.5 p-1.5">
            <DropdownMenuItem
              closeOnClick={false}
              onClick={() => setCats(new Set())}
              className="justify-between gap-2 rounded-lg px-2 py-2"
            >
              <span className="font-medium">All categories</span>
              <span className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {matches.length}
                </span>
                {cats.size === 0 ? (
                  <Check className="size-4 text-primary" />
                ) : (
                  <span className="size-4" />
                )}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {shownGroups.map((g) => {
              const on = cats.has(g.id);
              const Icon = g.icon;
              return (
                <DropdownMenuItem
                  key={g.id}
                  closeOnClick={false}
                  onClick={() => toggleCat(g.id)}
                  className={cn(
                    "justify-between gap-2 rounded-lg px-2 py-2",
                    on && "bg-accent/60",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{g.title}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {collectionCounts[g.id] ?? 0}
                    </span>
                    {on ? (
                      <Check className="size-4 text-primary" />
                    ) : (
                      <span className="size-4" />
                    )}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {visibleReports.length === 0 ? (
          <EmptyResults
            query={query.trim()}
            onReset={() => {
              setQuery("");
              setCats(new Set());
            }}
          />
        ) : (
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                canExport={canExport}
                selected={selected.has(report.id)}
                onToggleSelect={() => toggleSelect(report.id)}
                onOpen={() => setPreview(report)}
              />
            ))}
          </div>
        )}
      </section>

      <ReportPreviewDialog
        report={preview}
        canExport={canExport}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

/* ------------------------------ section label ----------------------------- */

function SectionLabel({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        {children ? (
          <p className="text-xs text-muted-foreground">{children}</p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------- AI briefing ------------------------------ */

function AiBriefing({
  empCount,
  projCount,
  atRisk,
  attention,
  onAsk,
  onOpen,
}: {
  empCount: number;
  projCount: number;
  atRisk: number;
  attention: { id: string; icon: LucideIcon; text: string; report: ReportDef }[];
  onAsk: () => void;
  onOpen: (r: ReportDef) => void;
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-3xl bg-feature p-6 text-feature-foreground shadow-soft xl:col-span-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.22), transparent 70%)",
        }}
      />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-2 text-sm font-medium text-feature-foreground/90">
          <Sparkles className="size-4" /> AI reporting summary
        </div>

        {/* What's happening */}
        <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-feature-foreground/90">
          Across {empCount} employees and {projCount} projects, Engineering and
          Product lead utilization this week. {atRisk} projects are flagged at
          risk and a small group is trending toward over-utilization.
        </p>

        {/* What needs attention + what to do next */}
        <div className="mt-5 space-y-2 border-t border-white/15 pt-4">
          <p className="text-xs font-semibold tracking-wide text-feature-foreground/70 uppercase">
            Needs your attention
          </p>
          {attention.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onOpen(a.report)}
              className="group flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-2 text-left transition-colors hover:bg-white/15"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <a.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">{a.text}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-feature-foreground/85">
                Open
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex-1" />
        <div>
          <Button variant="secondary" size="sm" onClick={onAsk}>
            Ask the assistant <ArrowUpRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- health score card ---------------------------- */

function HealthScoreCard({
  kpis,
  band,
}: {
  kpis: {
    focus: number;
    billable: number;
    burnout: number;
    afterHours: number;
    score: number;
  };
  band: { label: string; color: string; text: string };
}) {
  const drivers: {
    label: string;
    value: string;
    delta?: number;
    unit?: string;
  }[] = [
    { label: "Focus rate", value: `${kpis.focus}%`, delta: 2 },
    { label: "Billable", value: `${kpis.billable}%`, delta: 4 },
    {
      label: "Burnout risk",
      value: `${kpis.burnout}`,
      unit: kpis.burnout === 1 ? "person" : "people",
    },
    {
      label: "After-hours",
      value: `${kpis.afterHours}`,
      unit: kpis.afterHours === 1 ? "person" : "people",
    },
  ];

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-soft xl:col-span-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Sparkles className="size-4 text-primary" /> AI workforce health
      </div>

      <div className="flex items-center gap-5">
        <RadialScore value={kpis.score} color={band.color} />
        <div className="min-w-0">
          <p className={cn("font-heading text-lg font-semibold", band.text)}>
            {band.label}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            A blended read of engagement, wellbeing, and value delivered across
            your workforce.
          </p>
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
        {drivers.map((d) => (
          <div key={d.label} className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{d.label}</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-display text-lg font-semibold tabular-nums">
                {d.value}
              </span>
              {d.delta !== undefined ? (
                <DeltaPill value={d.delta} className="border-transparent px-1" />
              ) : d.unit ? (
                <span className="text-xs text-muted-foreground">{d.unit}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full-circle score ring — colour follows the health band. */
function RadialScore({ value, color }: { value: number; color: string }) {
  const size = 116;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circ * (1 - clamped / 100);
  const center = size / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-semibold tabular-nums leading-none">
          {Math.round(clamped)}
        </span>
        <span className="mt-0.5 text-[0.65rem] tracking-wide text-muted-foreground uppercase">
          / 100
        </span>
      </div>
    </div>
  );
}

/* ----------------------------- board view card ---------------------------- */

function ReportCard({
  report,
  canExport,
  selected,
  onToggleSelect,
  onOpen,
}: {
  report: ReportDef;
  canExport: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const Icon = CATEGORY_ICON[report.category];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group flex h-full cursor-pointer flex-col rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "border-primary/40 bg-primary/[0.04]" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {/* Wrapper isolates the checkbox so selecting never triggers the
              card's preview-on-click. */}
          <span
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              aria-label={`Select ${report.name}`}
            />
          </span>
          <span className="flex size-10 items-center justify-center rounded-xl bg-feature-tint text-primary">
            <Icon className="size-5" />
          </span>
        </div>
        <ExportMenu report={report} canExport={canExport} size="icon" />
      </div>

      <h3 className="mt-3 font-heading text-base font-semibold">
        {report.name}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {REPORT_CATEGORY_LABEL[report.category]} · {report.period}
      </p>
      <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
        {report.description}
      </p>

      {/* Mini preview — first 3 columns × 3 rows */}
      <div className="mt-4 overflow-hidden rounded-xl border">
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow>
              {report.columns.slice(0, 3).map((c) => (
                <TableHead key={c} className="h-8 text-xs">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.slice(0, 3).map((row, ri) => (
              <TableRow key={ri}>
                {row.slice(0, 3).map((cell, ci) => (
                  <TableCell key={ci} className="py-1.5 text-xs">
                    {String(cell)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>

      <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted-foreground">
        <span>
          {report.rows.length} rows · {report.columns.length} columns
        </span>
        <span className="font-medium text-primary transition-transform group-hover:translate-x-0.5">
          View report →
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ export menus ------------------------------ */

function ExportMenu({
  report,
  canExport,
  size = "icon-sm",
}: {
  report: ReportDef;
  canExport: boolean;
  size?: "icon" | "icon-sm";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size={size}
            disabled={!canExport}
            aria-label={`Download ${report.name}`}
            title="Download"
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <Download className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-auto min-w-44"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          className="whitespace-nowrap"
          onClick={() => exportCsv(report)}
        >
          <Sheet className="size-4" /> Download CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          className="whitespace-nowrap"
          onClick={() => exportPdf(report)}
        >
          <FileText className="size-4" /> Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DownloadAllButton({ canExport }: { canExport: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="lg" disabled={!canExport} className="gap-1.5" />}
      >
        <Download className="size-4" /> Download all
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onClick={() => exportAllPdf(REPORTS)}>
          <FileText className="size-4" /> Combined PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportSelectedCsv(REPORTS)}>
          <Sheet className="size-4" /> Combined CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SelectionBar({
  count,
  reports,
  canExport,
  onClear,
}: {
  count: number;
  reports: ReportDef[];
  canExport: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-1 pl-3 shadow-soft">
      <span className="text-sm font-medium">{count} selected</span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        aria-label="Clear selection"
      >
        <X className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="sm" disabled={!canExport} className="gap-1.5" />
          }
        >
          <Download className="size-4" /> Download
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => exportAllPdf(reports)}>
            <FileText className="size-4" /> Combined PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportSelectedCsv(reports)}>
            <Sheet className="size-4" /> Combined CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ------------------------------- empty state ------------------------------ */

function EmptyResults({
  query,
  onReset,
}: {
  query: string;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Search className="size-6" />
      </span>
      <h4 className="mt-4 font-heading text-base font-semibold">
        No reports found
      </h4>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Nothing matched “{query}”. Try a different search term.
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onReset}>
        Clear search
      </Button>
    </div>
  );
}

/* --------------------------- full report preview -------------------------- */

function ReportPreviewDialog({
  report,
  canExport,
  onClose,
}: {
  report: ReportDef | null;
  canExport: boolean;
  onClose: () => void;
}) {
  const Icon = report ? CATEGORY_ICON[report.category] : null;
  return (
    <Dialog open={!!report} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        {report ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                {Icon ? (
                  <span className="flex size-8 items-center justify-center rounded-lg bg-feature-tint text-primary">
                    <Icon className="size-4" />
                  </span>
                ) : null}
                {report.name}
              </DialogTitle>
              <DialogDescription>
                {REPORT_CATEGORY_LABEL[report.category]} · {report.period} ·{" "}
                {report.rows.length} rows · {report.columns.length} columns
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
              <table className="w-full caption-bottom text-sm">
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    {report.columns.map((c) => (
                      <TableHead key={c} className="whitespace-nowrap">
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, ri) => (
                    <TableRow key={ri}>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="whitespace-nowrap">
                          {String(cell)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </table>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                disabled={!canExport}
                onClick={() => exportCsv(report)}
              >
                <Sheet className="size-4" /> CSV
              </Button>
              <Button disabled={!canExport} onClick={() => exportPdf(report)}>
                <FileText className="size-4" /> PDF
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

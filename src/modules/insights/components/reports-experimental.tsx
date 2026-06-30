"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  ChevronDown,
  Clock,
  Download,
  FileText,
  FolderKanban,
  Gauge as GaugeIcon,
  LayoutGrid,
  List,
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Sparkline } from "@/components/shared/sparkline";
import { DeltaPill } from "@/components/shared/delta-pill";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { useAssistantStore } from "@/stores/assistant.store";
import { PeopleAttentionCard } from "./people-attention";
import {
  exportAllPdf,
  exportCsv,
  exportPdf,
  exportSelectedCsv,
} from "@/modules/insights/lib/report-export";
import {
  ACTIVITY_BY_DAY,
  ACTIVITY_BY_WEEK,
  ANOMALIES,
  EMPLOYEE_TIME,
  KEYBOARD_BY_DAY,
  MOUSE_BY_DAY,
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

/* ------------------------------- derivations ------------------------------ */

function numericColIndex(report: ReportDef): number {
  return report.columns.findIndex(
    (_, ci) =>
      report.rows.length > 0 && typeof report.rows[0]?.[ci] === "number",
  );
}

/** Small deterministic sparkline series from a report's first numeric column. */
function reportTrend(report: ReportDef, points = 12): number[] | undefined {
  const ci = numericColIndex(report);
  if (ci === -1) return undefined;
  const values = report.rows
    .map((r) => r[ci])
    .filter((v): v is number => typeof v === "number");
  if (values.length < 2) return undefined;
  if (values.length <= points) return values;
  const step = (values.length - 1) / (points - 1);
  return Array.from({ length: points }, (_, i) => values[Math.round(i * step)]);
}

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

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<ReportDef | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"list" | "board">("board");

  const searching = query.trim().length > 0;

  /* ----- executive metrics (real, derived data) ----- */
  const kpis = useMemo(() => {
    const avgUtil = mean(EMPLOYEE_TIME.map((e) => e.utilization));
    const avgProd = mean(EMPLOYEE_TIME.map((e) => e.productivity));
    const tracked = EMPLOYEE_TIME.reduce((a, e) => a + e.tracked, 0);
    const atRisk = PROJECT_HOURS.filter((p) => !p.onTrack).length;
    const atRiskPct = Math.round((atRisk / (PROJECT_HOURS.length || 1)) * 100);
    const highFlags = ANOMALIES.filter((a) => a.severity === "high").length;
    // Composite "health" — a weighted blend of the four drivers.
    const score = Math.round(
      0.4 * avgProd + 0.35 * avgUtil + 0.25 * (100 - atRiskPct),
    );
    return { avgUtil, avgProd, tracked, atRisk, atRiskPct, highFlags, score };
  }, []);

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

  const matchIds = useMemo(() => new Set(matches.map((r) => r.id)), [matches]);

  const groups = useMemo(
    () =>
      SMART_GROUPS.map((g) => ({
        ...g,
        reports: REPORTS.filter(
          (r) => g.categories.includes(r.category) && matchIds.has(r.id),
        ),
      })).filter((g) => g.reports.length > 0),
    [matchIds],
  );

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

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="wp-enter space-y-8">
      {/* ============================ COMMAND BAR ============================ */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Reports workspace
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your AI analyst has organized everything — read the brief, act on
            what matters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all reports…"
              aria-label="Search reports"
              className="h-9 w-full pl-8 lg:w-72"
            />
          </div>
          <DownloadAllButton canExport={canExport} />
        </div>
      </div>

      {/* ========================= EXECUTIVE OVERVIEW ======================== */}
      <section className="grid gap-4 xl:grid-cols-12">
        <AiBriefing
          empCount={EMPLOYEE_TIME.length}
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

      {/* ===================== ALL REPORTS — SMART GROUPS =================== */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionLabel icon={Search} title="All reports">
            {searching
              ? `${matches.length} ${matches.length === 1 ? "match" : "matches"} for “${query.trim()}”`
              : "Smart collections — every report, organized by purpose"}
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
            <ViewToggle view={view} onChange={setView} />
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

        {groups.length === 0 ? (
          <EmptyResults query={query.trim()} onReset={() => setQuery("")} />
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const open = searching || !collapsed.has(group.id);
              return (
                <div
                  key={group.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <button
                    type="button"
                    onClick={() => !searching && toggleGroup(group.id)}
                    aria-expanded={open}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                      !searching && "hover:bg-accent/30",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
                      <group.icon className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-heading text-sm font-semibold">
                          {group.title}
                        </h4>
                        <Badge variant="secondary" className="rounded-full">
                          {group.reports.length}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {group.blurb}
                      </p>
                    </div>
                    {!searching ? (
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    ) : null}
                  </button>
                  {open ? (
                    <div className="border-t border-border">
                      {view === "board" ? (
                        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                          {group.reports.map((report) => (
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
                      ) : (
                        group.reports.map((report, i) => (
                          <ReportRow
                            key={report.id}
                            report={report}
                            canExport={canExport}
                            selected={selected.has(report.id)}
                            onToggleSelect={() => toggleSelect(report.id)}
                            onOpen={() => setPreview(report)}
                            divider={i > 0}
                          />
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
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
    avgUtil: number;
    avgProd: number;
    tracked: number;
    atRisk: number;
    score: number;
  };
  band: { label: string; color: string; text: string };
}) {
  const drivers = [
    {
      label: "Utilization",
      value: `${kpis.avgUtil}%`,
      delta: 3,
      trend: ACTIVITY_BY_DAY,
    },
    {
      label: "Productivity",
      value: `${kpis.avgProd}%`,
      delta: 2,
      trend: MOUSE_BY_DAY,
    },
    {
      label: "Tracked hrs",
      value: kpis.tracked.toLocaleString(),
      delta: 5,
      trend: KEYBOARD_BY_DAY,
    },
    {
      label: "At-risk",
      value: `${kpis.atRisk}`,
      delta: -12,
      trend: ACTIVITY_BY_WEEK,
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
            A blended read of utilization, productivity, tracked time and project
            risk.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4">
        {drivers.map((d) => (
          <div key={d.label} className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{d.label}</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-display text-lg font-semibold tabular-nums">
                {d.value}
              </span>
              <DeltaPill value={d.delta} className="border-transparent px-1" />
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

/* -------------------------------- report row ------------------------------ */

function ReportRow({
  report,
  canExport,
  selected,
  onToggleSelect,
  onOpen,
  divider,
}: {
  report: ReportDef;
  canExport: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  divider: boolean;
}) {
  const Icon = CATEGORY_ICON[report.category];
  const trend = reportTrend(report, 12);
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
        "group flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/30 focus-visible:bg-accent/30 focus-visible:outline-none",
        divider && "border-t border-border",
        selected && "bg-primary/[0.04]",
      )}
    >
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

      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
        <Icon className="size-4.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-sm font-medium">{report.name}</h4>
          <Badge
            variant="outline"
            className="hidden shrink-0 rounded-full sm:inline-flex"
          >
            {report.period}
          </Badge>
        </div>
        <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
          {report.description}
        </p>
      </div>

      {trend ? (
        <div className="hidden w-20 shrink-0 text-primary md:block">
          <Sparkline data={trend} height={26} strokeWidth={1.75} />
        </div>
      ) : null}

      <div className="hidden shrink-0 text-right text-xs text-muted-foreground lg:block">
        <p className="tabular-nums">{report.rows.length} rows</p>
        <p className="tabular-nums">{report.columns.length} cols</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className="hidden text-sm font-medium text-primary transition-transform group-hover:translate-x-0.5 sm:inline">
          View →
        </span>
        <ExportMenu report={report} canExport={canExport} />
      </div>
    </div>
  );
}

/* ------------------------------- view toggle ------------------------------ */

function ViewToggle({
  view,
  onChange,
}: {
  view: "list" | "board";
  onChange: (v: "list" | "board") => void;
}) {
  const options = [
    { key: "list" as const, icon: List, label: "List" },
    { key: "board" as const, icon: LayoutGrid, label: "Board" },
  ];
  return (
    <div className="flex shrink-0 rounded-lg border border-border bg-card p-0.5">
      {options.map((o) => {
        const active = view === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icon className="size-4" />
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        );
      })}
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
        "group flex cursor-pointer flex-col rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
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
      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
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

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
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
        <Download className="size-4" /> Export all
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

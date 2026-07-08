"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Flag,
  Monitor,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker, TimePicker } from "@/components/ui/date-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { useDataScope } from "@/hooks/use-data-scope";
import { initials } from "@/lib/format";
import {
  SCREENSHOT_EMPLOYEES,
  dayLabel,
  type EmployeeShots,
  type Screenshot,
} from "@/lib/mock-insights";
import { cn } from "@/lib/utils";
import { AiReportCard } from "./ai-report-card";

/**
 * A capture is the SET of screenshots grabbed at one moment across all of a
 * machine's monitors — they share a timestamp and differ by `desktop` (monitor).
 */
interface Capture {
  key: string;
  date: string;
  time: string;
  /** One screenshot per monitor, ordered by monitor number. */
  monitors: Screenshot[];
  /** True if any monitor in the set was flagged. */
  flagged: boolean;
  /** Representative shot for the gallery tile (a flagged one if present). */
  cover: Screenshot;
}

/** Group a flat screenshot list into capture sets by (date, time). Preserves the
 *  input order (screenshots arrive newest-first, monitors consecutive). */
function groupCaptures(shots: Screenshot[]): Capture[] {
  const byKey = new Map<string, Screenshot[]>();
  for (const s of shots) {
    const key = `${s.date}|${s.time}`;
    const list = byKey.get(key);
    if (list) list.push(s);
    else byKey.set(key, [s]);
  }
  return [...byKey.values()].map((group) => {
    const monitors = [...group].sort((a, b) => a.desktop - b.desktop);
    const first = monitors[0];
    return {
      key: `${first.date}|${first.time}`,
      date: first.date,
      time: first.time,
      monitors,
      flagged: monitors.some((s) => s.flagged),
      cover: monitors.find((s) => s.flagged) ?? first,
    };
  });
}

function flagReason(shot: Screenshot): string | null {
  if (!shot.flagged) return null;
  if (shot.app === "YouTube" || shot.app === "Reddit")
    return `Distracting application (${shot.app})`;
  return `Low activity — ${shot.activity}% active`;
}

function activityTone(activity: number): string {
  if (activity >= 60) return "text-success";
  if (activity >= 40) return "text-warning";
  return "text-destructive";
}

/** Per-capture AI read — deterministic from the capture's app & activity. */
function aiAnalysis(shot: Screenshot): string {
  if (shot.flagged) {
    if (shot.app === "YouTube" || shot.app === "Reddit")
      return `Needs review: ${shot.app} is a distracting app, captured during core hours at only ${shot.activity}% activity.`;
    return `Needs review: low engagement — ${shot.activity}% active, the screen appears idle.`;
  }
  if (shot.activity >= 75)
    return `Focused work — ${shot.activity}% active in ${shot.app}, well above the team average.`;
  if (shot.activity >= 50)
    return `Steady activity — ${shot.activity}% active in ${shot.app}, in line with the team.`;
  return `Light activity — ${shot.activity}% active in ${shot.app}; likely a short break.`;
}

export function ScreenshotsTab() {
  const [selected, setSelected] = useState<EmployeeShots | null>(null);

  return selected ? (
    <EmployeeDetail employee={selected} onBack={() => setSelected(null)} />
  ) : (
    <Gallery onSelect={setSelected} />
  );
}

/* ----------------------------- Employee gallery ---------------------------- */

function Gallery({ onSelect }: { onSelect: (e: EmployeeShots) => void }) {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [flag, setFlag] = useState<"all" | "flagged">("all");
  const { inScope } = useDataScope();

  // Team leads only see their own team's monitored people; org roles see all.
  const scoped = SCREENSHOT_EMPLOYEES.filter((e) => inScope(e.user.id));

  const totalCaptures = scoped.reduce((a, e) => a + e.total, 0);
  const totalFlagged = scoped.reduce((a, e) => a + e.flagged, 0);
  const avgActivity = scoped.length
    ? Math.round(
        scoped.reduce((a, e) => a + e.avgActivity, 0) / scoped.length,
      )
    : 0;

  const departments = Array.from(
    new Set(scoped.map((e) => e.user.department)),
  ).sort();

  const q = query.trim().toLowerCase();
  const employees = scoped.filter(
    (e) =>
      (dept === "all" || e.user.department === dept) &&
      (flag === "all" || e.flagged > 0) &&
      (q === "" || e.user.name.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-5">
      <AiReportCard
        title="AI screenshot report"
        summary={`Across ${scoped.length} monitored ${
          scoped.length === 1 ? "employee" : "employees"
        }, ${totalCaptures.toLocaleString()} screenshots were captured. ${totalFlagged} ${
          totalFlagged === 1 ? "was" : "were"
        } marked for review for distracting apps or low activity${
          totalFlagged ? " — review those first" : ""
        }. Average on-screen activity sits at ${avgActivity}%.`}
        metrics={[
          { label: "Monitored", value: scoped.length },
          { label: "Screenshots", value: totalCaptures.toLocaleString() },
          { label: "Needs review", value: totalFlagged },
          { label: "Avg activity", value: `${avgActivity}%` },
        ]}
      />

      {/* Filters: search · department · flagged */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl bg-card px-5 py-3 shadow-soft">
        <Field label="Search">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Employee name…"
              className="w-56 pl-8"
            />
          </div>
        </Field>

        <Field label="Department">
          <Select value={dept} onValueChange={(v) => setDept(v as string)}>
            <SelectTrigger className="h-8 w-48" aria-label="Department">
              <SelectValue>
                {(v) =>
                  v == null || v === "all" ? "All departments" : String(v)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <fieldset className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Show</span>
          <div className="flex h-8 items-center gap-3">
            {(["all", "flagged"] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="emp-flag-filter"
                  className="size-4"
                  style={{ accentColor: "var(--primary)" }}
                  checked={flag === opt}
                  onChange={() => setFlag(opt)}
                />
                {opt === "all" ? "All" : "Needs review"}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{employees.length}</span> of{" "}
        {SCREENSHOT_EMPLOYEES.length} employees · select one to view their full
        screenshot history.
      </p>

      {employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees match"
          description="Try a different name, department, or clear the review filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employees.map((emp) => (
            <EmployeeCard key={emp.user.id} emp={emp} onOpen={() => onSelect(emp)} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmployeeCard({
  emp,
  onOpen,
}: {
  emp: EmployeeShots;
  onOpen: () => void;
}) {
  return (
    <Card
      className="group cursor-pointer gap-0 overflow-hidden p-0 transition hover:ring-1 hover:ring-primary/40"
      onClick={onOpen}
    >
      {/* Cover = latest capture */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <CaptureImage
          seed={emp.latest.id}
          alt={`${emp.user.name} — ${emp.latest.app}`}
        />
        <div className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
          {emp.latest.app}
        </div>
        {emp.flagged > 0 ? (
          <Badge className="absolute right-2 top-2 border-transparent bg-destructive text-white shadow-sm">
            <Flag className="size-3" /> {emp.flagged}
          </Badge>
        ) : null}
        <span className="absolute bottom-2 left-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
          {emp.total} shots · {emp.desktops.length} monitors
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar className="size-8">
          <AvatarImage src={emp.user.avatarUrl} alt={emp.user.name} />
          <AvatarFallback className="text-[10px]">
            {initials(emp.user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{emp.user.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {emp.user.department}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
      </div>
    </Card>
  );
}

/* ----------------------------- Employee detail ----------------------------- */

function EmployeeDetail({
  employee,
  onBack,
}: {
  employee: EmployeeShots;
  onBack: () => void;
}) {
  const [day, setDay] = useState<string>(""); // ISO date, "" = any
  const [from, setFrom] = useState<string>(""); // "HH:MM", "" = open start
  const [to, setTo] = useState<string>(""); // "HH:MM", "" = open end
  const [flag, setFlag] = useState<"all" | "flagged">("all");
  // Open capture (index into filtered `captures`) + which monitor within it.
  const [captureIdx, setCaptureIdx] = useState<number | null>(null);
  const [monitorIdx, setMonitorIdx] = useState(0);

  // Calendar bounds = the window this employee actually has captures in.
  const [minDate, maxDate] = useMemo(() => {
    const sorted = employee.shots.map((s) => s.date).sort();
    return [sorted[0], sorted[sorted.length - 1]];
  }, [employee]);

  // Group every screenshot into capture sets (one moment = all monitors), then
  // filter at the capture level so a set is kept or dropped as a whole.
  const allCaptures = useMemo(
    () => groupCaptures(employee.shots),
    [employee],
  );
  const captures = useMemo(
    () =>
      allCaptures.filter((c) => {
        if (day && c.date !== day) return false;
        if (from && c.time < from) return false;
        if (to && c.time > to) return false;
        if (flag === "flagged" && !c.flagged) return false;
        return true;
      }),
    [allCaptures, day, from, to, flag],
  );

  const flaggedCaptures = allCaptures.filter((c) => c.flagged).length;
  const openCapture = (i: number) => {
    setCaptureIdx(i);
    setMonitorIdx(0);
  };

  const dirty = day !== "" || from !== "" || to !== "" || flag !== "all";
  const reset = () => {
    setDay("");
    setFrom("");
    setTo("");
    setFlag("all");
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft className="size-4" /> All employees
      </Button>

      {/* Employee header */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-card px-5 py-4 shadow-soft">
        <Avatar className="size-12">
          <AvatarImage src={employee.user.avatarUrl} alt={employee.user.name} />
          <AvatarFallback>{initials(employee.user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold">
            {employee.user.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {employee.user.jobTitle} · {employee.user.department}
          </p>
        </div>
        <div className="flex gap-5 text-sm">
          <Summary label="Captures" value={allCaptures.length} />
          <Summary label="Monitors" value={employee.desktops.length} />
          <Summary
            label="Avg activity"
            value={`${employee.avgActivity}%`}
            tone={activityTone(employee.avgActivity)}
          />
          <Summary
            label="Needs review"
            value={flaggedCaptures}
            tone={flaggedCaptures > 0 ? "text-destructive" : undefined}
          />
        </div>
      </div>

      {/* Per-person AI report */}
      <AiReportCard
        title={`AI report — ${employee.user.name.split(" ")[0]}`}
        summary={`${employee.user.name.split(" ")[0]} has ${allCaptures.length} captures this period across ${employee.desktops.length} monitors on ${employee.device}, with activity averaging ${employee.avgActivity}%. ${
          flaggedCaptures > 0
            ? `${flaggedCaptures} were marked for review for distracting apps or low activity — review the highlighted captures below.`
            : "Nothing needs review — coverage and focus both look healthy."
        }`}
        signals={[
          { label: "Captures", value: `${allCaptures.length}`, tone: "flat" },
          {
            label: "Needs review",
            value: `${flaggedCaptures}`,
            tone: flaggedCaptures > 0 ? "down" : "up",
          },
          {
            label: "Avg activity",
            value: `${employee.avgActivity}%`,
            tone: employee.avgActivity >= 60 ? "up" : "down",
          },
        ]}
      />

      {/* Filters: calendar date · time range · flagged radio */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl bg-card px-5 py-3 shadow-soft">
        <Field label="Date">
          <DatePicker
            value={day}
            min={minDate}
            max={maxDate}
            onChange={setDay}
            className="w-[10.5rem]"
          />
        </Field>
        <Field label="From">
          <TimePicker value={from} onChange={setFrom} className="w-28" />
        </Field>
        <Field label="To">
          <TimePicker value={to} onChange={setTo} className="w-28" />
        </Field>

        <fieldset className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Show</span>
          <div className="flex h-8 items-center gap-3">
            {(["all", "flagged"] as const).map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-1.5 text-sm capitalize"
              >
                <input
                  type="radio"
                  name="flag-filter"
                  className="size-4"
                  style={{ accentColor: "var(--primary)" }}
                  checked={flag === opt}
                  onChange={() => setFlag(opt)}
                />
                {opt === "all" ? "All" : "Needs review"}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="ml-auto flex items-center gap-4">
          {dirty ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{captures.length}</span>{" "}
        captures · {employee.device} · {employee.desktops.length} monitors
      </p>

      {captures.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No captures in this range"
          description="Try a different month or date — “All” shows the full history."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {captures.map((capture, i) => (
            <CaptureCard
              key={capture.key}
              capture={capture}
              onOpen={() => openCapture(i)}
            />
          ))}
        </div>
      )}

      <Lightbox
        captures={captures}
        captureIndex={captureIdx}
        monitorIndex={monitorIdx}
        onCaptureChange={openCapture}
        onMonitorChange={setMonitorIdx}
        onClose={() => setCaptureIdx(null)}
      />
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="text-center">
      <p className={cn("font-display text-xl font-semibold tabular-nums", tone)}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/* ------------------------------- Shared bits ------------------------------- */

/** The faux capture surface (no real images in Phase 1). */
function FauxCapture() {
  return (
    <div
      className="flex h-full w-full flex-col gap-1.5 bg-gradient-to-br from-feature-tint to-muted p-3 transition"
      aria-hidden="true"
    >
      <div className="h-2 w-1/3 rounded-full bg-primary/30" />
      <div className="h-2 w-3/4 rounded-full bg-foreground/10" />
      <div className="h-2 w-2/3 rounded-full bg-foreground/10" />
      <div className="mt-auto flex gap-1.5">
        <div className="h-6 w-12 rounded-md bg-primary/25" />
        <div className="h-6 w-12 rounded-md bg-foreground/10" />
      </div>
    </div>
  );
}

/** Number of mock screenshots in public/screenshots (ss-1.png … ss-N.png). */
const CAPTURE_COUNT = 10;

/** Deterministic mock capture image — cycles through the local screenshot set
 *  in public/screenshots, keyed by id so each capture is stable. */
function captureUrl(seed: string): string {
  const hash = [...seed].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return `/screenshots/ss-${(hash % CAPTURE_COUNT) + 1}.png`;
}

/** A real screenshot image with the skeleton behind it as a load/offline
 *  fallback. Fills its (aspect-ratio) parent. */
function CaptureImage({ seed, alt }: { seed: string; alt: string }) {
  return (
    <>
      <FauxCapture />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={captureUrl(seed)}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
      />
    </>
  );
}

function CaptureCard({
  capture,
  onOpen,
}: {
  capture: Capture;
  onOpen: () => void;
}) {
  const { cover, monitors, flagged } = capture;
  const multi = monitors.length > 1;
  return (
    <Card
      className={cn(
        "group cursor-pointer gap-0 overflow-hidden p-0 transition",
        flagged
          ? "bg-destructive/5 ring-2 ring-destructive/60 ring-offset-1 ring-offset-background hover:ring-destructive/75"
          : "hover:ring-1 hover:ring-primary/40",
      )}
      onClick={onOpen}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        {/* Fanned edge to hint a multi-monitor set behind the cover */}
        {multi ? (
          <span className="absolute inset-x-2 top-1 bottom-2 rounded-md bg-foreground/15" />
        ) : null}
        <div className={cn("absolute inset-0", multi && "inset-x-0 bottom-0 top-1")}>
          <CaptureImage seed={cover.id} alt={`${cover.app} screenshot`} />
        </div>
        {flagged ? (
          <div className="pointer-events-none absolute inset-0 bg-destructive/10" />
        ) : null}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
          {cover.app}
        </div>
        {flagged ? (
          <Badge className="absolute right-2 top-2 border-transparent bg-destructive text-white shadow-sm">
            <Flag className="size-3" /> Needs review
          </Badge>
        ) : multi ? (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
            <Monitor className="size-3" /> {monitors.length} monitors
          </span>
        ) : null}
        <span className="absolute bottom-2 right-2 rounded-full bg-background/85 px-2 py-0.5 font-mono text-[11px] tabular-nums backdrop-blur-sm">
          {cover.activity}%
        </span>
      </div>

      <div
        className={cn(
          "flex items-center justify-between px-3 py-2.5 text-sm",
          flagged && "bg-destructive/10",
        )}
      >
        <span className="font-medium">{dayLabel(capture.date)}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {capture.time}
        </span>
      </div>
    </Card>
  );
}

/** One detail row (label + value) in the viewer's info panel. */
function PanelDetail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-white/45">
        {label}
      </dt>
      <dd className={cn("mt-1 font-medium break-words text-white", className)}>
        {value}
      </dd>
    </div>
  );
}

/**
 * Full-screen gallery viewer, split into two stacked sections so nothing sits
 * on top of the capture: the image fills its own pane on top (letterboxed,
 * object-contain), and all metadata + the per-capture AI read live in a distinct
 * section below it. Prev/next arrows reveal on hover (they otherwise cover the
 * image) — always shown on touch, and on ←/→ keys; both clamp at the first/last.
 */
function Lightbox({
  captures,
  captureIndex,
  monitorIndex,
  onCaptureChange,
  onMonitorChange,
  onClose,
}: {
  captures: Capture[];
  captureIndex: number | null;
  monitorIndex: number;
  onCaptureChange: (i: number) => void;
  onMonitorChange: (i: number) => void;
  onClose: () => void;
}) {
  const count = captures.length;
  const capture =
    captureIndex !== null ? (captures[captureIndex] ?? null) : null;
  const open = capture !== null;
  const monitors = capture?.monitors ?? [];
  const mIdx = Math.min(monitorIndex, Math.max(0, monitors.length - 1));
  const shot = capture ? (monitors[mIdx] ?? null) : null;

  const atStart = captureIndex === 0;
  const atEnd = captureIndex !== null && captureIndex === count - 1;

  const step = (delta: number) => {
    if (captureIndex === null) return;
    const next = captureIndex + delta;
    if (next < 0 || next >= count) return; // clamp at the ends, no wrap
    onCaptureChange(next);
  };

  // ←/→ move across captures (time); ↑/↓ switch monitors within a capture.
  useEffect(() => {
    if (!open || captureIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && captureIndex < count - 1)
        onCaptureChange(captureIndex + 1);
      else if (e.key === "ArrowLeft" && captureIndex > 0)
        onCaptureChange(captureIndex - 1);
      else if (e.key === "ArrowUp" && mIdx > 0) onMonitorChange(mIdx - 1);
      else if (e.key === "ArrowDown" && mIdx < monitors.length - 1)
        onMonitorChange(mIdx + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    open,
    captureIndex,
    count,
    mIdx,
    monitors.length,
    onCaptureChange,
    onMonitorChange,
  ]);

  const reason = shot ? flagReason(shot) : null;
  const multi = monitors.length > 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[100dvh] max-h-none w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-black p-0 ring-0 sm:max-w-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Screenshot viewer</DialogTitle>
          <DialogDescription>
            {shot ? `${shot.app} — ${shot.user.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {shot ? (
          <>
            {/* ── Image pane — its own section; only the capture ── */}
            <div className="group relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={captureUrl(shot.id)}
                alt={`${shot.app} screenshot`}
                className="max-h-full max-w-full object-contain"
              />

              {/* Close — small corner control */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                <X className="size-5" />
              </button>

              {/* Prev / next — hidden until the image is hovered (they otherwise
                  cover the capture); always shown on touch (no hover), revealed
                  on keyboard focus, and hidden at the first / last capture. */}
              {count > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={atStart}
                    aria-label="Previous screenshot"
                    className="absolute left-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white opacity-100 backdrop-blur-sm transition-opacity duration-200 hover:bg-white/25 focus-visible:opacity-100 disabled:pointer-events-none disabled:!opacity-0 sm:left-5 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={atEnd}
                    aria-label="Next screenshot"
                    className="absolute right-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white opacity-100 backdrop-blur-sm transition-opacity duration-200 hover:bg-white/25 focus-visible:opacity-100 disabled:pointer-events-none disabled:!opacity-0 sm:right-5 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                </>
              ) : null}

              {/* Monitor switcher — pick which screen of this capture set */}
              {multi ? (
                <div className="absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/10 p-1 backdrop-blur-sm">
                  {monitors.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onMonitorChange(i)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        i === mIdx
                          ? "bg-white text-black"
                          : "text-white/80 hover:bg-white/15",
                      )}
                    >
                      <Monitor className="size-3.5" />
                      {i + 1}
                      {m.flagged ? (
                        <Flag className="size-3 text-destructive" />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}

              <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium tabular-nums text-white/80 backdrop-blur-sm">
                Capture {(captureIndex ?? 0) + 1} / {count}
                {multi ? ` · Monitor ${mIdx + 1}/${monitors.length}` : ""}
              </span>
            </div>

            {/* ── Description — its own section, below the image ── */}
            <div className="max-h-[50vh] shrink-0 overflow-y-auto border-t border-white/10 bg-[#0d0e13]">
              <div className="mx-auto flex max-w-[100rem] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-10">
                {/* Member + details */}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-heading text-base font-semibold text-white">
                    <span className="truncate">{shot.user.name}</span>
                    {shot.flagged ? (
                      <Badge className="shrink-0 border-transparent bg-destructive text-white">
                        <Flag className="size-3" /> Review
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-white/55">
                    {shot.user.department} · {dayLabel(shot.date)} at {shot.time}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-2">
                    <PanelDetail label="Application" value={shot.app} />
                    <PanelDetail
                      label="Activity"
                      value={`${shot.activity}%`}
                      className={cn(
                        "font-mono tabular-nums",
                        shot.activity >= 60
                          ? "text-success"
                          : shot.activity >= 40
                            ? "text-warning"
                            : "text-destructive",
                      )}
                    />
                    <PanelDetail label="Device" value={shot.device} />
                    <PanelDetail
                      label="Monitor"
                      value={`${mIdx + 1} of ${monitors.length}`}
                    />
                    <PanelDetail
                      label="Captured"
                      value={`${dayLabel(shot.date)} · ${shot.time}`}
                    />
                    {reason ? (
                      <PanelDetail
                        label="Review reason"
                        value={reason}
                        className="text-destructive"
                      />
                    ) : null}
                  </dl>
                </div>

                {/* AI analysis */}
                <div className="flex gap-2.5 rounded-xl bg-white/[0.06] p-4 text-sm text-white ring-1 ring-white/10 lg:w-[32rem] lg:shrink-0">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="font-medium">AI analysis</p>
                    <p className="mt-1 text-white/75">{aiAnalysis(shot)}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

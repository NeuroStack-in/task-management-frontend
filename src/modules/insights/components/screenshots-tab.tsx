"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Flag,
  Maximize2,
  Search,
  Sparkles,
  Users,
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
          { label: "Total captures", value: totalCaptures.toLocaleString() },
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
          {emp.total} captures
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
  const [lightbox, setLightbox] = useState<Screenshot | null>(null);

  // Calendar bounds = the window this employee actually has captures in.
  const [minDate, maxDate] = useMemo(() => {
    const sorted = employee.shots.map((s) => s.date).sort();
    return [sorted[0], sorted[sorted.length - 1]];
  }, [employee]);

  const shots = useMemo(
    () =>
      employee.shots.filter((s) => {
        if (day && s.date !== day) return false;
        if (from && s.time < from) return false;
        if (to && s.time > to) return false;
        if (flag === "flagged" && !s.flagged) return false;
        return true;
      }),
    [employee, day, from, to, flag],
  );

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
          <Summary label="Captures" value={employee.total} />
          <Summary
            label="Avg activity"
            value={`${employee.avgActivity}%`}
            tone={activityTone(employee.avgActivity)}
          />
          <Summary
            label="Needs review"
            value={employee.flagged}
            tone={employee.flagged > 0 ? "text-destructive" : undefined}
          />
        </div>
      </div>

      {/* Per-person AI report */}
      <AiReportCard
        title={`AI report — ${employee.user.name.split(" ")[0]}`}
        summary={`${employee.user.name.split(" ")[0]} has ${employee.total} captures this period with activity averaging ${employee.avgActivity}%. ${
          employee.flagged > 0
            ? `${employee.flagged} were marked for review for distracting apps or low activity — review the highlighted captures below.`
            : "Nothing needs review — coverage and focus both look healthy."
        }`}
        signals={[
          { label: "Captures", value: `${employee.total}`, tone: "flat" },
          {
            label: "Needs review",
            value: `${employee.flagged}`,
            tone: employee.flagged > 0 ? "down" : "up",
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
        <span className="font-medium text-foreground">{shots.length}</span>{" "}
        captures
      </p>

      {shots.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No captures in this range"
          description="Try a different month or date — “All” shows the full history."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shots.map((shot) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              onOpen={() => setLightbox(shot)}
            />
          ))}
        </div>
      )}

      <Lightbox shot={lightbox} onClose={() => setLightbox(null)} />
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

function ShotCard({
  shot,
  onOpen,
}: {
  shot: Screenshot;
  onOpen: () => void;
}) {
  return (
    <Card
      className={cn(
        "group cursor-pointer gap-0 overflow-hidden p-0 transition",
        shot.flagged
          ? "bg-destructive/5 ring-2 ring-destructive/60 ring-offset-1 ring-offset-background hover:ring-destructive/75"
          : "hover:ring-1 hover:ring-primary/40",
      )}
      onClick={onOpen}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <CaptureImage seed={shot.id} alt={`${shot.app} screenshot`} />
        {shot.flagged ? (
          <div className="pointer-events-none absolute inset-0 bg-destructive/10" />
        ) : null}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
          {shot.app}
        </div>
        {shot.flagged ? (
          <Badge className="absolute right-2 top-2 border-transparent bg-destructive text-white shadow-sm">
            <Flag className="size-3" /> Needs review
          </Badge>
        ) : null}
        <span className="absolute bottom-2 right-2 rounded-full bg-background/85 px-2 py-0.5 font-mono text-[11px] tabular-nums backdrop-blur-sm">
          {shot.activity}%
        </span>
      </div>

      <div
        className={cn(
          "flex items-center justify-between px-3 py-2.5 text-sm",
          shot.flagged && "bg-destructive/10",
        )}
      >
        <span className="font-medium">{dayLabel(shot.date)}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {shot.time}
        </span>
      </div>
    </Card>
  );
}

function Lightbox({
  shot,
  onClose,
}: {
  shot: Screenshot | null;
  onClose: () => void;
}) {
  const reason = shot ? flagReason(shot) : null;
  const [full, setFull] = useState(false);
  return (
    <>
    <Dialog
      open={!!shot}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setFull(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {shot ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {shot.user.name}
                {shot.flagged ? (
                  <Badge variant="default">
                    <Flag className="size-3" /> Needs review
                  </Badge>
                ) : null}
              </DialogTitle>
              <DialogDescription>
                {shot.user.department} · {dayLabel(shot.date)} at {shot.time}
              </DialogDescription>
            </DialogHeader>

            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFull(true)}
              >
                <Maximize2 className="size-4" /> View full screenshot
              </Button>
            </div>

            {/* Full capture */}
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg border">
              <CaptureImage seed={shot.id} alt={`${shot.app} screenshot`} />
              <div className="absolute left-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
                {shot.app}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Application</dt>
              <dd className="text-right font-medium">{shot.app}</dd>
              <dt className="text-muted-foreground">Activity</dt>
              <dd
                className={cn(
                  "text-right font-mono font-medium tabular-nums",
                  activityTone(shot.activity),
                )}
              >
                {shot.activity}%
              </dd>
              <dt className="text-muted-foreground">Captured</dt>
              <dd className="text-right font-medium">
                {dayLabel(shot.date)} · {shot.time}
              </dd>
              {reason ? (
                <>
                  <dt className="text-muted-foreground">Review reason</dt>
                  <dd className="text-right font-medium text-destructive">
                    {reason}
                  </dd>
                </>
              ) : null}
            </dl>

            {/* Per-capture AI analysis */}
            <div className="flex gap-2 rounded-xl bg-feature-tint p-3 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-primary">AI analysis</p>
                <p className="mt-0.5 text-foreground/80">{aiAnalysis(shot)}</p>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>

    {/* Full-screen viewer — opens the capture large, in-app, with a close button */}
    <Dialog open={full} onOpenChange={setFull}>
      <DialogContent className="max-w-[96vw] border-0 bg-transparent p-0 shadow-none sm:max-w-5xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Full screenshot</DialogTitle>
          <DialogDescription>
            {shot ? `${shot.app} — ${shot.user.name}` : ""}
          </DialogDescription>
        </DialogHeader>
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={captureUrl(shot.id)}
            alt={`${shot.app} screenshot`}
            className="max-h-[85vh] w-full rounded-lg object-contain"
          />
        ) : null}
      </DialogContent>
    </Dialog>
    </>
  );
}

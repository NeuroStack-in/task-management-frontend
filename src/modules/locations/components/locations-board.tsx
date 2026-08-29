"use client";

import { useEffect, useMemo, useState } from "react";
import { DepartmentFilter } from "@/components/shared/department-filter";
import { AlertTriangle, ChevronLeft, ChevronRight, MapPin, MapPinOff, Navigation, Search, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { AiReportCard } from "@/modules/insights/components/ai-report-card";
import { ApiError } from "@/lib/api";
import {
  getLocationSummary,
  getOversightLocations,
  regenerateLocationSummary,
  type OversightPersonLocation,
} from "@/modules/insights/services/insights.service";
import { departmentMap } from "@/modules/employees/services/employees.service";
import { useDataScope } from "@/hooks/use-data-scope";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { useGeofenceStore } from "@/stores/geofence.store";
import { UNKNOWN_DEPARTMENT } from "@/lib/format";
import { deriveMode, deriveStatus, insidePerimeter, WORK_MODE_LABEL, type GeoPoint, type WorkMode } from "@/modules/locations/types";
import { cn } from "@/lib/utils";
import { LiveMap, type MapMarker } from "./live-map";
import { EmployeeLocationView } from "./employee-location";
import { UserAvatar } from "@/components/shared/user-avatar";

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days));
}
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
/** Human date label from an ISO `YYYY-MM-DD` string, TZ-safe (parsed as local Y/M/D). */
function dateLabel(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
/** Backend points are `{ lat, lon }`; the map wants `{ lat, lng }`. */
const toGeoPoint = (p: { lat: number; lon: number }): GeoPoint => ({
  lat: p.lat,
  lng: p.lon,
});

/**
 * Board ⇄ per-employee detail, mirroring the Screenshots drill-down.
 *
 * The **date is owned here**, not inside either child, so drilling into an employee keeps the day
 * the admin was looking at and coming back preserves it. Holding it in the board instead would reset
 * the detail view to today on every open — the wrong default when someone is investigating a
 * specific past day.
 */
export function LocationsView() {
  const [selected, setSelected] = useState<OversightPersonLocation | null>(null);
  const [date, setDate] = useState<string>("");
  useEffect(() => setDate(isoOf(new Date())), []);

  return selected ? (
    <EmployeeLocationView
      person={selected}
      date={date}
      onDateChange={setDate}
      onBack={() => setSelected(null)}
    />
  ) : (
    <LocationsBoard onSelect={setSelected} date={date} onDateChange={setDate} />
  );
}

/**
 * `online`/`offline` are derived from fix recency, `untracked` from having no fixes at all, and
 * `outside` from the perimeter — see `types.ts` for each definition. They are listed separately
 * because they answer different questions: "is she being tracked right now" vs "did we ever hear
 * from her today" vs "is she where she should be".
 */
const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "All status",
  online: "Online",
  offline: "Offline",
  untracked: "Untracked",
  located: "Located",
  "no-location": "No location",
  outside: "Outside perimeter",
};

type StatusFilter =
  | "all"
  | "online"
  | "offline"
  | "untracked"
  | "located"
  | "no-location"
  | "outside";

function LocationsBoard({
  onSelect,
  date,
  onDateChange: setDate,
}: {
  onSelect: (p: OversightPersonLocation) => void;
  date: string;
  onDateChange: (iso: string) => void;
}) {
  const { inScope, loading: scopeLoading } = useDataScope();

  const today = isoOf(new Date());
  const isToday = date === today;

  const [people, setPeople] = useState<OversightPersonLocation[] | null>(null);
  const [deptNames, setDeptNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [mode, setMode] = useState<"all" | WorkMode>("all");
  // Captured once per render pass so every row in one pass is judged against the same instant —
  // calling Date.now() per row could classify two people differently on the same tick.
  const now = Date.now();

  // Geofence ("location perimeter") — a client-side admin tool, shared via store.
  const {
    center: fenceCenter,
    radiusM,
    enabled: showFence,
    setCenter,
    setRadius,
    setEnabled,
    reset: resetFence,
    dirty: fenceDirty,
    saving: fenceSaving,
    error: fenceError,
    load: loadFence,
    save: saveFence,
  } = useGeofenceStore();
  const [editingFence, setEditingFence] = useState(false);

  // The perimeter is org-wide config, not per-date data, so it loads once — independent of the
  // date-scoped location fetch below.
  useEffect(() => {
    void loadFence();
  }, [loadFence]);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setLoading(true);
    setError(null);
    getOversightLocations(date)
      .then((d) => live && setPeople(d.people))
      .catch((e) => {
        if (!live) return;
        setPeople(null);
        setError(
          e instanceof ApiError && e.status === 403
            ? "You don't have access to the organization's location data."
            : "Couldn't load location data. It may not be available yet.",
        );
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [date]);

  // Department names are a best-effort label lookup; the board still works on ids if this fails.
  useEffect(() => {
    let live = true;
    departmentMap()
      .then((m) => live && setDeptNames(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const scoped = useMemo(
    () => (people ?? []).filter((p) => inScope(p.user_id)),
    [people, inScope],
  );

  const departments = useMemo(
    () => Array.from(new Set(scoped.map((p) => p.department_id))).sort(),
    [scoped],
  );
  const deptLabel = (id: string) =>
    deptNames.get(id) ?? (id ? UNKNOWN_DEPARTMENT : "");

  const fence = { center: fenceCenter, radiusM };
  const isOutside = (p: OversightPersonLocation) =>
    p.latest ? !insidePerimeter(toGeoPoint(p.latest), fence) : false;
  const flagOutside = (p: OversightPersonLocation) =>
    showFence && p.latest !== null && isOutside(p);

  const locatedCount = scoped.filter((p) => p.latest).length;
  const outsideCount = scoped.filter(flagOutside).length;

  // On-site / off-site are only meaningful once an office perimeter is set (the geofence toggle).
  // Without one we don't invent a number — the AI hero tiles read an honest note instead.
  const onSiteCount = showFence ? locatedCount - outsideCount : null;
  const offSiteCount = showFence ? outsideCount : null;

  // Publish the location board's day + counts to the assistant.
  useAssistantPageContext({
    date: date || null,
    facts: [
      { label: "People", value: String(scoped.length) },
      { label: "Located (have a fix)", value: String(locatedCount) },
      ...(showFence && onSiteCount !== null && offSiteCount !== null
        ? [
            { label: "On-site", value: String(onSiteCount) },
            { label: "Off-site", value: String(offSiteCount) },
          ]
        : []),
      ...(dept !== "all" ? [{ label: "Department filter", value: deptLabel(dept) }] : []),
      ...(query.trim() ? [{ label: "Search", value: query.trim() }] : []),
    ],
  });

  const label = dateLabel(date);

  /**
   * The day's AI narrative (`insights::location_summary`).
   *
   * This card was titled "AI location report" while the sentence under it was assembled from a
   * template string in this file — a surface labelled AI that never called a model. It calls one
   * now, over figures the server computes from the same reach-narrowed read the map plots, so the
   * two cannot disagree.
   *
   * A failure keeps the card usable rather than blanking it: the local recap below is the same
   * facts in our own words, so the page still answers the question when the model doesn't.
   */
  const localRecap =
    scoped.length === 0
      ? `No employees in view for ${label}.`
      : showFence
        ? `${locatedCount} of ${scoped.length} employees located on ${label}; ${onSiteCount} on-site, ${offSiteCount} off-site.`
        : `${locatedCount} of ${scoped.length} employees located on ${label}. Set an office location to see on-site vs off-site.`;

  /** The department's display name for the narrative — undefined for the org-wide view. */
  const deptAiLabel = dept === "all" ? undefined : deptLabel(dept);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setAiLoading(true);
    setAiNarrative(null);
      // Re-fetches on a department change as well as a date change: the board's counts already
      // follow the filter, and the narrative used to describe the whole org beside them.
      getLocationSummary({ date, department: dept, label: deptAiLabel })
      .then((s) => live && setAiNarrative(s.narrative))
      .catch(() => live && setAiNarrative(null))
      .finally(() => live && setAiLoading(false));
    return () => {
      live = false;
    };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date, dept, deptAiLabel]);

  async function regenerateAi() {
    if (regenerating || !date) return;
    setRegenerating(true);
    try {
      const s = await regenerateLocationSummary({
        date,
        department: dept,
        label: deptAiLabel,
      });
      setAiNarrative(s.narrative);
    } catch {
      /* keep what's on screen — a failed re-run must not blank the card */
    } finally {
      setRegenerating(false);
    }
  }

  const aiSummary = aiLoading && !aiNarrative
    ? "Reading the day's locations…"
    : aiNarrative || localRecap;

  const q = query.trim().toLowerCase();
  const matchesStatus = (p: OversightPersonLocation) => {
    if (status === "all") return true;
    if (status === "located") return p.latest !== null;
    if (status === "no-location") return p.latest === null;
    if (status === "outside") return flagOutside(p);
    return deriveStatus(p.latest?.captured_at ?? null, p.fix_count, now) === status;
  };

  // Mode is derived from the perimeter, so with the fence off nothing has a mode and the filter
  // would silently empty the board. Treat it as inactive instead.
  const matchesMode = (p: OversightPersonLocation) => {
    if (mode === "all" || !showFence) return true;
    return deriveMode(p.latest ? toGeoPoint(p.latest) : null, fence, showFence) === mode;
  };
  const employees = useMemo(
    () =>
      scoped.filter(
        (p) =>
          (dept === "all" || p.department_id === dept) &&
          matchesStatus(p) &&
          matchesMode(p) &&
          (q === "" || p.name.toLowerCase().includes(q)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, dept, status, mode, q, radiusM, fenceCenter, showFence, now],
  );

  const mapMarkers: MapMarker[] = useMemo(
    () =>
      employees
        .filter((p) => p.latest)
        .map((p) => ({
          id: p.user_id,
          point: toGeoPoint(p.latest!),
          variant: "avatar" as const,
          name: `${p.name}${flagOutside(p) ? " · outside perimeter" : ""}`,
          online: isToday,
          alert: flagOutside(p),
          onClick: () => onSelect(p),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, showFence, radiusM, fenceCenter, onSelect, isToday],
  );

  if (loading || scopeLoading) return <Loader />;

  if (error) {
    return (
      <EmptyState
        icon={MapPinOff}
        title="Location data unavailable"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* AI location report — a factual recap over the day's real fixes + the office perimeter. */}
      <AiReportCard
        title="AI location report"
        summary={aiSummary}
        // Only once a real narrative exists: with the local recap showing there is nothing to
        // re-run, and each press is a fresh billed generation.
        onRegenerate={aiNarrative ? regenerateAi : undefined}
        regenerating={regenerating}
        metrics={[
          { label: "Employees", value: scoped.length },
          {
            label: isToday ? "Located today" : "Located",
            value: locatedCount,
            hint: isToday ? "last seen" : undefined,
          },
          showFence
            ? { label: "On-site", value: onSiteCount ?? 0 }
            : { label: "On-site", value: "—", hint: "set office location" },
          showFence
            ? { label: "Off-site", value: offSiteCount ?? 0 }
            : { label: "Off-site", value: "—", hint: "set office location" },
          { label: "No location", value: scoped.length - locatedCount },
        ]}
      />

      {/* Live map */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {isToday ? "Live map · latest positions" : `${label} · locations`}
              </p>
              <p className="text-xs text-muted-foreground">
                {mapMarkers.length} {mapMarkers.length === 1 ? "person" : "people"}{" "}
                on the map
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Date stepper */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Previous day"
                  onClick={() => setDate(shiftIso(date, -1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <DatePicker
                  value={date}
                  max={today}
                  onChange={(v) => v && setDate(v)}
                  className="w-40"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Next day"
                  disabled={isToday}
                  onClick={() => setDate(shiftIso(date, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <DepartmentFilter
                value={dept}
                onChange={setDept}
                options={departments.map((d) => ({ value: d, label: d }))}
                ariaLabel="Filter locations by department"
              />

              <Select
                value={status}
                onValueChange={(v) => setStatus(v as StatusFilter)}
              >
                <SelectTrigger className="h-8 w-44" aria-label="Status">
                  <SelectValue>
                    {(v) =>
                      STATUS_LABEL[v as StatusFilter] ?? "All status"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="untracked">Untracked</SelectItem>
                  <SelectItem value="located">Located</SelectItem>
                  <SelectItem value="no-location">No location</SelectItem>
                  <SelectItem value="outside">Outside perimeter</SelectItem>
                </SelectContent>
              </Select>

              {/*
                Mode is *derived from the perimeter*, not a declared work arrangement — WorkPulse has
                no such field (owner decision, 2026-07-22). With the fence switched off there is
                nothing to derive from, so the control is disabled rather than left to silently empty
                the board.
              */}
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as "all" | WorkMode)}
                disabled={!showFence}
              >
                <SelectTrigger
                  className="h-8 w-36"
                  aria-label="Work mode"
                  title={
                    showFence
                      ? "Derived from the office perimeter"
                      : "Set an office perimeter to filter by mode"
                  }
                >
                  <SelectValue>
                    {(v) =>
                      v === "in-office" || v === "remote"
                        ? WORK_MODE_LABEL[v as WorkMode]
                        : "All modes"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modes</SelectItem>
                  <SelectItem value="in-office">In office</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <LiveMap
            markers={mapMarkers}
            geofence={showFence ? fence : null}
            editableCenter={showFence && editingFence}
            onCenterChange={setCenter}
            center={fenceCenter}
            zoom={13}
            recenterKey="board"
          />

          {/* Perimeter control */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <label className="flex items-center gap-1.5 font-medium">
              <input
                type="checkbox"
                checked={showFence}
                onChange={(e) => setEnabled(e.target.checked)}
                className="size-3.5"
                style={{ accentColor: "var(--primary)" }}
              />
              Office perimeter
            </label>
            {showFence ? (
              <>
                <input
                  type="range"
                  min={100}
                  max={2000}
                  step={50}
                  value={radiusM}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-40"
                  style={{ accentColor: "var(--primary)" }}
                  aria-label="Perimeter radius"
                />
                <span className="tabular-nums text-muted-foreground">
                  {radiusM} m radius
                </span>
                <span
                  className={cn(
                    outsideCount > 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  · {outsideCount} outside
                </span>
                <Button
                  variant={editingFence ? "default" : "outline"}
                  size="sm"
                  className="h-7"
                  onClick={() => setEditingFence((v) => !v)}
                >
                  {editingFence ? "Done" : "Move office"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={resetFence}
                >
                  Reset
                </Button>
                {/*
                  Saving is explicit and only offered when something actually changed. The perimeter
                  is org-wide, so an accidental autosave would move every colleague's inside/outside
                  status; and without the dirty check there is no way to tell a dragged-but-unsaved
                  fence from the saved one.
                */}
                {fenceDirty ? (
                  <Button
                    size="sm"
                    className="h-7"
                    disabled={fenceSaving}
                    onClick={() => {
                      void saveFence().then((ok) => ok && setEditingFence(false));
                    }}
                  >
                    {fenceSaving ? "Saving…" : "Save perimeter"}
                  </Button>
                ) : null}
                {fenceError ? (
                  <span className="text-destructive">{fenceError}</span>
                ) : null}
              </>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            Positions are the latest device fix the desktop agent reported that
            day (consent-gated). The office perimeter is a review aid — a red ring
            marks a fix outside it.
          </p>
        </CardContent>
      </Card>

      {/* Count + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{employees.length}</span>{" "}
          of {scoped.length} employees
        </p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employee…"
            className="h-9 w-64 pl-8"
          />
        </div>
      </div>

      {status === "outside" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              Employees outside the office perimeter
            </p>
            <p className="mt-0.5 text-muted-foreground">
              These employees&apos; latest fix is beyond the {radiusM} m office
              perimeter for this day.
            </p>
          </div>
        </div>
      ) : null}

      {employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            scoped.length === 0
              ? "No location data for this day"
              : "No employees match"
          }
          description={
            scoped.length === 0
              ? "Needs the desktop agent's consented location reporting — positions appear once the agent is installed and consent is granted."
              : "Try a different name, department, or status."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employees.map((p) => {
            const located = p.latest !== null;
            const outside = flagOutside(p);
            return (
              <button
                key={p.user_id}
                type="button"
                onClick={() => onSelect(p)}
                className="group flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition hover:ring-1 hover:ring-primary/40"
              >
                <UserAvatar
                  userId={p.user_id}
                  name={p.name}
                  className="size-10"
                  fallbackClassName="text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  {outside ? (
                    <p className="flex items-center gap-1 truncate text-xs text-destructive">
                      <AlertTriangle className="size-3 shrink-0" />
                      <span className="truncate">
                        Outside perimeter · {clock(p.latest!.captured_at)}
                      </span>
                    </p>
                  ) : located ? (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Navigation className="size-3 shrink-0 text-primary" />
                      <span className="truncate">
                        Last seen {clock(p.latest!.captured_at)} · {p.fix_count}{" "}
                        {p.fix_count === 1 ? "location" : "locations"}
                      </span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPinOff className="size-3 shrink-0" />
                      <span className="truncate">No location reported</span>
                    </p>
                  )}
                </div>
                <Badge
                  className={cn(
                    "gap-1 border-transparent",
                    located
                      ? "bg-success/12 text-success"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <MapPin className="size-3" />
                  {located ? "Located" : "—"}
                </Badge>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

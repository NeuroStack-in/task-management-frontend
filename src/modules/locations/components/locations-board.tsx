"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MapPinOff,
  Navigation,
  Search,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import {
  getOversightLocations,
  type OversightPersonLocation,
} from "@/modules/insights/services/insights.service";
import { departmentMap } from "@/modules/employees/services/employees.service";
import { useDataScope } from "@/hooks/use-data-scope";
import { useGeofenceStore } from "@/stores/geofence.store";
import { initials } from "@/lib/format";
import { insidePerimeter, type GeoPoint } from "@/modules/locations/types";
import { cn } from "@/lib/utils";
import { LiveMap, type MapMarker } from "./live-map";
import { EmployeeLocationView } from "./employee-location";

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
/** Backend points are `{ lat, lon }`; the map wants `{ lat, lng }`. */
const toGeoPoint = (p: { lat: number; lon: number }): GeoPoint => ({
  lat: p.lat,
  lng: p.lon,
});

/** Board ⇄ per-employee detail, mirroring the Screenshots drill-down. */
export function LocationsView() {
  const [selected, setSelected] = useState<OversightPersonLocation | null>(null);

  return selected ? (
    <EmployeeLocationView person={selected} onBack={() => setSelected(null)} />
  ) : (
    <LocationsBoard onSelect={setSelected} />
  );
}

type StatusFilter = "all" | "located" | "no-location" | "outside";

function LocationsBoard({
  onSelect,
}: {
  onSelect: (p: OversightPersonLocation) => void;
}) {
  const { inScope, loading: scopeLoading } = useDataScope();

  const [date, setDate] = useState<string>("");
  useEffect(() => setDate(isoOf(new Date())), []);
  const today = isoOf(new Date());
  const isToday = date === today;

  const [people, setPeople] = useState<OversightPersonLocation[] | null>(null);
  const [deptNames, setDeptNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  // Geofence ("location perimeter") — a client-side admin tool, shared via store.
  const {
    center: fenceCenter,
    radiusM,
    enabled: showFence,
    setCenter,
    setRadius,
    setEnabled,
    reset: resetFence,
  } = useGeofenceStore();
  const [editingFence, setEditingFence] = useState(false);

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
  const deptLabel = (id: string) => deptNames.get(id) ?? id;

  const fence = { center: fenceCenter, radiusM };
  const isOutside = (p: OversightPersonLocation) =>
    p.latest ? !insidePerimeter(toGeoPoint(p.latest), fence) : false;
  const flagOutside = (p: OversightPersonLocation) =>
    showFence && p.latest !== null && isOutside(p);

  const locatedCount = scoped.filter((p) => p.latest).length;
  const outsideCount = scoped.filter(flagOutside).length;

  const q = query.trim().toLowerCase();
  const matchesStatus = (p: OversightPersonLocation) => {
    if (status === "all") return true;
    if (status === "located") return p.latest !== null;
    if (status === "no-location") return p.latest === null;
    return flagOutside(p); // "outside"
  };
  const employees = useMemo(
    () =>
      scoped.filter(
        (p) =>
          (dept === "all" || p.department_id === dept) &&
          matchesStatus(p) &&
          (q === "" || p.name.toLowerCase().includes(q)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, dept, status, q, radiusM, fenceCenter, showFence],
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
      {/* Summary */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Stat label="Employees" value={scoped.length} />
          <Stat
            label={isToday ? "Located today" : "Located"}
            value={locatedCount}
          />
          <Stat label="No location" value={scoped.length - locatedCount} />
          <Stat
            label="Outside perimeter"
            value={showFence ? outsideCount : 0}
            muted={!showFence}
          />
        </CardContent>
      </Card>

      {/* Live map */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {isToday ? "Latest positions" : `Positions · ${date}`}
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
                  onClick={() => setDate((d) => shiftIso(d, -1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Input
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="h-8 w-40"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="Next day"
                  disabled={isToday}
                  onClick={() => setDate((d) => shiftIso(d, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <Select value={dept} onValueChange={(v) => setDept(v as string)}>
                <SelectTrigger className="h-8 w-44" aria-label="Department">
                  <SelectValue>
                    {(v) =>
                      v == null || v === "all"
                        ? "All departments"
                        : deptLabel(String(v))
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {deptLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={status}
                onValueChange={(v) => setStatus(v as StatusFilter)}
              >
                <SelectTrigger className="h-8 w-44" aria-label="Status">
                  <SelectValue>
                    {(v) =>
                      v === "located"
                        ? "Located"
                        : v === "no-location"
                          ? "No location"
                          : v === "outside"
                            ? "Outside perimeter"
                            : "All status"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="located">Located</SelectItem>
                  <SelectItem value="no-location">No location</SelectItem>
                  <SelectItem value="outside">Outside perimeter</SelectItem>
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
                  onClick={() => {
                    resetFence();
                    setEditingFence(false);
                  }}
                >
                  Reset
                </Button>
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

      {employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            scoped.length === 0
              ? "No location data yet"
              : "No employees match"
          }
          description={
            scoped.length === 0
              ? "No employee has reported a location for this day. Positions appear once the desktop agent is installed and consent is granted."
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
                <Avatar className="size-10">
                  <AvatarFallback className="text-xs">
                    {initials(p.name)}
                  </AvatarFallback>
                </Avatar>
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
                        {p.fix_count === 1 ? "fix" : "fixes"}
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
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          muted && "text-muted-foreground",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

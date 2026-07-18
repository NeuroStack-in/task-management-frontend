"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  House,
  MapPin,
  MapPinOff,
  Navigation,
  Search,
  Users,
} from "lucide-react";
import type { User } from "@/types/user";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { AiReportCard } from "@/modules/insights/components/ai-report-card";
import { useDataScope } from "@/hooks/use-data-scope";
import { initials } from "@/lib/format";
import {
  LOCATION_EMPLOYEES,
  allLocationsForDate,
  dateLabel,
  insidePerimeter,
  WORK_MODE_LABEL,
  type WorkMode,
} from "@/lib/mock-locations";
import { TODAY } from "@/modules/attendance/lib/calendar";
import { useGeofenceStore } from "@/stores/geofence.store";
import { Button } from "@/components/ui/button";
import { LogDatePicker } from "@/modules/attendance/components/attendance-log";
import { LiveMap, type MapMarker } from "./live-map";
import { EmployeeLocationView } from "./employee-location";
import { cn } from "@/lib/utils";

/** Board ⇄ per-employee detail, mirroring the Screenshots drill-down. */
export function LocationsView() {
  const { inScope } = useDataScope();
  const [selected, setSelected] = useState<User | null>(null);

  // Deep-link support: /insights/locations?emp=<id> opens that employee directly
  // (e.g. the "Location" button on the employee profile). Scope-checked.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("emp");
    if (!id || !inScope(id)) return;
    const match = LOCATION_EMPLOYEES.find((e) => e.user.id === id)?.user;
    if (match) setSelected(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return selected ? (
    <EmployeeLocationView user={selected} onBack={() => setSelected(null)} />
  ) : (
    <LocationsBoard onSelect={setSelected} />
  );
}

function LocationsBoard({ onSelect }: { onSelect: (u: User) => void }) {
  const { inScope } = useDataScope();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState<
    "all" | "online" | "offline" | "untracked" | "outside"
  >("all");
  const [mode, setMode] = useState<"all" | WorkMode>("all");
  // Geofence ("location perimeter") — admin-configurable, shared via store.
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
  const [date, setDate] = useState({ ...TODAY });
  const isToday =
    date.year === TODAY.year &&
    date.month === TODAY.month &&
    date.day === TODAY.day;

  // Team leads see only their team; org roles see everyone. Data follows the
  // picked day (today = live snapshot; a past day = that day's recorded fixes).
  const scoped = useMemo(
    () =>
      allLocationsForDate(date.year, date.month, date.day).filter((e) =>
        inScope(e.user.id),
      ),
    [date, inScope],
  );

  const departments = useMemo(
    () => Array.from(new Set(scoped.map((e) => e.user.department))).sort(),
    [scoped],
  );

  // "Located" = has a recorded position for the day (online today, or present on
  // a past day). This is what the map plots and the headline counts describe.
  const located = scoped.filter((e) => e.current);
  const locatedCount = located.length;
  const remoteLocated = located.filter((e) => e.mode === "remote").length;
  const officeLocated = locatedCount - remoteLocated;
  const noGpsCount = scoped.filter((e) => !e.gpsCapable).length;

  // Geofence perimeter check — one pure function (insidePerimeter) that a server
  // (PostGIS ST_DWithin / Turf) would replace unchanged.
  const fence = { center: fenceCenter, radiusM };
  const isInside = (e: (typeof scoped)[number]) =>
    e.current ? insidePerimeter(e.current.point, fence) : null;
  // A perimeter "violation" = an IN-OFFICE employee physically outside the office
  // fence. Remote employees are away by design, so they're never flagged.
  const flagOutside = (e: (typeof scoped)[number]) =>
    showFence && e.mode === "in-office" && isInside(e) === false;
  const outsideCount = located.filter(flagOutside).length;

  const q = query.trim().toLowerCase();
  const matchesStatus = (e: (typeof scoped)[number]) => {
    if (status === "all") return true;
    if (status === "online") return e.status === "online";
    if (status === "untracked") return e.offlineReason === "no-gps";
    if (status === "outside") return flagOutside(e);
    // "offline" = not online and NOT the no-GPS case (leave / absent)
    return e.status === "offline" && e.offlineReason !== "no-gps";
  };
  const employees = useMemo(
    () =>
      scoped.filter(
        (e) =>
          (dept === "all" || e.user.department === dept) &&
          matchesStatus(e) &&
          (mode === "all" || e.mode === mode) &&
          (q === "" || e.user.name.toLowerCase().includes(q)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, dept, status, mode, q, radiusM, fenceCenter],
  );

  // Avatar markers mirror the filtered list (only located, online people show);
  // those outside the perimeter get a red alert ring.
  const mapMarkers: MapMarker[] = useMemo(
    () =>
      employees
        .filter((e) => e.current)
        .map((e) => ({
          id: e.user.id,
          point: e.current!.point,
          variant: "avatar" as const,
          avatarUrl: e.user.avatarUrl,
          name: `${e.user.name} · ${e.current!.area}${
            flagOutside(e) ? " · outside office" : ""
          }`,
          online: e.status === "online",
          alert: flagOutside(e),
          onClick: () => onSelect(e.user),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, showFence, radiusM, fenceCenter, onSelect],
  );

  return (
    <div className="space-y-5">
      <AiReportCard
        title="AI location report"
        summary={
          isToday
            ? `${locatedCount} of ${scoped.length} monitored employees are online now — ${officeLocated} in office and ${remoteLocated} remote (work from home). ${outsideCount} in-office ${outsideCount === 1 ? "employee is" : "employees are"} outside the office perimeter.`
            : `On ${dateLabel(date)}, ${locatedCount} of ${scoped.length} monitored employees had a recorded location — ${officeLocated} in office and ${remoteLocated} remote. ${outsideCount} in-office ${outsideCount === 1 ? "was" : "were"} outside the office perimeter that day.`
        }
        metrics={[
          { label: "Monitored", value: scoped.length },
          {
            label: isToday ? "Online now" : "Present",
            value: locatedCount,
            hint: isToday ? "live" : undefined,
          },
          { label: "In office", value: officeLocated },
          { label: "Remote", value: remoteLocated },
          { label: "No GPS", value: noGpsCount },
          { label: "Outside perimeter", value: outsideCount },
        ]}
      />

      {/* Live map */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {isToday
                  ? "Live map · online now"
                  : `${dateLabel(date)} · locations`}
              </p>
              <p className="text-xs text-muted-foreground">
                {mapMarkers.length}{" "}
                {mapMarkers.length === 1 ? "person" : "people"} on the map
              </p>
            </div>
            {/* Unified filters — drive the map and the list below, live. */}
            <div className="flex flex-wrap items-center gap-2">
              <LogDatePicker value={date} onChange={setDate} />
              {!isToday ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setDate({ ...TODAY })}
                >
                  Today
                </Button>
              ) : null}
              <Select value={dept} onValueChange={(v) => setDept(v as string)}>
                <SelectTrigger className="h-8 w-44" aria-label="Department">
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

              <Select
                value={status}
                onValueChange={(v) =>
                  setStatus(
                    v as
                      | "all"
                      | "online"
                      | "offline"
                      | "untracked"
                      | "outside",
                  )
                }
              >
                <SelectTrigger className="h-8 w-44" aria-label="Status">
                  <SelectValue>
                    {(v) =>
                      v === "online"
                        ? "Online"
                        : v === "offline"
                          ? "Offline"
                          : v === "untracked"
                            ? "Location not tracked"
                            : v === "outside"
                              ? "Outside perimeter"
                              : "All status"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="outside">Outside perimeter</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="untracked">Location not tracked</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={mode}
                onValueChange={(v) => setMode(v as "all" | WorkMode)}
              >
                <SelectTrigger className="h-8 w-36" aria-label="Mode">
                  <SelectValue>
                    {(v) =>
                      v === "in-office"
                        ? "In office"
                        : v === "remote"
                          ? "Remote"
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
            zoom={15}
            recenterKey="board"
          />

          {/* Perimeter "fixing" control */}
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
                  max={1000}
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
                    outsideCount > 0 ? "text-destructive" : "text-muted-foreground",
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
                <span className="tabular-nums text-muted-foreground">
                  {fenceCenter.lat.toFixed(4)}, {fenceCenter.lng.toFixed(4)}
                </span>
              </>
            ) : null}
          </div>

          {editingFence ? (
            <p className="text-xs text-primary">
              Click anywhere on the map, or drag the 🏢 pin, to set the office
              location. Click <span className="font-medium">Done</span> when
              finished.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Simulated location data (Phase 1) · red ring = outside the office
              perimeter · tap an employee to open their trail.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Count + inline search — dept / status / mode live in the map header. */}
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

      {status === "untracked" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              These employees&apos; locations can&apos;t be tracked
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Their device has no built-in GPS, so no location is available. The
              device model is shown on each card.
            </p>
          </div>
        </div>
      ) : null}

      {status === "outside" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              Employees outside the office perimeter
            </p>
            <p className="mt-0.5 text-muted-foreground">
              These online employees are located beyond the {radiusM} m office
              geofence. In a live system this would flag attendance for review.
            </p>
          </div>
        </div>
      ) : null}

      {employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees match"
          description="Try a different name, department, status, or mode."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employees.map((e) => {
            const online = e.status === "online";
            const noGps = e.offlineReason === "no-gps";
            const outside = flagOutside(e);
            return (
              <button
                key={e.user.id}
                type="button"
                onClick={() => onSelect(e.user)}
                className="group flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition hover:ring-1 hover:ring-primary/40"
              >
                <Avatar className="size-10">
                  <AvatarImage src={e.user.avatarUrl} alt={e.user.name} />
                  <AvatarFallback className="text-xs">
                    {initials(e.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.user.name}</p>
                  {noGps ? (
                    <p className="flex items-center gap-1 truncate text-xs text-warning">
                      <MapPinOff className="size-3 shrink-0" />
                      <span className="truncate">No GPS · {e.device}</span>
                    </p>
                  ) : outside ? (
                    <p className="flex items-center gap-1 truncate text-xs text-destructive">
                      <AlertTriangle className="size-3 shrink-0" />
                      <span className="truncate">
                        Outside office · {e.current?.area} · {e.current?.time}
                      </span>
                    </p>
                  ) : (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {e.mode === "remote" ? (
                        <House className="size-3 shrink-0" />
                      ) : (
                        <Building2 className="size-3 shrink-0" />
                      )}
                      <span className="shrink-0">{WORK_MODE_LABEL[e.mode]}</span>
                      <span aria-hidden>·</span>
                      {online ? (
                        <Navigation className="size-3 shrink-0 text-primary" />
                      ) : (
                        <MapPin className="size-3 shrink-0" />
                      )}
                      <span className="truncate">
                        {e.current
                          ? `${e.current.area} · ${e.current.time}`
                          : e.offlineReason === "on-leave"
                            ? "On leave"
                            : "Offline"}
                      </span>
                    </p>
                  )}
                </div>
                {noGps ? (
                  <Badge className="gap-1 border-transparent bg-warning/15 text-warning">
                    <MapPinOff className="size-3" />
                    No GPS
                  </Badge>
                ) : (
                  <Badge
                    className={cn(
                      "gap-1 border-transparent",
                      online
                        ? "bg-success/12 text-success"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        online ? "bg-success" : "bg-muted-foreground",
                      )}
                    />
                    {online ? "Online" : "Offline"}
                  </Badge>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


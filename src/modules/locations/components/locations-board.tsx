"use client";

import { useMemo, useState } from "react";
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
  OFFICE,
  WORK_MODE_LABEL,
  type WorkMode,
} from "@/lib/mock-locations";
import { LiveMap, type MapMarker } from "./live-map";
import { EmployeeLocationView } from "./employee-location";
import { cn } from "@/lib/utils";

/** Board ⇄ per-employee detail, mirroring the Screenshots drill-down. */
export function LocationsView() {
  const [selected, setSelected] = useState<User | null>(null);
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
    "all" | "online" | "offline" | "untracked"
  >("all");
  const [mode, setMode] = useState<"all" | WorkMode>("all");

  // Team leads see only their team; org roles see everyone.
  const scoped = useMemo(
    () => LOCATION_EMPLOYEES.filter((e) => inScope(e.user.id)),
    [inScope],
  );

  const departments = useMemo(
    () => Array.from(new Set(scoped.map((e) => e.user.department))).sort(),
    [scoped],
  );

  const onlineEmployees = scoped.filter((e) => e.status === "online");
  const onlineCount = onlineEmployees.length;
  const remoteOnline = onlineEmployees.filter((e) => e.mode === "remote").length;
  const officeOnline = onlineCount - remoteOnline;
  const noGpsCount = scoped.filter((e) => !e.gpsCapable).length;

  const q = query.trim().toLowerCase();
  const matchesStatus = (e: (typeof scoped)[number]) => {
    if (status === "all") return true;
    if (status === "online") return e.status === "online";
    if (status === "untracked") return e.offlineReason === "no-gps";
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
    [scoped, dept, status, mode, q],
  );

  // Avatar markers reflect the same dept / status / mode filters, placed at
  // each employee's real location (only online people have a live location).
  const mapMarkers: MapMarker[] = useMemo(
    () =>
      scoped
        .filter(
          (e) =>
            e.status === "online" &&
            e.current &&
            (status === "all" || status === "online") &&
            (dept === "all" || e.user.department === dept) &&
            (mode === "all" || e.mode === mode),
        )
        .map((e) => ({
          id: e.user.id,
          point: e.current!.point,
          variant: "avatar" as const,
          avatarUrl: e.user.avatarUrl,
          name: `${e.user.name} · ${e.current!.area}`,
          online: true,
          onClick: () => onSelect(e.user),
        })),
    [scoped, dept, status, mode, onSelect],
  );

  return (
    <div className="space-y-5">
      <AiReportCard
        title="AI location report"
        summary={`${onlineCount} of ${scoped.length} monitored employees are online now — ${officeOnline} working in office and ${remoteOnline} remote (work from home). Ambattur and the OMR corridor carry the highest on-site concentration; no employee is reporting from outside the approved work zones.`}
        metrics={[
          { label: "Monitored", value: scoped.length },
          { label: "Online now", value: onlineCount, hint: "live" },
          { label: "In office", value: officeOnline },
          { label: "Remote", value: remoteOnline },
          { label: "No GPS", value: noGpsCount },
        ]}
      />

      {/* Live map */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Live map · online now</p>
              <p className="text-xs text-muted-foreground">
                {mapMarkers.length}{" "}
                {mapMarkers.length === 1 ? "person" : "people"} on the map
              </p>
            </div>
            {/* Unified filters — drive the map and the list below, live. */}
            <div className="flex flex-wrap items-center gap-2">
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
                  setStatus(v as "all" | "online" | "offline" | "untracked")
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
                            : "All status"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
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
            center={OFFICE.point}
            zoom={13}
            recenterKey="board"
          />
          <p className="text-xs text-muted-foreground">
            Simulated location data (Phase 1) · default view centres on the
            Thoraipakkam office · tap an employee to open their trail.
          </p>
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


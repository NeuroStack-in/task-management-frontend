"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Clock,
  House,
  MapPin,
  MapPinOff,
  Monitor,
  UserRound,
} from "lucide-react";
import type { User } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimePicker } from "@/components/ui/date-picker";
import { initials } from "@/lib/format";
import { TODAY } from "@/lib/mock-attendance";
import {
  dateLabel,
  distanceMeters,
  insidePerimeter,
  locationAtTime,
  locationFor,
  OFFICE,
  WORK_MODE_LABEL,
  type EmployeeLocation,
} from "@/lib/mock-locations";
import { useGeofenceStore } from "@/stores/geofence.store";
import { LogDatePicker } from "@/modules/attendance/components/attendance-log";
import { LiveMap, type MapMarker } from "./live-map";
import { LocationTimeline } from "./location-timeline";
import { cn } from "@/lib/utils";

function toMarkers(loc: EmployeeLocation): MapMarker[] {
  const online = loc.status === "online";
  return loc.trail.map((ev) => ({
    id: ev.id,
    point: ev.point,
    variant:
      ev.kind === "login"
        ? "login"
        : ev.kind === "logout"
          ? "logout"
          : online
            ? "current"
            : "default",
    name:
      ev.kind === "login"
        ? `Logged in · ${ev.area} · ${ev.time}`
        : ev.kind === "logout"
          ? `Logged out · ${ev.area} · ${ev.time}`
          : online
            ? `Current · ${ev.area} · ${ev.time}`
            : `Last seen · ${ev.area} · ${ev.time}`,
  }));
}

export function EmployeeLocationView({
  user,
  onBack,
}: {
  user: User;
  onBack: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState({ ...TODAY });
  const [time, setTime] = useState(""); // "HH:MM" — locate at a specific moment
  const loc = useMemo(
    () => locationFor(user, date.year, date.month, date.day),
    [user, date],
  );

  // "Where was this person at exactly this date + time?" — interpolated fix.
  const moment = useMemo(
    () => (time ? locationAtTime(loc, time) : null),
    [loc, time],
  );

  const markers = useMemo(() => {
    const base = toMarkers(loc);
    if (moment)
      base.push({
        id: "moment",
        point: moment.point,
        variant: "moment",
        name: `At ${time} · ${moment.area}`,
      });
    return base;
  }, [loc, moment, time]);

  const path = useMemo(() => loc.trail.map((e) => e.point), [loc]);
  const center =
    moment?.point ?? loc.current?.point ?? loc.login?.point ?? OFFICE.point;

  const online = loc.status === "online";

  // The admin-configured office perimeter (shared store).
  const { center: fenceCenter, radiusM: fenceRadius, enabled: fenceOn } =
    useGeofenceStore();
  const fence = { center: fenceCenter, radiusM: fenceRadius };

  // Perimeter status of the current/last-seen fix and of the picked moment.
  const currentInside =
    loc.current && fenceOn ? insidePerimeter(loc.current.point, fence) : null;
  const currentDist = loc.current
    ? Math.round(distanceMeters(loc.current.point, fence.center))
    : null;
  const momentInside =
    moment && fenceOn ? insidePerimeter(moment.point, fence) : null;
  const momentDist = moment
    ? Math.round(distanceMeters(moment.point, fence.center))
    : null;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft className="size-4" /> All locations
      </Button>

      {/* Identity */}
      <div className="rounded-2xl bg-card px-5 py-4 shadow-soft">
        <div className="flex items-start gap-4">
          <Avatar className="size-14 shrink-0">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback className="text-base">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <h2 className="font-heading text-lg font-semibold">{user.name}</h2>
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
              {!loc.gpsCapable ? (
                <Badge className="gap-1 border-transparent bg-warning/15 text-warning">
                  <MapPinOff className="size-3" /> No GPS
                </Badge>
              ) : loc.mode === "in-office" && currentInside === false ? (
                <Badge className="gap-1 border-transparent bg-destructive/12 text-destructive">
                  <AlertTriangle className="size-3" /> Outside office ·{" "}
                  {currentDist} m
                </Badge>
              ) : (
                <Badge className="gap-1 border-transparent bg-feature-tint text-primary">
                  {loc.mode === "remote" ? (
                    <House className="size-3" />
                  ) : (
                    <Building2 className="size-3" />
                  )}
                  {WORK_MODE_LABEL[loc.mode]}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {user.jobTitle} · {user.department}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Monitor className="size-3.5" /> {loc.device}
              </span>
              {loc.current ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" /> {loc.current.label},{" "}
                  {loc.current.city}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => router.push(`/employees/${user.id}`)}
          >
            <UserRound className="size-4" /> View profile
          </Button>
        </div>
      </div>

      {/* "View at" — pick a date + time to pinpoint a moment */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border bg-card px-4 py-3">
        <span className="text-sm font-medium">View at</span>
        <LogDatePicker value={date} onChange={setDate} />
        <TimePicker value={time} onChange={setTime} className="w-28" />
        {time ? (
          moment ? (
            <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
              <Clock className="size-4 shrink-0 text-primary" />
              <span className="font-semibold tabular-nums">{time}</span>
              <span className="text-muted-foreground">· near {moment.area}</span>
              {momentInside !== null ? (
                <Badge
                  className={cn(
                    "gap-1 border-transparent",
                    momentInside
                      ? "bg-success/12 text-success"
                      : "bg-destructive/12 text-destructive",
                  )}
                >
                  {momentInside ? "Inside office" : "Outside office"}
                </Badge>
              ) : null}
              <span className="text-muted-foreground">
                {momentDist} m from office
              </span>
              <Button variant="ghost" size="sm" onClick={() => setTime("")}>
                Clear
              </Button>
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              No location recorded for this day.
              <Button variant="ghost" size="sm" onClick={() => setTime("")}>
                Clear
              </Button>
            </div>
          )
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">
            Pick a time to pinpoint the exact-moment location (amber pin).
          </span>
        )}
      </div>

      {/* Map + timeline */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden p-0">
          <CardContent className="p-3">
            <LiveMap
              markers={markers}
              path={path}
              geofence={fenceOn ? fence : null}
              center={center}
              zoom={14}
              recenterKey={`${user.id}:${date.year}-${date.month}-${date.day}:${time}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {dateLabel(date)} · location trail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LocationTimeline
              employee={loc}
              moment={
                moment
                  ? {
                      time,
                      area: moment.area,
                      point: moment.point,
                      inside: momentInside,
                      distM: momentDist,
                    }
                  : null
              }
            />
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Simulated location data (Phase 1). Captured only while an employee is
        clocked in; visible to administrators for workforce oversight.
      </p>
    </div>
  );
}

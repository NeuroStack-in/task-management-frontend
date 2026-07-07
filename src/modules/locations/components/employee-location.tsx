"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Building2, House, MapPin, MapPinOff, Monitor } from "lucide-react";
import type { User } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { initials } from "@/lib/format";
import { TODAY } from "@/lib/mock-attendance";
import {
  dateLabel,
  locationFor,
  OFFICE,
  WORK_MODE_LABEL,
  type EmployeeLocation,
} from "@/lib/mock-locations";
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
  const [date, setDate] = useState({ ...TODAY });
  const loc = useMemo(
    () => locationFor(user, date.year, date.month, date.day),
    [user, date],
  );
  const markers = useMemo(() => toMarkers(loc), [loc]);
  const path = useMemo(() => loc.trail.map((e) => e.point), [loc]);
  const center = loc.current?.point ?? loc.login?.point ?? OFFICE.point;

  const online = loc.status === "online";

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft className="size-4" /> All locations
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-card px-5 py-4 shadow-soft">
        <Avatar className="size-12">
          <AvatarImage src={user.avatarUrl} alt={user.name} />
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
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
            {loc.gpsCapable ? (
              <Badge className="gap-1 border-transparent bg-feature-tint text-primary">
                {loc.mode === "remote" ? (
                  <House className="size-3" />
                ) : (
                  <Building2 className="size-3" />
                )}
                {WORK_MODE_LABEL[loc.mode]}
              </Badge>
            ) : (
              <Badge className="gap-1 border-transparent bg-warning/15 text-warning">
                <MapPinOff className="size-3" /> No GPS
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {user.jobTitle} · {user.department}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Monitor className="size-3.5" />
            {loc.device}
          </p>
          {loc.current ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />
              {loc.current.label}, {loc.current.city}
            </p>
          ) : null}
        </div>
        <LogDatePicker value={date} onChange={setDate} />
      </div>

      {/* Map + timeline */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden p-0">
          <CardContent className="p-3">
            <LiveMap
              markers={markers}
              path={path}
              center={center}
              zoom={14}
              recenterKey={`${user.id}:${date.year}-${date.month}-${date.day}`}
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
            <LocationTimeline employee={loc} />
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

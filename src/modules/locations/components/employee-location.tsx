"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  MapPin,
  MapPinOff,
  Navigation,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { initials } from "@/lib/format";
import type { OversightPersonLocation } from "@/modules/insights/services/insights.service";
import { useGeofenceStore } from "@/stores/geofence.store";
import {
  distanceMeters,
  insidePerimeter,
  type GeoPoint,
} from "@/modules/locations/types";
import { LiveMap, type MapMarker } from "./live-map";
import { cn } from "@/lib/utils";

const toGeoPoint = (p: { lat: number; lon: number }): GeoPoint => ({
  lat: p.lat,
  lng: p.lon,
});
const when = (ms: number) =>
  new Date(ms).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
const accuracy = (m: number) =>
  m >= 1000 ? `±${(m / 1000).toFixed(1)} km` : `±${Math.round(m)} m`;

/**
 * Per-employee location detail, opened from the oversight board. The org oversight route serves the
 * **latest** fix per person (not a full trail — that's exposed only for one's own device via the
 * Insights › Location page), so this view honestly shows the last known position rather than
 * reconstructing a day-long path.
 */
export function EmployeeLocationView({
  person,
  onBack,
}: {
  person: OversightPersonLocation;
  onBack: () => void;
}) {
  const { center: fenceCenter, radiusM, enabled: showFence } = useGeofenceStore();
  const fence = { center: fenceCenter, radiusM };

  const latest = person.latest;
  const point = latest ? toGeoPoint(latest) : null;
  const inside = point ? insidePerimeter(point, fence) : null;
  const distM = point ? distanceMeters(point, fenceCenter) : null;
  const outside = showFence && inside === false;

  const markers: MapMarker[] = point
    ? [
        {
          id: person.user_id,
          point,
          variant: "current",
          name: person.name,
          online: true,
          alert: outside,
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      {/* Identity */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <Avatar className="size-12">
            <AvatarFallback>{initials(person.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">{person.name}</p>
            <p className="text-sm text-muted-foreground">
              {latest
                ? `${person.fix_count} ${person.fix_count === 1 ? "fix" : "fixes"} recorded`
                : "No location reported"}
            </p>
          </div>
          {latest ? (
            <Badge
              className={cn(
                "gap-1 border-transparent",
                outside
                  ? "bg-destructive/12 text-destructive"
                  : "bg-success/12 text-success",
              )}
            >
              {outside ? (
                <AlertTriangle className="size-3" />
              ) : (
                <MapPin className="size-3" />
              )}
              {outside ? "Outside perimeter" : "Located"}
            </Badge>
          ) : (
            <Badge className="gap-1 border-transparent bg-muted text-muted-foreground">
              <MapPinOff className="size-3" />
              No location
            </Badge>
          )}
        </CardContent>
      </Card>

      {latest && point ? (
        <>
          <Card>
            <CardContent className="p-4">
              <LiveMap
                markers={markers}
                geofence={showFence ? fence : null}
                center={point}
                zoom={15}
                recenterKey={`emp-${person.user_id}`}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Fact
              icon={Clock}
              label="Last seen"
              value={when(latest.captured_at)}
            />
            <Fact
              icon={Target}
              label="Accuracy"
              value={accuracy(latest.accuracy_m)}
            />
            <Fact
              icon={Navigation}
              label="Distance from office"
              value={
                distM === null
                  ? "—"
                  : distM >= 1000
                    ? `${(distM / 1000).toFixed(1)} km`
                    : `${Math.round(distM)} m`
              }
            />
          </div>

          <p className="text-xs text-muted-foreground">
            This is the most recent device fix reported for {person.name}. A full
            day-by-day location trail is available to each employee for their own
            device on the Insights › Location page.
          </p>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <MapPinOff className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No location for this day</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {person.name}&apos;s desktop agent reported no location fix on the
              selected day — either it wasn&apos;t running, location consent
              wasn&apos;t granted, or the device has no positioning source.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-feature-tint text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-medium">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

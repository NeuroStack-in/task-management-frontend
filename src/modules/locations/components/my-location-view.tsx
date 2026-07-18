"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import { getMyLocations, type LocationPoint } from "@/modules/insights/services/insights.service";
import type { GeoPoint } from "@/modules/locations/types";
import { cn } from "@/lib/utils";
import { LiveMap, type MapMarker } from "./live-map";

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
const accuracy = (m: number) => (m >= 1000 ? `±${(m / 1000).toFixed(1)}km` : `±${Math.round(m)}m`);

/**
 * Insights › Location — the signed-in user's own device-location trail for a day, read from
 * `GET /v1/me/insights/locations` (the ingest fold stores one point per consent-gated heartbeat).
 *
 * The server's shape wins: points are `{lat, lon, accuracy_m, captured_at}`. Empty until the agent
 * reports location, so a day with no fixes degrades to the honest "waiting on the agent" state
 * rather than an invented map — the same stance the page had before, now backed by the real route.
 */
export function MyLocationView() {
  // Client-side to avoid an SSR date mismatch; default to today (location is a "today" question).
  const [date, setDate] = useState<string>("");
  useEffect(() => setDate(isoOf(new Date())), []);
  const today = isoOf(new Date());

  const [points, setPoints] = useState<LocationPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setLoading(true);
    setError(null);
    getMyLocations(date)
      .then((d) => live && setPoints(d.points))
      .catch((e) => {
        if (!live) return;
        setPoints(null);
        setError(
          e instanceof ApiError && e.status === 403
            ? "You don't have access to location data."
            : "Couldn't load your location history. Please try again.",
        );
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [date]);

  const { markers, path, center } = useMemo(() => build(points ?? []), [points]);

  const summary = useMemo(() => {
    const ps = points ?? [];
    if (ps.length === 0) return null;
    const avg = Math.round(ps.reduce((s, p) => s + p.accuracy_m, 0) / ps.length);
    return {
      count: ps.length,
      span: `${clock(ps[0].captured_at)} – ${clock(ps[ps.length - 1].captured_at)}`,
      avg,
    };
  }, [points]);

  return (
    <div className="space-y-4">
      {/* Date filter — mirrors the Activity tab. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card px-4 py-2.5 shadow-soft">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Location history</p>
          <p className="text-xs text-muted-foreground">
            Where your device reported from — one fix per agent heartbeat, while monitoring is on.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous day"
            disabled={!date}
            onClick={() => setDate((d) => (d ? shiftIso(d, -1) : d))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 w-36"
          />
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next day"
            disabled={!date || date >= today}
            onClick={() => setDate((d) => (d && d < today ? shiftIso(d, 1) : d))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-2">
            <Loader label="Loading location history…" />
          </CardContent>
        </Card>
      ) : error ? (
        <EmptyState icon={MapPin} title="Couldn't load locations" description={error} />
      ) : !summary || !center ? (
        <EmptyState
          icon={MonitorSmartphone}
          title="No location reported"
          description="No location was recorded for this day. The desktop agent reports a fix on each heartbeat while monitoring consent is granted and the OS location service is on."
        />
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Fixes" value={String(summary.count)} />
            <Stat label="Span" value={summary.span} />
            <Stat label="Avg accuracy" value={accuracy(summary.avg)} />
          </div>

          <Card>
            <CardContent className="p-2">
              <LiveMap
                markers={markers}
                path={path}
                center={center}
                zoom={13}
                recenterKey={`${date}-${markers.length}`}
                className="h-[420px] w-full overflow-hidden rounded-xl"
              />
            </CardContent>
          </Card>

          {/* Timeline — newest first. */}
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {(points ?? [])
                  .slice()
                  .reverse()
                  .map((p, i, arr) => {
                    const isLatest = i === 0;
                    const isFirst = i === arr.length - 1;
                    return (
                      <li key={p.captured_at} className="flex items-center gap-3 px-4 py-2.5">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full",
                            isLatest
                              ? "bg-primary/10 text-primary"
                              : isFirst
                                ? "bg-success/10 text-success"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          <MapPin className="size-3.5" />
                        </span>
                        <span className="w-14 shrink-0 text-sm font-medium tabular-nums">
                          {clock(p.captured_at)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {p.lat.toFixed(5)}, {p.lon.toFixed(5)}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {accuracy(p.accuracy_m)}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/** Map the server's points into the map's `{lat, lng}` markers + trail path, centred on the latest. */
function build(points: LocationPoint[]): {
  markers: MapMarker[];
  path: GeoPoint[];
  center: GeoPoint | null;
} {
  if (points.length === 0) return { markers: [], path: [], center: null };
  const path: GeoPoint[] = points.map((p) => ({ lat: p.lat, lng: p.lon }));
  const markers: MapMarker[] = points.map((p, i) => ({
    id: String(p.captured_at),
    point: { lat: p.lat, lng: p.lon },
    variant: i === 0 ? "login" : i === points.length - 1 ? "current" : "default",
  }));
  return { markers, path, center: path[path.length - 1] };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3 shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

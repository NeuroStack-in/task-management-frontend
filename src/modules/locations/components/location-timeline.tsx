"use client";

import { Clock, LogIn, MapPin, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import type { LocationPoint } from "@/modules/insights/services/insights.service";
import { cn } from "@/lib/utils";

/**
 * The day's location trail for one employee.
 *
 * ## Why this shows three rows and not every fix
 *
 * A tracked day produces a fix every heartbeat — hundreds of rows, nearly all of them "still at the
 * same desk". The trail therefore summarises the day's **shape**: when tracking started, where they
 * are now (or were last), and — when the admin picks a time — where they were at that moment. The
 * map beside it draws the full path, which is the right medium for "every point".
 *
 * ## What it deliberately does not say
 *
 * The design this is ported from showed place names ("near Thoraipakkam", "WorkPulse HQ"). WorkPulse
 * has **no reverse-geocoding service**, so a place name here would be invented. Each row shows the
 * real coordinate, the accuracy the OS reported, and the measured distance from the office instead.
 * "12.9460, 80.2420 · ±36 m · 410 m from office" is a fact; "near Thoraipakkam" would be a guess
 * dressed as one — and this is evidence an HR dispute could rest on.
 */

/** The picked date+time fix, appended to the bottom of the trail. */
export interface MomentEntry {
  /** "HH:MM" the admin asked about — not necessarily when the fix was captured. */
  time: string;
  point: LocationPoint;
  inside: boolean | null;
  distM: number | null;
}

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const fmtAccuracy = (m: number) =>
  m >= 1000 ? `±${(m / 1000).toFixed(1)} km` : `±${Math.round(m)} m`;

const coords = (p: LocationPoint) =>
  `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`;

function Row({
  icon: Icon,
  tone,
  title,
  live,
  time,
  detail,
  point,
  badge,
  connector,
}: {
  icon: typeof LogIn;
  tone: string;
  title: string;
  live?: boolean;
  time: string;
  detail: string;
  point: LocationPoint;
  badge?: React.ReactNode;
  connector: boolean;
}) {
  return (
    <li className="relative flex gap-3">
      {connector ? (
        <span className="absolute left-[15px] top-8 h-[calc(100%+4px)] w-px bg-border" />
      ) : null}
      <span
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted",
          tone,
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{title}</p>
          {live ? (
            <Badge className="gap-1 border-transparent bg-primary/12 text-primary">
              <span className="size-1.5 rounded-full bg-primary" /> Live
            </Badge>
          ) : null}
          {badge}
          <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
            {time}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p>
        <p className="mt-0.5 text-xs text-muted-foreground/80">
          {coords(point)} · {fmtAccuracy(point.accuracy_m)}
        </p>
      </div>
    </li>
  );
}

export function LocationTimeline({
  points,
  online,
  moment,
  distanceFromOffice,
}: {
  points: LocationPoint[];
  online: boolean;
  moment?: MomentEntry | null;
  /** Metres from the office perimeter centre, or `null` when no perimeter is set. */
  distanceFromOffice: (p: LocationPoint) => number | null;
}) {
  if (points.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No location data"
        description="No location was recorded for this day. Location is captured only while the timer is running, so a day with no tracked work has no trail."
      />
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const showLast = points.length > 1;

  const detailFor = (p: LocationPoint) => {
    const d = distanceFromOffice(p);
    return d === null
      ? `${points.length} ${points.length === 1 ? "location" : "locations"} recorded`
      : `${d} m from office`;
  };

  return (
    <ol className="relative space-y-5">
      <Row
        icon={LogIn}
        tone="text-success"
        title="Tracking started"
        time={fmtTime(first.captured_at)}
        detail={detailFor(first)}
        point={first}
        connector={showLast || !!moment}
      />

      {showLast ? (
        <Row
          icon={online ? Navigation : MapPin}
          tone="text-primary"
          title={online ? "Current location" : "Last seen"}
          live={online}
          time={fmtTime(last.captured_at)}
          detail={detailFor(last)}
          point={last}
          connector={!!moment}
        />
      ) : null}

      {moment ? (
        <li className="relative flex gap-3">
          <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Clock className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">At this time</p>
              {moment.inside !== null ? (
                <Badge
                  className={cn(
                    "gap-1 border-transparent",
                    moment.inside
                      ? "bg-success/12 text-success"
                      : "bg-destructive/12 text-destructive",
                  )}
                >
                  {moment.inside ? "Inside office" : "Outside office"}
                </Badge>
              ) : null}
              <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                {moment.time}
              </span>
            </div>
            {/*
              The captured time is shown alongside the requested one whenever they differ: the fix is
              the last one at or before the chosen moment, so "14:30" may be answered by a 14:12 fix.
              Hiding that gap would imply a precision the data doesn't have.
            */}
            <p className="mt-0.5 text-sm text-muted-foreground">
              Last known position
              {fmtTime(moment.point.captured_at) !== moment.time
                ? ` · recorded ${fmtTime(moment.point.captured_at)}`
                : ""}
              {moment.distM !== null ? ` · ${moment.distM} m from office` : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/80">
              {coords(moment.point)} · {fmtAccuracy(moment.point.accuracy_m)}
            </p>
          </div>
        </li>
      ) : null}
    </ol>
  );
}

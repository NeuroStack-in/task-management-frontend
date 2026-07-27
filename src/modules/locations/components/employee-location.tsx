"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Clock,
  House,
  MapPin,
  TimerOff,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/shared/loader";
import { DatePicker, TimePicker } from "@/components/ui/date-picker";
import { initials, todayIso } from "@/lib/format";
import { ApiError } from "@/lib/api";
import {
  getLocationTrail,
  type LocationPoint,
  type OversightPersonLocation,
} from "@/modules/insights/services/insights.service";
import { getUserTimesheet } from "@/modules/time-tracking/services/timesheet.service";
import { useGeofenceStore } from "@/stores/geofence.store";
import {
  deriveMode,
  deriveStatus,
  distanceMeters,
  insidePerimeter,
  WORK_MODE_LABEL,
  type GeoPoint,
} from "@/modules/locations/types";
import { LiveMap, type MapMarker } from "./live-map";
import { LocationTimeline, type MomentEntry } from "./location-timeline";
import { cn } from "@/lib/utils";

const toGeoPoint = (p: { lat: number; lon: number }): GeoPoint => ({
  lat: p.lat,
  lng: p.lon,
});

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Midnight local time on an ISO `YYYY-MM-DD` — the origin the "HH:MM" scrubber measures from. */
function dayStartMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
}

function dateLabel(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** One run of the timer: `end` absent while it is still running. */
interface TimerSession {
  start: number;
  end?: number;
}

/**
 * What the page can honestly say about a picked moment.
 *
 * Four outcomes, deliberately distinct — collapsing any two of them would put words in the data's
 * mouth:
 *
 * - `located` — the timer was running **and** a position was recorded in that same session.
 * - `timer-off` — the timer was not running. Nothing was captured because nothing should have been.
 * - `no-capture` — the timer *was* running but no position reached us (agent offline, OS location
 *   denied, or consent withdrawn). Reporting this as "timer off" would blame the employee for a
 *   gap that is not theirs.
 * - `unknown` — the viewer cannot read this employee's timesheet (`TimeReadTeam`), so the timer's
 *   state is genuinely unknown to them. Shows the last known position without asserting why.
 */
type MomentState =
  | { kind: "located"; point: LocationPoint; session: TimerSession }
  | { kind: "timer-off" }
  | { kind: "no-capture"; session: TimerSession }
  | { kind: "unknown"; point: LocationPoint | null };

/** The session containing `t`, or `null`. A running session is open-ended. */
function sessionAt(sessions: TimerSession[], t: number, now: number): TimerSession | null {
  return sessions.find((s) => t >= s.start && t < (s.end ?? now)) ?? null;
}

/**
 * The last recorded position at or before `t` **within `session`**.
 *
 * The session bound is the point of this function. A plain "last fix at or before t" would answer
 * 14:02 with a position captured at 11:55 during a *different*, earlier timer run — presenting a
 * three-hour-old location from the morning as where the employee was in the afternoon. Restricting
 * to the session means a gap inside the session reads as a gap, not as a stale position.
 */
function positionInSession(
  points: LocationPoint[],
  t: number,
  session: TimerSession,
): LocationPoint | null {
  let found: LocationPoint | null = null;
  for (const p of points) {
    if (p.captured_at > t) break; // chronological
    if (p.captured_at >= session.start) found = p;
  }
  return found;
}

/**
 * Per-employee location detail, opened from the oversight board.
 *
 * Unlike the board — which serves each person's **latest** fix only — this loads the employee's full
 * trail for a chosen day (`GET /v1/insights/locations/{user_id}`), so an admin can scrub to a time
 * and ask "where were they at 14:30".
 *
 * **The date is a real refetch, not a client-side filter.** Each day is its own server query, which
 * is why changing the date shows a loading state rather than re-slicing something already in memory.
 *
 * Authorization is enforced server-side by reach: a department-scoped manager opening someone
 * outside their department gets a 403, surfaced here as an explicit access message. "No data" and
 * "you may not see this" must never look the same.
 */
export function EmployeeLocationView({
  person,
  date,
  onDateChange,
  onBack,
}: {
  person: OversightPersonLocation;
  /** ISO `YYYY-MM-DD`, owned by the board so going back preserves the day in view. */
  date: string;
  onDateChange: (iso: string) => void;
  onBack: () => void;
}) {
  const [trail, setTrail] = useState<LocationPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState(""); // "HH:MM" — locate at a specific moment
  const [sessions, setSessions] = useState<TimerSession[] | null>(null);
  /**
   * `false` when the caller lacks `TimeReadTeam`. Location and timer data are gated on **different**
   * permissions (`ActivityReadTeam` vs `TimeReadTeam`), so someone can legitimately see the map and
   * not the timesheet. In that case the page must not claim anything about the timer.
   */
  const [timerAccess, setTimerAccess] = useState(true);

  const { center: fenceCenter, radiusM, enabled: fenceOn } = useGeofenceStore();
  const fence = useMemo(
    () => ({ center: fenceCenter, radiusM }),
    [fenceCenter, radiusM],
  );

  useEffect(() => {
    if (!date) return;
    let live = true;
    setLoading(true);
    setError(null);
    getLocationTrail(person.user_id, date)
      .then((d) => live && setTrail(d.points))
      .catch((e) => {
        if (!live) return;
        setTrail(null);
        setError(
          e instanceof ApiError && e.status === 403
            ? "You don't have access to this employee's location."
            : "Couldn't load this employee's location trail.",
        );
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [person.user_id, date]);

  // The day's timer sessions — the authority on "was the timer running at 14:30".
  useEffect(() => {
    if (!date) return;
    let live = true;
    setSessions(null);
    setTimerAccess(true);
    getUserTimesheet(person.user_id, date, date)
      .then((g) => {
        if (!live) return;
        const day = g.days.find((d) => d.date === date);
        setSessions(
          (day?.entries ?? []).map((e) => ({ start: e.start, end: e.end })),
        );
      })
      .catch((e) => {
        if (!live) return;
        // 403 is a permission boundary, not a failure: fall back to "we can't say".
        if (e instanceof ApiError && e.status === 403) setTimerAccess(false);
        setSessions([]);
      });
    return () => {
      live = false;
    };
  }, [person.user_id, date]);

  const points = useMemo(() => trail ?? [], [trail]);
  const last = points.length > 0 ? points[points.length - 1] : null;

  const now = Date.now();
  const status = deriveStatus(last?.captured_at ?? null, points.length, now);
  const online = status === "online";
  const mode = deriveMode(last ? toGeoPoint(last) : null, fence, fenceOn);

  /** The requested moment as epoch ms, or `null` when no time is picked / it is malformed. */
  const askedAtMs = useMemo(() => {
    if (!time) return null;
    const [h, m] = time.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return dayStartMs(date) + h * 3_600_000 + m * 60_000;
  }, [time, date]);

  /** Resolves the picked moment against the timer sessions — see {@link MomentState}. */
  const momentState: MomentState | null = useMemo(() => {
    if (askedAtMs === null) return null;
    if (!timerAccess) {
      // No timesheet access: report position only, assert nothing about the timer.
      let last: LocationPoint | null = null;
      for (const p of points) {
        if (p.captured_at > askedAtMs) break;
        last = p;
      }
      return { kind: "unknown", point: last };
    }
    if (sessions === null) return null; // still loading
    const session = sessionAt(sessions, askedAtMs, now);
    if (!session) return { kind: "timer-off" };
    const point = positionInSession(points, askedAtMs, session);
    return point
      ? { kind: "located", point, session }
      : { kind: "no-capture", session };
  }, [askedAtMs, timerAccess, sessions, points, now]);

  const momentPoint =
    momentState?.kind === "located"
      ? momentState.point
      : momentState?.kind === "unknown"
        ? momentState.point
        : null;

  const distFrom = useMemo(
    () =>
      (p: LocationPoint): number | null =>
        fenceOn ? Math.round(distanceMeters(toGeoPoint(p), fenceCenter)) : null,
    [fenceOn, fenceCenter],
  );

  const insideOf = useMemo(
    () =>
      (p: LocationPoint): boolean | null =>
        fenceOn ? insidePerimeter(toGeoPoint(p), fence) : null,
    [fenceOn, fence],
  );

  const moment: MomentEntry | null = momentPoint
    ? {
        time,
        point: momentPoint,
        inside: insideOf(momentPoint),
        distM: distFrom(momentPoint),
      }
    : null;

  const currentInside = last ? insideOf(last) : null;
  const currentDist = last ? distFrom(last) : null;

  const markers: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = [];
    if (points.length > 0) {
      out.push({
        id: "first",
        point: toGeoPoint(points[0]),
        variant: "login",
        name: `Tracking started · ${fmtTime(points[0].captured_at)}`,
      });
    }
    if (last && points.length > 1) {
      out.push({
        id: "last",
        point: toGeoPoint(last),
        variant: online ? "current" : "default",
        name: `${online ? "Current" : "Last seen"} · ${fmtTime(last.captured_at)}`,
        alert: currentInside === false,
      });
    }
    if (momentPoint) {
      out.push({
        id: "moment",
        point: toGeoPoint(momentPoint),
        variant: "moment",
        name: `At ${time} · recorded ${fmtTime(momentPoint.captured_at)}`,
      });
    }
    return out;
  }, [points, last, online, momentPoint, time, currentInside]);

  const path = useMemo(() => points.map(toGeoPoint), [points]);
  const center = momentPoint
    ? toGeoPoint(momentPoint)
    : last
      ? toGeoPoint(last)
      : fenceCenter;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft className="size-4" /> All locations
      </Button>

      {/* Identity */}
      <div className="rounded-2xl bg-card px-5 py-4 shadow-soft">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar className="size-14 shrink-0">
            <AvatarFallback className="text-base">
              {initials(person.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <h2 className="font-heading text-lg font-semibold">
                {person.name}
              </h2>
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
                {status === "untracked"
                  ? "Untracked"
                  : online
                    ? "Online"
                    : "Offline"}
              </Badge>
              {currentInside === false ? (
                <Badge className="gap-1 border-transparent bg-destructive/12 text-destructive">
                  <AlertTriangle className="size-3" /> Outside office ·{" "}
                  {currentDist} m
                </Badge>
              ) : mode ? (
                <Badge
                  className="gap-1 border-transparent bg-feature-tint text-primary"
                  title="Derived from the office perimeter — WorkPulse has no declared work arrangement"
                >
                  {mode === "remote" ? (
                    <House className="size-3" />
                  ) : (
                    <Building2 className="size-3" />
                  )}
                  {WORK_MODE_LABEL[mode]}
                </Badge>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" /> {person.department_id}
              </span>
              {last ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Last seen{" "}
                  {fmtTime(last.captured_at)}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {points.length} {points.length === 1 ? "location" : "locations"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* "View at" — pick a date + time to pinpoint a moment */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border bg-card px-4 py-3">
        <span className="text-sm font-medium">View at</span>
        {/* A location fix is a past observation — there is nothing to "view at" in the future. */}
        <DatePicker
          value={date}
          onChange={(v) => v && onDateChange(v)}
          max={todayIso()}
        />
        <TimePicker value={time} onChange={setTime} className="w-28" />
        {momentState === null ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {time
              ? "Checking the timer…"
              : "Pick a time to see where they were at that moment."}
          </span>
        ) : momentState.kind === "timer-off" ? (
          // The timer was not running, so nothing was captured — by design, not by failure.
          <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <TimerOff className="size-4 shrink-0" />
            The timer was not running at {time} on {dateLabel(date)}.
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setTime("")}
            >
              Clear
            </Button>
          </span>
        ) : momentState.kind === "no-capture" ? (
          // Timer ON but nothing recorded. Deliberately NOT reported as "timer off": the employee
          // was tracking, and the gap is the agent's, the OS's, or a withdrawn consent.
          <span className="ml-auto flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-warning" />
            <span className="text-muted-foreground">
              The timer was running at {time}, but no location was recorded.
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setTime("")}
            >
              Clear
            </Button>
          </span>
        ) : momentState.kind === "unknown" ? (
          <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4 shrink-0" />
            {momentState.point
              ? `Last known position at ${time} · recorded ${fmtTime(momentState.point.captured_at)}. Timer status needs time-tracking access.`
              : `No location recorded at or before ${time} on ${dateLabel(date)}.`}
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setTime("")}
            >
              Clear
            </Button>
          </span>
        ) : (
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            <Clock className="size-4 shrink-0 text-primary" />
            <span className="font-semibold tabular-nums">{time}</span>
            <span className="text-muted-foreground">
              · recorded {fmtTime(momentState.point.captured_at)}
            </span>
            {moment?.inside !== null && moment !== null ? (
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
            {moment?.distM != null ? (
              <span className="text-muted-foreground">
                {moment.distM} m from office
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setTime("")}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      ) : loading ? (
        <Card>
          <CardContent className="py-10">
            <Loader />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <LiveMap
                markers={markers}
                path={path}
                geofence={fenceOn ? fence : null}
                center={center}
                zoom={14}
                recenterKey={`${person.user_id}-${date}-${time}`}
                className="h-[420px] w-full"
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
                points={points}
                online={online}
                moment={moment}
                distanceFromOffice={distFrom}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Captured only while the timer is running, and retained for 90 days. Visible
        to administrators for workforce oversight.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Building2, Clock, House, MapPin, TimerOff, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/shared/loader";
import { DatePicker, TimePicker } from "@/components/ui/date-picker";
import { todayIso } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { LIVE_REFRESH_MS, useLiveRefresh } from "@/hooks/use-live-refresh";
import { getLocationTrail, type LocationPoint, type OversightPersonLocation } from "@/modules/insights/services/insights.service";
import { getUserTimesheet } from "@/modules/time-tracking/services/timesheet.service";
import { departmentMap } from "@/modules/employees/services/employees.service";
import { useGeofenceStore } from "@/stores/geofence.store";
import { deriveMode, deriveStatus, distanceMeters, perimeterVerdict, WORK_MODE_LABEL, type GeoPoint } from "@/modules/locations/types";
import { LiveMap, type MapMarker } from "./live-map";
import { LocationTimeline, type MomentEntry } from "./location-timeline";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";

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
 * - `unknown` — the timer's state cannot be known: the viewer cannot read this employee's timesheet
 *   (`TimeReadTeam`, `reason: "no-access"`), or the read failed (`reason: "error"`). Shows the last
 *   known position without asserting why. A failed read used to resolve every time to "timer off" —
 *   a false statement about a person, on a screen meant to settle disputes (QA audit 2026-10-08,
 *   WP-292).
 * - `future` — the picked time hasn't happened yet, so nothing can be said about it.
 */
type MomentState =
  | { kind: "located"; point: LocationPoint; session: TimerSession }
  | { kind: "timer-off" }
  | { kind: "no-capture"; session: TimerSession }
  | { kind: "unknown"; point: LocationPoint | null; reason: "no-access" | "error" }
  | { kind: "future" };

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
  /** The trail, with the day it belongs to — another day's trail never stands in for this one's. */
  const [trail, setTrail] = useState<{
    date: string;
    points: LocationPoint[];
    /** When it was read: "online" is judged against this, not each render's clock. */
    at: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The read was refused (403) — a retry would only be refused again. */
  const [denied, setDenied] = useState(false);
  const [time, setTime] = useState(""); // "HH:MM" — locate at a specific moment
  const [sessions, setSessions] = useState<TimerSession[] | null>(null);
  /**
   * `false` when the caller lacks `TimeReadTeam`. Location and timer data are gated on **different**
   * permissions (`ActivityReadTeam` vs `TimeReadTeam`), so someone can legitimately see the map and
   * not the timesheet. In that case the page must not claim anything about the timer.
   */
  const [timerAccess, setTimerAccess] = useState(true);
  /** The timesheet read failed for another reason — the timer's state is then unknown, not "off". */
  const [timerFailed, setTimerFailed] = useState(false);
  // Live for today, like the board: a fix and a running timer keep moving while this is open.
  const { nonce, reload, isBackground } = useLiveRefresh(
    date !== "" && date === todayIso() ? LIVE_REFRESH_MS : null,
  );
  // Resolve the person's department id → name. `person` only carries `department_id` (a ULID), which
  // must never be shown to a user; the board resolves names in its own list but doesn't thread them
  // into this detail view, so resolve here (best-effort, same `departmentMap` the rest of the app uses).
  const [departmentName, setDepartmentName] = useState("");
  useEffect(() => {
    let live = true;
    if (!person.department_id) {
      setDepartmentName("");
      return;
    }
    departmentMap()
      .then((m) => live && setDepartmentName(m.get(person.department_id) ?? ""))
      .catch(() => {
        /* best-effort: leave blank rather than show a raw id */
      });
    return () => {
      live = false;
    };
  }, [person.department_id]);

  const { center: fenceCenter, radiusM, enabled: fenceOn } = useGeofenceStore();
  const fence = useMemo(
    () => ({ center: fenceCenter, radiusM }),
    [fenceCenter, radiusM],
  );

  // The trail and the day's timer sessions, read together so a poll refreshes both — the sessions
  // are the authority on "was the timer running at 14:30".
  useEffect(() => {
    if (!date) return;
    let live = true;
    const background = isBackground();
    if (!background) {
      setLoading(true);
      setError(null);
      setDenied(false);
      setSessions(null);
      setTimerAccess(true);
      setTimerFailed(false);
    }
    getLocationTrail(person.user_id, date)
      .then((d) => {
        if (!live) return;
        setTrail({ date, points: d.points, at: Date.now() });
        setError(null);
      })
      .catch((e) => {
        if (!live || background) return; // a failed poll keeps the last good trail
        const refused = e instanceof ApiError && e.status === 403;
        setDenied(refused);
        setError(
          refused
            ? "You don't have access to this employee's location."
            : "Couldn't load this employee's location trail.",
        );
      })
      .finally(() => live && setLoading(false));
    getUserTimesheet(person.user_id, date, date)
      .then((g) => {
        if (!live) return;
        const day = g.days.find((d) => d.date === date);
        setSessions(
          (day?.entries ?? []).map((e) => ({ start: e.start, end: e.end })),
        );
        setTimerAccess(true);
        setTimerFailed(false);
      })
      .catch((e) => {
        if (!live || background) return; // a failed poll keeps the sessions already read
        // 403 is a permission boundary; anything else is a failed read. Neither is "no sessions",
        // which made every picked time "the timer was not running" (WP-292).
        if (e instanceof ApiError && e.status === 403) setTimerAccess(false);
        else setTimerFailed(true);
        setSessions(null);
      });
    return () => {
      live = false;
    };
  }, [person.user_id, date, nonce, isBackground]);

  const currentPoints = trail && trail.date === date ? trail.points : null;
  const points = useMemo(() => currentPoints ?? [], [currentPoints]);
  const last = points.length > 0 ? points[points.length - 1] : null;

  // The moment the trail was read — one instant for every judgement on the page.
  const now = trail?.at ?? 0;
  const status = deriveStatus(last?.captured_at ?? null, points.length, now);
  const online = status === "online";
  const mode = deriveMode(last ? toGeoPoint(last) : null, fence, fenceOn, last?.accuracy_m);

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
    // No read yet to judge against: a running session's end is "now", so judging early could call
    // it "timer off".
    if (now === 0) return null;
    // Later than the trail's read: nothing has been — or could have been — recorded for it yet.
    if (askedAtMs > now) return { kind: "future" };
    if (!timerAccess || timerFailed) {
      // The timer's state is unknown: report position only, assert nothing about the timer.
      let last: LocationPoint | null = null;
      for (const p of points) {
        if (p.captured_at > askedAtMs) break;
        last = p;
      }
      return { kind: "unknown", point: last, reason: timerAccess ? "error" : "no-access" };
    }
    if (sessions === null) return null; // still loading
    const session = sessionAt(sessions, askedAtMs, now);
    if (!session) return { kind: "timer-off" };
    const point = positionInSession(points, askedAtMs, session);
    return point
      ? { kind: "located", point, session }
      : { kind: "no-capture", session };
  }, [askedAtMs, timerAccess, timerFailed, sessions, points, now]);

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

  // Inside `true`, outside `false`, and `null` when there is no perimeter **or the fix is too coarse
  // to place** — a fix is only called outside beyond its own accuracy (WP-291).
  const insideOf = useMemo(
    () =>
      (p: LocationPoint): boolean | null => {
        if (!fenceOn) return null;
        const verdict = perimeterVerdict(toGeoPoint(p), p.accuracy_m, fence);
        return verdict === "uncertain" ? null : verdict === "inside";
      },
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
        accuracyM: points[0].accuracy_m,
      });
    }
    if (last && points.length > 1) {
      out.push({
        id: "last",
        point: toGeoPoint(last),
        variant: online ? "current" : "default",
        name: `${online ? "Current" : "Last seen"} · ${fmtTime(last.captured_at)}`,
        alert: currentInside === false,
        accuracyM: last.accuracy_m,
      });
    }
    if (momentPoint) {
      out.push({
        id: "moment",
        point: toGeoPoint(momentPoint),
        variant: "moment",
        name: `At ${time} · recorded ${fmtTime(momentPoint.captured_at)}`,
        accuracyM: momentPoint.accuracy_m,
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
          <UserAvatar
            userId={person.user_id}
            name={person.name}
            className="size-14 shrink-0"
            fallbackClassName="text-base"
          />
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
                <Users className="size-3.5" /> {departmentName || "Unassigned"}
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
        ) : momentState.kind === "future" ? (
          <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4 shrink-0" />
            {time} hasn&apos;t happened yet on {dateLabel(date)}.
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
              ? `Last known position at ${time} · recorded ${fmtTime(momentState.point.captured_at)}. ${
                  momentState.reason === "no-access"
                    ? "Timer status needs time-tracking access."
                    : "The timesheet couldn't be read, so whether the timer was running is unknown."
                }`
              : `No location recorded at or before ${time} on ${dateLabel(date)}.${
                  momentState.reason === "error"
                    ? " The timesheet couldn't be read, so whether the timer was running is unknown."
                    : ""
                }`}
            {momentState.reason === "error" ? (
              <Button variant="ghost" size="sm" className="h-7" onClick={reload}>
                Try again
              </Button>
            ) : null}
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
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
            {error}
            {denied ? null : (
              <Button variant="outline" size="sm" onClick={reload}>
                Try again
              </Button>
            )}
          </CardContent>
        </Card>
      ) : trail === null ? (
        // Only the first read replaces the map with a loader. After that a new day loads under a
        // map that stays mounted — swapping it out rebuilt the WebGL map, its style and tiles on
        // every day stepped through (QA audit 2026-10-08, WP-287).
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
                // Re-centres when the day's trail arrives (the map now outlives a date change),
                // never on a poll of the same day.
                recenterKey={`${person.user_id}-${date}-${time}-${currentPoints === null ? "loading" : "ready"}`}
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
              {currentPoints === null || (loading && currentPoints.length === 0) ? (
                <Loader label={`Loading ${dateLabel(date)}…`} />
              ) : (
                <LocationTimeline
                  points={points}
                  online={online}
                  moment={moment}
                  distanceFromOffice={distFrom}
                />
              )}
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

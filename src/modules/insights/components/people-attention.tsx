"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, CalendarOff, Check, ChevronLeft, ChevronRight, Clock, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { cn } from "@/lib/utils";
import {
  getDayOversight,
  type ApiDayUser,
} from "@/modules/attendance/services/attendance.service";
import { listAllEmployees } from "@/modules/employees/services/employees.service";
import { contributorRoleIds } from "@/modules/roles/services/roles.service";

/**
 * People to check in on — the two attendance facts a manager actually acts on, not a productivity
 * ranking:
 *  - **Absent without approved leave** — `AttendanceDay.status === "absent"`. Status is *computed* by
 *    the 00:15 close from working hours **and approved leave** (attendance_close), so an approved-leave
 *    day resolves to `leave`, never `absent`; `absent` therefore already means "didn't show, and didn't
 *    apply for leave".
 *  - **Worked a partial day** — `status === "partial"`, the close's "present-with-little-time" verdict:
 *    they clocked in but for fewer hours than a full workday.
 *
 * Both come from one `GET /v1/attendance/day`, names resolved from the directory. Attendance is only
 * closed for **past** days (today resolves after 00:15), so the card defaults to the most recent closed
 * workday and says so rather than showing an empty "today". Real, monitoring-fed — empty is an honest
 * "everyone was accounted for", never a fabricated flag.
 */

type Kind = "all" | "absent" | "partial";
const FILTERS: Kind[] = ["all", "absent", "partial"];
const FILTER_LABEL: Record<Kind, string> = {
  all: "All",
  absent: "Absent",
  partial: "Low hours",
};

interface CheckIn {
  userId: string;
  name: string;
  kind: "absent" | "partial";
}

function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y!, (m ?? 1) - 1, (d ?? 1) + days));
}
/** `2026-08-13` → `"Wed, Aug 13"`. */
function longDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** A plain-language sentence for the header brief. */
function summary(absent: number, partial: number): string {
  const parts: string[] = [];
  if (absent > 0)
    parts.push(
      `${absent} ${absent === 1 ? "person was" : "people were"} absent without approved leave`,
    );
  if (partial > 0)
    parts.push(`${partial} worked a partial day`);
  return parts.join(" and ");
}

export function PeopleAttentionCard({
  title = "People to check in on",
  date: controlledDate,
  onDateChange,
}: {
  title?: string;
  /**
   * The day to show, when a page owns the date.
   *
   * Given one, this card renders **no date control of its own** — the AI reports tab used to have
   * two pagers that drifted apart, so it would show an executive summary for one day above a
   * check-in list for another. Omit it and the card manages its own date exactly as before, which
   * is what the tests and any standalone use rely on.
   */
  date?: string;
  onDateChange?: (date: string) => void;
}) {
  const controlled = controlledDate !== undefined;
  const [ownDate, setOwnDate] = useState<string>("");
  const date = controlled ? controlledDate : ownDate;
  /**
   * The most recent closed day that actually has rows.
   *
   * Uncontrolled, this is what the card opens on. Controlled, the page decides the day — usually
   * today, which is never closed — so this becomes the one-click way out of the "not closed yet"
   * state rather than something the card silently does behind the page's back.
   */
  const [suggested, setSuggested] = useState<string>("");
  const [filter, setFilter] = useState<Kind>("all");
  /**
   * `closed` distinguishes "loaded, nobody to flag" from "this day hasn't been closed yet";
   * `failed` a read that didn't answer at all; `nonWorkday` a closed day nobody was scheduled for;
   * `counts` what the unflagged rest of the day actually was.
   */
  const [state, setState] = useState<{
    people: CheckIn[];
    closed: boolean;
    failed?: boolean;
    nonWorkday?: boolean;
    counts?: { present: number; leave: number };
  } | null>(null);
  const [nonce, setNonce] = useState(0);
  const today = isoOf(new Date());

  // Default to the most recent **closed** workday: today isn't resolved until the 00:15 cron, so
  // showing it would be a permanently-empty "today". Walk back up to a week for the first day the
  // oversight actually returns rows — **one day at a time**, stopping at the first hit: firing all
  // seven at once on mount was the burst the 3-lane cap exists to prevent (QA audit 2026-10-08,
  // WP-295), and the answer is nearly always yesterday.
  useEffect(() => {
    let live = true;
    (async () => {
      let best = today;
      for (let n = 0; n < 7; n++) {
        const d = shiftIso(today, -n);
        const has = await getDayOversight(d)
          .then((r) => r.users.length > 0)
          .catch(() => false);
        if (!live) return;
        if (has) {
          best = d;
          break;
        }
      }
      setSuggested(best);
      if (!controlled) setOwnDate(best);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the selected day's absentees + partial-day people, with names from the directory.
  useEffect(() => {
    if (!date) return;
    let live = true;
    setState(null);
    Promise.all([
      getDayOversight(date).catch(() => null),
      listAllEmployees().catch(() => []),
      contributorRoleIds().catch(() => null),
    ]).then(([day, roster, contributors]) => {
      if (!live) return;
      if (!day) {
        // A failed read says it failed. It used to be reported as "This day isn't closed yet" —
        // for a date last week (QA audit 2026-10-08, WP-295).
        setState({ people: [], closed: false, failed: true });
        return;
      }
      const nameOf = new Map(roster.map((e) => [e.user_id, e.name] as const));
      // Only people who can actually attend in the tracked sense. An Owner/Admin holds no
      // `TimeTrackSelf`, never clocks in, and so is resolved `absent` on every working day — a
      // permanent, meaningless entry at the top of an attention list. Keyed on the permission, not
      // `is_owner`, so an owner who really is a contributor still appears.
      //
      // Fails OPEN: if the roles read failed or the roster is empty we cannot tell, and silently
      // emptying this list would read as "nobody needs attention" rather than "couldn't check".
      const canTell = contributors !== null && roster.length > 0;
      const tracked = new Set(
        roster.filter((e) => e.role_id && contributors?.has(e.role_id)).map((e) => e.user_id),
      );
      const isTracked = (userId: string) => !canTell || tracked.has(userId);
      const people: CheckIn[] = day.users
        .filter(
          (u: ApiDayUser) =>
            (u.status === "absent" || u.status === "partial") && isTracked(u.user_id),
        )
        .map((u: ApiDayUser) => ({
          userId: u.user_id,
          name: nameOf.get(u.user_id) ?? "An employee",
          kind: u.status === "absent" ? ("absent" as const) : ("partial" as const),
        }))
        // Absent (didn't show at all) before partial (showed, but short).
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "absent" ? -1 : 1));
      // What the rest of the day was, so an empty list is described rather than assumed: a closed
      // day with nobody flagged used to read "everyone was present for a full day" — on a Sunday,
      // and on a day everyone was on leave (WP-295).
      const trackedRows = day.users.filter((u: ApiDayUser) => isTracked(u.user_id));
      setState({
        people,
        closed: day.users.length > 0,
        nonWorkday:
          trackedRows.length > 0 && trackedRows.every((u) => u.status === "non_workday"),
        counts: {
          present: trackedRows.filter((u) => u.status === "present").length,
          leave: trackedRows.filter((u) => u.status === "leave").length,
        },
      });
    });
    return () => {
      live = false;
    };
  }, [date, nonce]);

  const people = state?.people ?? [];
  const absentCount = people.filter((p) => p.kind === "absent").length;
  const partialCount = people.filter((p) => p.kind === "partial").length;
  const visible = people.filter((p) => filter === "all" || p.kind === filter);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1">
          {/* Counts only for a day that was actually read and closed — "0 absent" is a finding. */}
          <CardTitle>
            {title}
            {state?.closed ? ` (${people.length})` : ""}
          </CardTitle>
          {state?.closed ? (
            <p className="text-xs text-muted-foreground">
              {absentCount} absent · {partialCount} worked less
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {controlled ? null : (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous day"
                disabled={!date}
                onClick={() => setOwnDate((d) => (d ? shiftIso(d, -1) : d))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <DatePicker value={date} max={today} onChange={setOwnDate} className="w-36" />
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next day"
                disabled={!date || date >= today}
                onClick={() => setOwnDate((d) => (d && d < today ? shiftIso(d, 1) : d))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              // A toggle group: the selected chip must be announced, not only coloured (WP-489).
              aria-pressed={filter === f}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-0">
        {/* Factual brief over the day — the two things a manager should follow up on, in one line. */}
        {state && state.closed && people.length > 0 ? (
          <div className="mx-4 flex items-start gap-2.5 rounded-lg bg-feature-tint/60 p-3 text-sm text-foreground">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="flex-1 leading-relaxed">
              On {longDay(date)}, {summary(absentCount, partialCount)} — worth a check-in.
            </p>
          </div>
        ) : null}

        {state === null ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            <Loader label="Reading attendance…" />
          </div>
        ) : state.failed ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't read attendance"
            description={`Attendance for ${longDay(date)} couldn't be loaded, so there's no telling who needs a check-in.`}
            className="m-4 border-0"
            action={
              <Button variant="outline" size="sm" onClick={() => setNonce((n) => n + 1)}>
                Try again
              </Button>
            }
          />
        ) : !state.closed ? (
          // Today is never closed, and with the page owning the date that is the default view —
          // so this state needs a way *out*, not just an explanation. `suggested` is the most
          // recent day that actually has rows, which is the day the reader wanted.
          <EmptyState
            icon={CalendarClock}
            title="This day isn't closed yet"
            description={
              controlled
                ? "Attendance resolves after the 00:15 close, so today has nothing to show yet. Pick an earlier date above — that's where absences and short days appear."
                : "Attendance resolves after the 00:15 close. Use ‹ to review a past day — that's where absences and short days show up."
            }
            className="m-4 border-0"
            action={
              controlled && suggested && suggested !== date && onDateChange ? (
                <Button variant="outline" size="sm" onClick={() => onDateChange(suggested)}>
                  Show {longDay(suggested)}
                </Button>
              ) : undefined
            }
          />
        ) : people.length === 0 && state.nonWorkday ? (
          <EmptyState
            icon={CalendarOff}
            title="Not a working day"
            description={`Nobody was scheduled to work on ${longDay(date)}, so there are no absences or short days to review.`}
            className="m-4 border-0"
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Check}
            title={people.length === 0 ? "Everyone's accounted for" : "None at this filter"}
            description={
              people.length === 0
                ? `No unapproved absences and no partial days on ${longDay(date)}${
                    state.counts
                      ? ` — ${state.counts.present} present${
                          state.counts.leave > 0 ? `, ${state.counts.leave} on approved leave` : ""
                        }`
                      : ""
                  }.`
                : "No one matches this filter for the selected day."
            }
            className="m-4 border-0"
          />
        ) : (
          <div className="divide-y">
            {visible.map((p) => (
              <CheckInItem key={p.userId} row={p} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CheckInItem({ row }: { row: CheckIn }) {
  const absent = row.kind === "absent";
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          absent ? "bg-destructive" : "bg-warning",
        )}
      />
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
          absent ? "bg-destructive/12 text-destructive" : "bg-warning/15 text-warning",
        )}
      >
        {absent ? <UserX className="size-4" /> : <Clock className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{row.name}</span>
          <Badge
            className={
              absent ? "bg-destructive/12 text-destructive" : "bg-warning/15 text-warning"
            }
          >
            {absent ? "Absent" : "Low hours"}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {absent
            ? "Absent — no leave applied for this day."
            : "Worked a partial day — fewer hours than a full workday."}
        </p>
      </div>
    </div>
  );
}

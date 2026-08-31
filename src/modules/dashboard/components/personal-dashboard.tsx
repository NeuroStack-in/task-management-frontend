"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Clock,
  ListChecks,
  FolderKanban,
  ArrowRight,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { TimerStatCard } from "./timer-stat-card";
import { MeetingHoursCard } from "@/modules/integrations/components/meeting-hours-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/shared/loader";
import { MyTasksCard } from "./my-tasks-card";
import { useMyWork } from "../use-my-work";
import { useWeekTracked } from "../use-week-tracked";
import { useMyAttendance, ymd, type DayRecord } from "@/modules/attendance/use-my-attendance";
import { useIsSurfaceOn } from "@/hooks/use-features";
import { useAssistantPageContext } from "@/stores/page-context.store";
import { cn } from "@/lib/utils";
import { useWorkingHours } from "@/hooks/use-working-hours";
import { usePoll } from "@/hooks/use-poll";
import { LIVE_REFRESH_MS } from "@/hooks/use-live-refresh";

const ATTENDANCE: Record<string, { dot: string; label: string }> = {
  present: { dot: "bg-success", label: "Present" },
  partial: { dot: "bg-warning", label: "Partial" },
  leave: { dot: "bg-primary", label: "On leave" },
  absent: { dot: "bg-destructive", label: "Absent" },
  non_workday: { dot: "bg-muted-foreground/40", label: "Non-working day" },
  // Not a stored status. Today has no attendance record until the nightly close stamps one, so a
  // day being worked right now would otherwise read "No record" while its timer runs. This says
  // what is actually known: work is happening, and the verdict is not in yet.
  in_progress: { dot: "bg-success animate-pulse", label: "Working now" },
  tracked_today: { dot: "bg-success", label: "Tracked today" },
};
const attMeta = (s: string) => ATTENDANCE[s] ?? { dot: "bg-muted-foreground/40", label: s };

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The card's own status set: the server's, plus two the server never stores.
 *
 * Today has no attendance record until the nightly close writes one, so its row is synthesised from
 * live sessions. Widening the type here — rather than casting a synthetic value into
 * `AttendanceStatus` — is what lets the renderer branch on them and keeps the compiler able to see
 * that they are not real attendance verdicts.
 */
type LiveStatus = DayRecord["status"] | "in_progress" | "tracked_today";
type LiveRecord = Omit<DayRecord, "status"> & { status: LiveStatus };

/**
 * `H:MM:SS` for a day still in progress.
 *
 * Seconds are the point: a running row has to visibly move, or it reads as stale beside the timer
 * tile. Finished days keep the decimal-hours form — nobody needs the second a Tuesday ended, and a
 * column of `6:47:12` would be harder to compare than `6.8h`.
 */
function liveClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
export function PersonalDashboard() {
  const { openTasks, doneCount, myProjects, loading } = useMyWork();
  const isSurfaceOn = useIsSurfaceOn();
  // These surfaces are gated: Time Tracking (the timer tile) and Projects (task/project cards + the
  // work sections below). Hidden when the org switched the feature off, or its tracking mode hides
  // it (MANAGED-AGENT.md §8). Grid children auto-flow, so dropping cards leaves no hole.
  const showTimer = isSurfaceOn("time.tracking");
  const showProjects = isSurfaceOn("projects");

  // Compute the trailing 7-day window on the client (real "today"); render it only after mount to
  // avoid an SSR/client date mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const week = useMemo(() => {
    // **The calendar week, Monday→Sunday** — not a trailing 7 days ending today.
    //
    // It used to be `base.getDate() - (6 - i)`, which put today last and started the list six days
    // earlier. On a Monday that rendered Tue, Wed, Thu, Fri, Sat, Sun, Mon — and, worse than the odd
    // order, the total under a "This week" heading was almost entirely LAST week's hours. A heading
    // that names a period has to sum that period.
    //
    // Monday-first matches the team timesheet grid, so the two never disagree about which days
    // belong to a week.
    const base = new Date();
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((base.getDay() + 6) % 7)); // Sunday (0) → back 6, not forward 1
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        key: ymd(d.getFullYear(), d.getMonth(), d.getDate()),
        y: d.getFullYear(),
        m: d.getMonth(),
        day: d.getDate(),
        label: SHORT_DAY[d.getDay()],
        /** Raw JS weekday (0=Sun), for matching the org's `workdays` config. */
        jsDay: d.getDay(),
      };
    });
  }, []);
  const att = useMyAttendance(week[0].key, week[6].key);
  // Logged timer time across the window, **including the session running right now**.
  //
  // This used to sum the attendance records above, whose `hours` come from `worked_minutes` — a
  // figure the nightly close stamps. Today therefore contributed nothing however long the timer had
  // been running, so someone three hours into a session saw this tile sitting unchanged next to a
  // live timer counting up: two numbers about the same work, disagreeing on screen.
  const tracked = useWeekTracked(week[0].key, week[6].key);

  const todayKeyRef = ymd(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  // Keep the card live. Attendance changes while someone is working — a clock-in flips "No record"
  // to Present, and today's hours climb — so a card rendered once at page load goes stale in front
  // of whoever is looking at it, and the number beside a running timer stops matching it.
  //
  // `usePoll` is the sanctioned primitive: it pauses while the tab is hidden and re-fetches on
  // return, so a dashboard left open overnight does not spend the night polling. `reload` refreshes
  // in place rather than showing a spinner, which is what makes a 30-second cadence unobtrusive.
  usePoll(att.reload, LIVE_REFRESH_MS);

  // **Working days only.** A weekend row that says "Non-working day" is a line telling you nothing
  // happened on a day nothing was meant to happen — two of seven rows spent saying so.
  //
  // Driven by the org's configured `workdays`, not by a weekend assumption: an org that works
  // Sunday-to-Thursday gets its own days, and the same config decides `non_workday` server-side, so
  // the card and the attendance record can never disagree about which days count.
  //
  // Falls back to showing everything until the config loads, rather than briefly hiding real rows.
  const workdays = useWorkingHours()?.workdays ?? null;
  const attRows = week
    .map((w) => ({ ...w, record: att.recordFor(w.y, w.m, w.day) }))
    .filter((w) => {
      if (w.record?.status === "non_workday") return false;
      if (!workdays) return true;
      // `IsoWeekday` is 1=Mon…7=Sun; JS `getDay()` is 0=Sun.
      const iso = w.jsDay === 0 ? 7 : w.jsDay;
      return workdays.includes(iso as (typeof workdays)[number]);
    });
  // **Today has no attendance record until the nightly close runs**, so it arrives here as "No
  // record" even while a timer is running against it. The truth for today lives in the TIME#
  // sessions, which `useTimesheet` already reads for the timer tile above — so fill the gap from
  // there rather than showing a worked day as blank.
  //
  // Deliberately NOT guessing `present` vs `partial`: that verdict depends on the org's
  // `min_present_minutes` and is the close's to make. Claiming it here would mean the card
  // disagreeing with the record tomorrow morning. "Working now" / "Tracked today" says exactly what
  // is known — hours were logged, the day is not judged yet.
  // Today's seconds and whether a session is open, from the SAME hook instance that totals the
  // week — it already reads today's sheet for its live top-up. A second instance over a one-day
  // range would have polled the same endpoint twice for the same answer.
  const todayKey = todayKeyRef;
  const todaySec = tracked.todaySec;
  const attRowsLive: Array<Omit<(typeof attRows)[number], "record"> & {
    record: LiveRecord | null;
  }> = attRows.map((w) =>
    w.key === todayKey && !w.record && todaySec > 0
      ? {
          ...w,
          // A full `DayRecord`, not a partial cast: the status is a synthetic one the server never
          // stores, but everything else the row renders must still be present and honest. No clock
          // in/out — the sessions are known, the attendance verdict is not.
          record: {
            status: tracked.running ? "in_progress" : "tracked_today",
            late: false,
            hours: Math.round((todaySec / 3600) * 10) / 10,
            clockIn: "",
            clockOut: "",
          } satisfies LiveRecord,
        }
      : w,
  );
  const daysPresent = attRowsLive.filter((w) => w.record?.status === "present").length;

  const weekHours = Math.round((tracked.totalSec / 3600) * 10) / 10;

  // Publish the viewer's own at-a-glance figures to the assistant.
  useAssistantPageContext({
    facts: [
      ...(showProjects
        ? [
            { label: "My open tasks", value: String(openTasks.length) },
            { label: "Completed tasks", value: String(doneCount) },
            { label: "My projects", value: String(myProjects.length) },
          ]
        : []),
      ...(showTimer
        ? [{ label: "Hours (last 7 days)", value: `${weekHours}h` }]
        : []),
      { label: "Days present this week", value: String(daysPresent) },
    ],
  });

  if (loading && openTasks.length === 0 && myProjects.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader label="Loading your work…" />
      </div>
    );
  }

  return (
    <>
      {/* Personal KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="dash:kpis">
        {showTimer && <TimerStatCard />}
        <MeetingHoursCard />
        <StatCard
          label="Hours this week"
          // "—" until the range has actually been read: a confident 0.0 next to a running timer is
          // worse than an obvious blank.
          value={mounted && tracked.loaded ? weekHours.toFixed(1) : "—"}
          icon={Clock}
          hint="logged on the timer"
          // Points at the timesheet now, not attendance — that is where this number comes from, and
          // sending someone to a page that shows a different figure is how the two get mistrusted.
          href="/time-tracking"
        />
        {showProjects && (
          <>
            <StatCard
              label="Open Tasks"
              value={openTasks.length}
              icon={ListChecks}
              hint={`${doneCount} completed`}
              href="/projects"
            />
            <StatCard
              label="My Projects"
              value={myProjects.length}
              icon={FolderKanban}
              hint="you're a member of"
              href="/projects"
            />
          </>
        )}
      </div>

      {showProjects && (
      <div className="grid gap-4 xl:grid-cols-3">
        {/* My tasks. Shared with the org dashboard — see `my-tasks-card.tsx`. */}
        <MyTasksCard tasks={openTasks} className="xl:col-span-2" />

        {/* This week's attendance */}
        <Card data-tour="dash:week" className="gap-0 p-0 [--card-spacing:0px]">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold tracking-tight">This week</h2>
            <Link
              href="/attendance"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Details <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="space-y-2.5 px-5 py-4">
            {!mounted ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : (
              attRowsLive.map((w) => {
                const meta = w.record ? attMeta(w.record.status) : null;
                return (
                  <div key={w.key} className="flex items-center gap-3 text-sm">
                    <span className="w-9 shrink-0 text-muted-foreground">{w.label}</span>
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        meta?.dot ?? "bg-muted-foreground/20",
                      )}
                    />
                    <span className="flex-1 text-muted-foreground">{meta?.label ?? "No record"}</span>
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        // The running row is the one thing on this card that changes while you
                        // watch it, so it is the one thing that should look like it.
                        w.record?.status === "in_progress" && "text-primary font-medium",
                      )}
                    >
                      {/* A running day shows a CLOCK, not rounded hours.
                          `0.5h` is technically live — the seconds behind it tick — but it only
                          changes on screen every six minutes, which reads as frozen next to a timer
                          that is visibly running. `H:MM:SS` moves every second, so the row and the
                          timer agree at a glance. */}
                      {w.record?.status === "in_progress"
                        ? liveClock(todaySec)
                        : w.record && w.record.hours > 0
                          ? `${w.record.hours.toFixed(1)}h`
                          : "—"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              {/* Out of the working days actually shown, not a hard-coded 7 — the denominator has
                  to match the rows above it. */}
              {mounted ? `${daysPresent}/${attRowsLive.length} days present` : "—"}
            </span>
            {/* **Same notation as the rows above it.** While a session is open the running row
                shows a clock (`2:28:05`) and this showed `2.5h` — the same number, and they agree,
                but `2:28` reads like "2.28" so `2.5h` looks like a different figure sitting right
                underneath it. One notation at a time removes the question.

                Once nothing is running there is no ticking row to match, and decimal hours are the
                easier form to compare across weeks — so it goes back to `2.5h`. */}
            <span
              className={cn(
                "font-medium tabular-nums",
                tracked.running && "text-primary",
              )}
            >
              {!mounted
                ? "—"
                : tracked.running
                  ? `${liveClock(tracked.totalSec)} total`
                  : `${weekHours}h total`}
            </span>
          </div>
        </Card>

        {/* My projects */}
        <Card className="gap-0 p-0 [--card-spacing:0px] xl:col-span-3">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold tracking-tight">My projects</h2>
            <Link
              href="/projects"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              View all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {myProjects.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              You&apos;re not assigned to any projects yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {myProjects.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                  {p.key ? (
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                      {p.key}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                  <Badge variant="outline" className="shrink-0 font-normal capitalize">
                    {p.status.replace(/_/g, " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      )}
    </>
  );
}

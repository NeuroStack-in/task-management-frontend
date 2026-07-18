"use client";

/**
 * Attendance oversight (manager/admin) — on the **live backend**.
 *
 * A month **calendar** of org attendance sits above a **day roster**. Both are fed by one fetch:
 * `useMonthAttendance` fans `GET /v1/attendance/day` out over the month's closed workdays (bounded,
 * see the hook), and each response carries *both* the summary (for the calendar cell) and the roster
 * (for the day view). So clicking a day the calendar already loaded costs no extra request.
 *
 * Days are computed by the 00:15 close cron, so **today is still open** — it resolves after midnight.
 * The default selection is the most recent closed day (yesterday).
 *
 * (Restores the pre-`10bd02d` month calendar, which had been dropped when attendance first went live
 * because it was mock-only. It's real now — the counts come from the day endpoint, not fixtures.)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Clock, CalendarOff, Plane, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type AttendanceStatus } from "../services/attendance.service";
import {
  listEmployees,
  departmentMap,
} from "@/modules/employees/services/employees.service";
import { AttendanceCalendar } from "./attendance-calendar";
import { useMonthAttendance } from "../use-month-attendance";

const STATUS_META: Record<AttendanceStatus, { label: string; dot: string; badge: string }> = {
  present: { label: "Present", dot: "bg-success", badge: "bg-success/12 text-success" },
  partial: { label: "Partial", dot: "bg-warning", badge: "bg-warning/15 text-warning" },
  absent: { label: "Absent", dot: "bg-destructive", badge: "bg-destructive/12 text-destructive" },
  leave: { label: "On leave", dot: "bg-primary", badge: "bg-primary/12 text-primary" },
  non_workday: {
    label: "Non-working",
    dot: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
  },
};

// Guarded lookup — an unmapped status renders neutral instead of crashing the row (the META hazard).
const statusMeta = (s: string) =>
  STATUS_META[s as AttendanceStatus] ?? {
    label: s,
    dot: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
  };

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface DirEntry {
  name: string;
  dept: string;
}

export function OversightAttendanceView() {
  // Selected date drives both the calendar (its month) and the roster (that day). Set client-side to
  // yesterday — the most recent day the close cron has resolved — to avoid an SSR/hydration mismatch.
  const [date, setDate] = useState<string>("");
  const [dept, setDept] = useState("all");
  const [dir, setDir] = useState<Map<string, DirEntry>>(new Map());
  const [dirError, setDirError] = useState<string | null>(null);

  useEffect(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    setDate(isoOf(y));
  }, []);

  // The month the calendar shows follows the selection. Fetch that whole month once.
  const [selY, selM, selD] = useMemo(
    () => (date ? date.split("-").map(Number) : [0, 1, 0]),
    [date],
  );
  const month = useMonthAttendance(date ? selY : 0, date ? selM - 1 : 0);

  // Directory (names + departments) loads once; the day data comes from the month fetch.
  const loadDirectory = useCallback(async () => {
    try {
      const [roster, depts] = await Promise.all([
        listEmployees(),
        departmentMap().catch(() => new Map<string, string>()),
      ]);
      const m = new Map<string, DirEntry>();
      for (const e of roster) m.set(e.user_id, { name: e.name, dept: depts.get(e.department_id) ?? "—" });
      setDir(m);
      setDirError(null);
    } catch {
      setDirError("Couldn't load the employee directory.");
    }
  }, []);
  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const today = isoOf(new Date());
  const isToday = date === today;

  // The selected day comes straight from the month fetch — no extra request.
  const dayResp = date ? month.days.get(date) ?? null : null;

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of dir.values()) if (e.dept && e.dept !== "—") set.add(e.dept);
    return ["all", ...[...set].sort()];
  }, [dir]);

  const rows = useMemo(() => {
    if (!dayResp) return [];
    return dayResp.users
      .map((u) => {
        const entry = dir.get(u.user_id);
        return {
          userId: u.user_id,
          name: entry?.name ?? "Unknown user",
          dept: entry?.dept ?? "—",
          status: u.status,
        };
      })
      .filter((r) => dept === "all" || r.dept === dept)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dayResp, dir, dept]);

  const s = dayResp?.summary;
  const rate = s && s.counted ? Math.round((s.present / s.counted) * 100) : 0;
  const monthLoadingThisDay = month.loading && !dayResp;

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Attendance"
        description="Org attendance by day — pick a date on the calendar to see who was in."
      />

      {/* Calendar — the month of the selected date; click a day to select it. */}
      {date ? (
        <AttendanceCalendar
          selected={{ year: selY, month: selM - 1, day: selD }}
          onSelect={(d) => setDate(`${d.year}-${pad2(d.month + 1)}-${pad2(d.day)}`)}
          days={month.days}
          loading={month.loading}
        />
      ) : null}

      {month.error ? (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm">
          <span className="text-muted-foreground">{month.error}</span>
          <Button variant="outline" size="sm" onClick={month.reload}>Retry</Button>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{date ? prettyDate(date) : ""}</h2>
        {isToday ? (
          <span className="text-xs text-muted-foreground">Today is still open — fills in after midnight.</span>
        ) : null}
      </div>

      {/* Summary for the selected day */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Attendance rate" value={`${rate}%`} icon={CalendarCheck} hint="present / counted" featured />
        <StatCard label="Present" value={s?.present ?? 0} icon={CalendarCheck} hint={`${s?.partial ?? 0} partial`} />
        <StatCard label="Absent" value={s?.absent ?? 0} icon={CalendarOff} hint="no activity" />
        <StatCard label="On leave" value={s?.leave ?? 0} icon={Plane} hint="approved time off" />
      </div>

      {/* Department filter */}
      {departments.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {departments.map((d) => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                dept === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {d === "all" ? "All departments" : d}
            </button>
          ))}
        </div>
      ) : null}

      {/* Roster for the selected day */}
      <Card>
        <CardContent className="p-0">
          {monthLoadingThisDay ? (
            <div className="flex min-h-[24vh] items-center justify-center">
              <Loader label="Loading attendance…" />
            </div>
          ) : dirError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">{dirError}</p>
              <Button variant="outline" size="sm" onClick={loadDirectory}>Retry</Button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No attendance for this day"
              description={
                isToday
                  ? "Today hasn't been closed yet — check back after midnight, or pick an earlier day."
                  : "No employees have a resolved attendance record for this date."
              }
              className="m-4 border-0"
            />
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const meta = statusMeta(r.status);
                return (
                  <li key={r.userId} className="flex items-center gap-3 px-5 py-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">{initials(r.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.dept}</p>
                    </div>
                    <Badge className={cn("font-medium", meta.badge)}>
                      <span className={cn("mr-1.5 size-1.5 rounded-full", meta.dot)} />
                      {meta.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {dayResp ? (
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          {dayResp.users.length} employee{dayResp.users.length === 1 ? "" : "s"} with a record ·{" "}
          {s?.counted ?? 0} counted toward the rate
        </p>
      ) : null}
    </div>
  );
}

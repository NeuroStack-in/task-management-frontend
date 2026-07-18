"use client";

/**
 * Attendance oversight (manager/admin) — on the **live backend**.
 *
 * The server serves one day at a time, **status only** (`GET /v1/attendance/day?date=` reads GSI3,
 * which projects a user's status and nothing else — no hours, no punches). So this is deliberately a
 * *day view*: pick a date, see each employee's status + a summary. The mock's multi-day heatmap and
 * per-person hours log are gone because there is no endpoint behind them — a per-person history is the
 * personal view (`/v1/me/attendance`), not this.
 *
 * Days are computed by the 00:15 close cron, so **today is still open** — it resolves after midnight.
 * The default lands on the most recent closed day (yesterday).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  Clock,
  CalendarOff,
  Plane,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import {
  getDayOversight,
  type ApiDayResponse,
  type AttendanceStatus,
} from "../services/attendance.service";
import {
  listEmployees,
  departmentMap,
} from "@/modules/employees/services/employees.service";

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

const statusMeta = (s: string) =>
  STATUS_META[s as AttendanceStatus] ?? {
    label: s,
    dot: "bg-muted-foreground/40",
    badge: "bg-muted text-muted-foreground",
  };

/** Local `YYYY-MM-DD` (client calendar — the backend keys days by the caller's local date). */
function isoOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + days));
}
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
  // Default date is set client-side (avoids SSR/hydration mismatch) to yesterday — the most recent
  // day the close cron has resolved. Empty until the effect runs.
  const [date, setDate] = useState<string>("");
  const [dept, setDept] = useState("all");
  const [day, setDay] = useState<ApiDayResponse | null>(null);
  const [dir, setDir] = useState<Map<string, DirEntry>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDate(shiftIso(isoOf(new Date()), -1));
  }, []);

  // Directory (names + departments) loads once; the day roster re-fetches per date.
  const loadDirectory = useCallback(async () => {
    const [roster, depts] = await Promise.all([
      listEmployees(),
      departmentMap().catch(() => new Map<string, string>()),
    ]);
    const m = new Map<string, DirEntry>();
    for (const e of roster) {
      m.set(e.user_id, { name: e.name, dept: depts.get(e.department_id) ?? "—" });
    }
    return m;
  }, []);

  const load = useCallback(
    (iso: string) => {
      let live = true;
      setLoading(true);
      setError(null);
      Promise.all([getDayOversight(iso), dir.size ? Promise.resolve(dir) : loadDirectory()])
        .then(([resp, directory]) => {
          if (!live) return;
          setDay(resp);
          if (!dir.size) setDir(directory);
        })
        .catch((e) => {
          if (live) setError(messageOf(e));
        })
        .finally(() => {
          if (live) setLoading(false);
        });
      return () => {
        live = false;
      };
    },
    [dir, loadDirectory],
  );

  useEffect(() => {
    if (date) return load(date);
  }, [date, load]);

  const today = isoOf(new Date());
  const isToday = date === today;

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of dir.values()) if (e.dept && e.dept !== "—") set.add(e.dept);
    return ["all", ...[...set].sort()];
  }, [dir]);

  const rows = useMemo(() => {
    if (!day) return [];
    return day.users
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
  }, [day, dir, dept]);

  const s = day?.summary;
  const rate = s && s.counted ? Math.round((s.present / s.counted) * 100) : 0;

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Attendance"
        description="Each employee's status for the selected day, computed after midnight."
      />

      {/* Day navigator */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => setDate((d) => (d ? shiftIso(d, -1) : d))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Next day"
            disabled={!date || date >= today}
            onClick={() => setDate((d) => (d && d < today ? shiftIso(d, 1) : d))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDate(shiftIso(today, -1))}
          >
            Latest
          </Button>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-sm text-muted-foreground">{date ? prettyDate(date) : ""}</span>
        </div>
      </div>

      {isToday ? (
        <p className="rounded-lg border border-dashed border-warning/40 bg-warning/5 px-4 py-2 text-xs text-muted-foreground">
          Today is still open — attendance is computed by the overnight close, so today&apos;s row
          fills in after midnight.
        </p>
      ) : null}

      {/* Summary */}
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
                dept === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {d === "all" ? "All departments" : d}
            </button>
          ))}
        </div>
      ) : null}

      {/* Roster */}
      <Card>
        <CardContent className="p-0">
          {loading && !day ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Loader label="Loading attendance…" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={() => date && load(date)}>
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No attendance for this day"
              description={
                isToday
                  ? "Today hasn't been closed yet — check back after midnight."
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

      {day ? (
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          {day.users.length} employee{day.users.length === 1 ? "" : "s"} with a record ·{" "}
          {s?.counted ?? 0} counted toward the rate
        </p>
      ) : null}
    </div>
  );
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to team attendance.";
    return e.message;
  }
  return "Couldn't load attendance. Check your connection and retry.";
}

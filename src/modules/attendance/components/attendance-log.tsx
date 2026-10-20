"use client";

/**
 * `AttendanceLog` — the per-employee roster table for the attendance oversight page, on the **live
 * backend**. Rows arrive already scoped, aggregated and department-filtered from
 * `useOversightAttendance` (Today = live fleet presence; a single day = that day's per-person status;
 * a week/month/custom span = per-employee present-rate across the closed workdays). This component is
 * pure presentation over those rows: search, column sort, status filter, CSV export, pagination — no
 * data of its own, no invented punches or hours (the attendance index carries neither).
 *
 * `LogDatePicker` — a compact month calendar in a dropdown, used to pick a single (non-future) day.
 * It carries no attendance data and is shared by the oversight overview and the personal attendance
 * view, so it stays exported here.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useNow } from "@/hooks/use-now";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatHoursOff } from "@/modules/leave/lib/days";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { downloadBlob } from "@/lib/download";
import { isFutureDate, monthMatrix, MONTH_NAMES, WEEKDAY_LABELS } from "../lib/calendar";
import { formatTimeOfDay } from "../lib/clock";
import { formatDate, formatMinutes } from "@/lib/format";
import { useToday } from "../use-today";
import type {
  OversightMode,
  OversightRow,
} from "../use-oversight-attendance";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";
import { toCsv } from "@/lib/csv";
import { DayOverrideDialog, type DayOverrideTarget } from "./day-override-dialog";

/* ────────────────────────── Attendance log ────────────────────────── */

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  present: { label: "Present", badge: "bg-success/12 text-success", dot: "bg-success" },
  partial: { label: "Partial", badge: "bg-warning/15 text-warning", dot: "bg-warning" },
  leave: { label: "On leave", badge: "bg-primary/12 text-primary", dot: "bg-primary" },
  absent: { label: "Absent", badge: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
  non_workday: { label: "Non-working", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" },
  // An admin excused the day — neither present nor absent, and counted in neither (WP-257).
  excused: { label: "Excused", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  in: { label: "In now", badge: "bg-success/12 text-success", dot: "bg-success" },
  out: { label: "Out", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" },
};

// Guarded — an unmapped status renders neutral instead of crashing the row.
const statusMeta = (s: string) =>
  STATUS_META[s] ?? { label: s, badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" };

/**
 * The live "today" attendance classification (a column of its own, distinct from the In/Out status).
 * Today has no closed verdict, so this is derived in `useOversightAttendance` from approved leave +
 * clock-in vs the org's "Late after" time — see `OversightRow.todayStatus`.
 */
const TODAY_STATUS_META: Record<
  NonNullable<OversightRow["todayStatus"]>,
  { label: string; badge: string; dot: string }
> = {
  leave: { label: "On leave", badge: "bg-primary/12 text-primary", dot: "bg-primary" },
  // A holiday, or an unscheduled day they didn't work — not expected, so never "Absent" (WP-254).
  off: { label: "Day off", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" },
  // Expected, no session yet, and it's still before "Late after" — neutral, not red (TIME-11).
  not_in_yet: {
    label: "Not in yet",
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
  absent: { label: "Absent", badge: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
  late: { label: "Late", badge: "bg-warning/15 text-warning", dot: "bg-warning" },
  present: { label: "On time", badge: "bg-success/12 text-success", dot: "bg-success" },
};

/**
 * Sort weight per status — who a manager needs to see first, not alphabetical order.
 *
 * Explicit because the previous comparator sorted on the *label*, so the useful ordering was an
 * accident of spelling ("In now" < "Out") that any future rename would silently reverse. Unknown
 * statuses sort last rather than crashing, matching `statusMeta`'s guard.
 */
const STATUS_RANK: Record<string, number> = {
  in: 0,
  present: 1,
  partial: 2,
  leave: 3,
  absent: 4,
  out: 5,
  excused: 6,
  non_workday: 7,
};
const statusRank = (s?: string) => STATUS_RANK[s ?? ""] ?? 99;

/**
 * Epoch ms → the viewer's clock, or `—`. Client-only (the log renders after mount), so no SSR skew.
 * Not a forced 24-hour clock: every time on the time and attendance pages now follows the viewer's
 * locale (UX audit 2026-10-16, TIME-14).
 */
const fmtTime = (ms?: number) => (ms ? formatTimeOfDay(ms) : "—");
/**
 * Worked minutes → `HH:MM:SS`, or `—`. It was one-decimal hours ("7.5") while the personal page and
 * the timesheet beside it said "07:30:00" for the same kind of amount (UX audit 2026-10-16, TIME-14).
 */
const fmtHours = (mins?: number) => (mins && mins > 0 ? formatMinutes(mins) : "—");
/**
 * Live worked hours for a row. A running row ticks as its completed sessions plus the open one,
 * counted from that session's own start (`runningSince`) — exact after a break and a restart, where
 * it used to freeze until the timer stopped (QA audit 2026-10-08, WP-480). Without `runningSince`
 * (an older server) only a single-session row can tick, from `clockIn` — which is then the open
 * session's start. Any other row shows its settled worked minutes; `—` when there's nothing.
 */
const fmtRowHours = (
  r: {
    running?: boolean;
    runningSince?: number;
    entryCount?: number;
    clockIn?: number;
    workedMinutes?: number;
  },
  now: number,
): string => {
  if (r.running && typeof r.runningSince === "number") {
    const mins = (r.workedMinutes ?? 0) + Math.max(0, (now - r.runningSince) / 60_000);
    return fmtHours(mins);
  }
  if (r.running && r.entryCount === 1 && typeof r.clockIn === "number") {
    return fmtHours(Math.max(0, (now - r.clockIn) / 60_000));
  }
  return fmtHours(r.workedMinutes);
};

/**
 * Anchor for deep links into this section — the dashboard's employee KPI cards land here.
 *
 * Exported so the two sides cannot drift: a link built from a hand-typed string keeps working right
 * up until someone renames the id, and then fails by silently landing at the top of the page, which
 * looks like the link "sort of" working.
 */
export const ATTENDANCE_LOG_ANCHOR = "attendance-log";

const PAGE_SIZE = 10;
type SortKey = "name" | "rate" | "status";

/**
 * The "on permission" filter's value. A sentinel rather than a status string, because permission is
 * orthogonal to the status column — a person can be Present and on permission at the same time.
 */
const PERMISSION = "__permission";
// The `__` prefix keeps it from colliding with any real status the server may add. The cost is that
// it is not a label: `statusMeta` falls back to `label: s` for values it does not know — correct for
// an unrecognised server status, but it printed "__permission · 1" on the chip. Every render path
// must special-case it *before* `statusMeta`; there is only one, just below.

/**
 * `90` → "1 h 30 min off". Approved short time off within a day — the API's `permission` kind. It
 * read "Permission 01:30:00": HR jargon over a stopwatch reading (UX audit 2026-10-16, TIME-08).
 */
function formatPermission(minutes: number): string {
  return formatHoursOff(minutes);
}

/** Statuses a day correction is offered on: a false absence (or short day), or an earlier correction. */
const CORRECTABLE = new Set(["absent", "partial", "excused"]);

export function AttendanceLog({
  rows: rowsIn,
  mode,
  loading,
  error,
  label,
  note,
  correction,
}: {
  rows: OversightRow[];
  mode: OversightMode;
  loading: boolean;
  error: string | null;
  label: string;
  note: string | null;
  /**
   * The day-correction for a closed past day (`DayOverrideDialog`) — set by the page for
   * `attendance:edit` holders, in any tracking mode. Adds a Correct action to absent, partial and
   * excused rows; `onSaved` re-reads the day.
   */
  correction?: { date: string; onSaved: () => void } | null;
}) {
  const router = useRouter();
  // Corrections made here show at once: the day's roster comes from an index that settles a moment
  // after the write, so the re-read alone could still show the old status.
  const correctionDate = correction?.date ?? null;
  const [corrected, setCorrected] = useState<{
    date: string;
    byUser: ReadonlyMap<string, string>;
  }>({ date: "", byUser: new Map() });
  const [correcting, setCorrecting] = useState<DayOverrideTarget | null>(null);
  const rows = useMemo(() => {
    if (correctionDate === null || corrected.date !== correctionDate) return rowsIn;
    return rowsIn.map((r) => {
      const s = corrected.byUser.get(r.userId);
      return s ? { ...r, status: s } : r;
    });
  }, [rowsIn, correctionDate, corrected]);
  const isRange = mode === "range";
  // Today has no closed verdict, so it gets the extra live-classification column (leave/absent/late).
  const isToday = mode === "today";

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  // Ticks the running rows' live hours (see fmtRowHours). Table-wide, so one interval, not per-row.
  const now = useNow();
  // Today's roster leads with whoever is working right now — that is the question the live view is
  // open to answer, and alphabetical order buries it (four In-now people scattered through seven
  // Out rows). Name stays the tiebreak, and the column headers still re-sort on demand. A past day
  // is a record rather than a live board, so it opens alphabetically.
  //
  // A sort picked by hand belongs to the kind of table it was picked on: the log is not remounted
  // when the window changes, so Today's status sort used to carry into a past day and a range table
  // that has no status column (QA audit 2026-10-08, WP-259).
  const [sortPick, setSortPick] = useState<{
    mode: OversightMode;
    key: SortKey;
    dir: "asc" | "desc";
  } | null>(null);
  const sort: { key: SortKey; dir: "asc" | "desc" } =
    sortPick && sortPick.mode === mode
      ? sortPick
      : { key: mode === "today" ? "status" : "name", dir: "asc" };
  const [page, setPage] = useState(0);

  // Reset paging when the underlying window changes.
  useEffect(() => setPage(0), [label, mode]);

  /**
   * Honour `#attendance-log` once the table is actually on screen.
   *
   * The browser's own hash scroll fires on navigation, before this section has data — at that point
   * the card is a loading spinner a few rows tall, so it either scrolls nowhere or lands on a box
   * that then grows and pushes the content off-screen. Waiting for `loading` to clear means the
   * element is its real height before we move to it.
   *
   * `getElementById`, not a ref: `Card` is a plain function component and does not forward refs, so
   * a ref here would warn in development and be null in production.
   */
  const scrolledToAnchor = useRef(false);
  useEffect(() => {
    if (loading || scrolledToAnchor.current) return;
    if (window.location.hash !== `#${ATTENDANCE_LOG_ANCHOR}`) return;
    // Once per mount. Without the latch every later re-render that flips `loading` — a filter
    // change, a poll — would yank the page back down while someone is reading it.
    scrolledToAnchor.current = true;
    document
      .getElementById(ATTENDANCE_LOG_ANCHOR)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading]);

  // Status chips only make sense for a per-person status column (day / today), not a rate column.
  const statusOptions = useMemo(() => {
    if (isRange) return [];
    const seen = new Set<string>();
    for (const r of rows) if (r.status) seen.add(r.status);
    const order = ["present", "partial", "leave", "absent", "excused", "non_workday", "in", "out"];
    const opts = ["all", ...order.filter((s) => seen.has(s))];
    // **Permission is not a status.** Someone on a few hours' approved leave still worked the rest
    // of the day, so it cannot be one of the mutually-exclusive values above without hiding them
    // from Present. It rides alongside as its own filter, offered only when the day has one.
    if (rows.some((r) => (r.permissionMinutes ?? 0) > 0)) opts.push(PERMISSION);
    return opts;
  }, [rows, isRange]);

  const statusCounts = useMemo(() => {
    const base: Record<string, number> = { all: rows.length };
    for (const r of rows) if (r.status) base[r.status] = (base[r.status] ?? 0) + 1;
    base[PERMISSION] = rows.filter((r) => (r.permissionMinutes ?? 0) > 0).length;
    return base;
  }, [rows]);

  // A chip picked on one window must not strand the next. Range rows have no status (and no chips),
  // and another day may not have that status at all — so the "Out" picked on Today emptied the Week
  // table with no chip left to clear it. A pick that isn't on offer here reads as All (WP-259).
  const activeStatus = statusOptions.includes(status) ? status : "all";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (activeStatus === "all" ||
          (activeStatus === PERMISSION
            ? (r.permissionMinutes ?? 0) > 0
            : r.status === activeStatus)) &&
        (q === "" || r.name.toLowerCase().includes(q)),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      if (sort.key === "rate") return ((a.rate ?? 0) - (b.rate ?? 0)) * dir || a.name.localeCompare(b.name);
      if (sort.key === "status")
        return (statusRank(a.status) - statusRank(b.status)) * dir ||
          a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name) * dir;
    });
    return out;
  }, [rows, query, activeStatus, sort.key, sort.dir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    setSortPick(
      sort.key === key
        ? { mode, key, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { mode, key, dir: key === "name" ? "asc" : "desc" },
    );
    setPage(0);
  };

  const exportCsv = () => {
    const fields = isRange
      ? ["Employee", "Department", "Days present", "Days counted", "Rate %"]
      : isToday
        ? [
            "Employee",
            "Department",
            "Status",
            "Attendance",
            "Hours off",
            "Clock in",
            "Clock out",
            "Hours",
          ]
        : [
            "Employee",
            "Department",
            "Status",
            "Hours off",
            "Clock in",
            "Clock out",
            "Hours",
          ];
    const data = filtered.map((r) => {
      if (isRange) {
        return [r.name, r.dept, r.daysPresent ?? 0, r.daysCounted ?? 0, r.rate ?? 0];
      }
      const base = [r.name, r.dept, statusMeta(r.status ?? "").label];
      // Same column on both single-day shapes — the badge is on the Status cell, which both render.
      const perm =
        (r.permissionMinutes ?? 0) > 0 ? formatPermission(r.permissionMinutes ?? 0) : "—";
      const tail = [
        fmtTime(r.clockIn),
        r.running ? "running" : fmtTime(r.clockOut),
        fmtHours(r.workedMinutes),
      ];
      // `perm` on BOTH shapes — the header carries an "Hours off" column for each, and writing it
      // on only one silently shifted every column after it in the other.
      return isToday
        ? [...base, r.todayStatus ? TODAY_STATUS_META[r.todayStatus].label : "—", perm, ...tail]
        : [...base, perm, ...tail];
    });
    const csv = toCsv({ fields, data });
    const slug = label.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `attendance-${slug}.csv`,
    );
    toast.success("Attendance log exported", {
      description: `${label} · ${filtered.length} rows`,
    });
  };

  return (
    <Card id={ATTENDANCE_LOG_ANCHOR} className="scroll-mt-24">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Attendance log</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search name…"
              aria-label="Search the attendance log by name"
              className="h-9 w-44 pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="size-4" /> Download
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status chips (day / today only) */}
        {statusOptions.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={activeStatus === s}
                onClick={() => {
                  setStatus(s);
                  setPage(0);
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  activeStatus === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "all"
                  ? "All"
                  : s === PERMISSION
                    ? "Hours off"
                    : statusMeta(s).label}{" "}
                · {statusCounts[s] ?? 0}
              </button>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[24vh] items-center justify-center">
            <Loader label="Loading attendance…" />
          </div>
        ) : error ? (
          <EmptyState
            icon={Search}
            title="Can't show attendance"
            description={error}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No records"
            description={
              note ??
              "No employees match these filters, or no attendance has resolved for this window yet."
            }
          />
        ) : (
          <>
            {/* Phones: one card per person. Clock in/out and Hours sat past the right edge of a
                390 px screen, behind a sideways scroll (UX audit 2026-10-16, TIME-12 / XC-05). */}
            <ul className="divide-y divide-border sm:hidden" aria-label={`Attendance log, ${label}`}>
              {pageRows.map((r) => {
                const meta = r.status ? statusMeta(r.status) : null;
                const rate = r.rate ?? 0;
                return (
                  <li key={r.userId} className="space-y-2 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        userId={r.userId}
                        name={r.name}
                        className="size-8 shrink-0"
                        fallbackClassName="text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/employees/${r.userId}`}
                          className="block font-medium break-words hover:underline focus-visible:underline focus-visible:outline-none"
                        >
                          {r.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{r.dept}</p>
                      </div>
                      {isRange ? (
                        <span
                          className={cn(
                            "shrink-0 font-semibold tabular-nums",
                            rate >= 90
                              ? "text-success"
                              : rate >= 75
                                ? "text-warning"
                                : "text-destructive",
                          )}
                        >
                          {rate}%
                        </span>
                      ) : null}
                    </div>
                    {isRange ? (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Present {r.daysPresent ?? 0} of {r.daysCounted ?? 0} counted days
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {meta ? (
                            <Badge className={cn("font-medium", meta.badge)}>
                              <span className={cn("mr-1.5 size-1.5 rounded-full", meta.dot)} />
                              {meta.label}
                            </Badge>
                          ) : null}
                          {isToday && r.todayStatus ? (
                            <Badge className={cn("font-medium", TODAY_STATUS_META[r.todayStatus].badge)}>
                              <span
                                className={cn(
                                  "mr-1.5 size-1.5 rounded-full",
                                  TODAY_STATUS_META[r.todayStatus].dot,
                                )}
                              />
                              {TODAY_STATUS_META[r.todayStatus].label}
                            </Badge>
                          ) : null}
                          {(r.permissionMinutes ?? 0) > 0 ? (
                            <Badge variant="outline" className="text-primary border-primary/30 font-medium">
                              {formatPermission(r.permissionMinutes ?? 0)}
                            </Badge>
                          ) : null}
                        </div>
                        <dl className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <dt className="text-muted-foreground">Clock in</dt>
                            <dd className="font-medium tabular-nums">{fmtTime(r.clockIn)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Clock out</dt>
                            <dd className="font-medium tabular-nums">
                              {r.running ? (
                                <span className="text-success">running</span>
                              ) : (
                                fmtTime(r.clockOut)
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Hours</dt>
                            <dd className="font-medium tabular-nums">{fmtRowHours(r, now)}</dd>
                          </div>
                        </dl>
                        {correction && r.status && CORRECTABLE.has(r.status) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            aria-label={`Correct ${r.name}'s day`}
                            onClick={() => setCorrecting({ userId: r.userId, name: r.name })}
                          >
                            Correct this day
                          </Button>
                        ) : null}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="hidden sm:block">
              <Table scrollLabel={`Attendance log, ${label}`}>
                <TableHeader>
                  <TableRow>
                    <SortHead
                      label="Employee"
                      active={sort.key === "name"}
                      dir={sort.dir}
                      onClick={() => toggleSort("name")}
                    />
                    <TableHead>Department</TableHead>
                    {isRange ? (
                      <>
                        <TableHead>Days present</TableHead>
                        <SortHead
                          label="Rate"
                          active={sort.key === "rate"}
                          dir={sort.dir}
                          onClick={() => toggleSort("rate")}
                        />
                      </>
                    ) : (
                      <>
                        <SortHead
                          label="Status"
                          active={sort.key === "status"}
                          dir={sort.dir}
                          onClick={() => toggleSort("status")}
                        />
                        {isToday && <TableHead>Attendance</TableHead>}
                        <TableHead>Clock in</TableHead>
                        <TableHead>Clock out</TableHead>
                        <TableHead>Hours</TableHead>
                        {correction && !isRange ? (
                          <TableHead className="text-right">
                            <span className="sr-only">Correct</span>
                          </TableHead>
                        ) : null}
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => {
                    const meta = r.status ? statusMeta(r.status) : null;
                    const rate = r.rate ?? 0;
                    return (
                      <TableRow
                        key={r.userId}
                        onClick={() => router.push(`/employees/${r.userId}`)}
                        className="cursor-pointer"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              userId={r.userId}
                              name={r.name}
                              className="size-8"
                              fallbackClassName="text-xs"
                            />
                            {/* A real link, so the profile is reachable by keyboard and announced
                                as one — the row's click alone was mouse-only (WP-478). */}
                            <Link
                              href={`/employees/${r.userId}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                            >
                              {r.name}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.dept}</TableCell>
                        {isRange ? (
                          <>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {r.daysPresent ?? 0} / {r.daysCounted ?? 0}
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "font-semibold tabular-nums",
                                  rate >= 90
                                    ? "text-success"
                                    : rate >= 75
                                      ? "text-warning"
                                      : "text-destructive",
                                )}
                              >
                                {rate}%
                              </span>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>
                              {meta ? (
                                <Badge className={cn("font-medium", meta.badge)}>
                                  <span className={cn("mr-1.5 size-1.5 rounded-full", meta.dot)} />
                                  {meta.label}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                              {/* Rides ALONGSIDE the status, never instead of it: a permission is a few approved hours
                                  away, so the person is still Present/Late for the day. Made it a second badge rather
                                  than a status value for the same reason the filter is a sentinel — replacing the
                                  verdict would hide the very thing this column exists to show.
                              
                                  On the STATUS cell, not the Attendance one: Attendance only renders today, and a
                                  permission on a past day is just as worth seeing. */}
                              {(r.permissionMinutes ?? 0) > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="text-primary border-primary/30 ml-1.5 font-medium"
                                  title={`Approved time off within the day: ${formatPermission(r.permissionMinutes ?? 0)}`}
                                >
                                  {formatPermission(r.permissionMinutes ?? 0)}
                                </Badge>
                              ) : null}
                            </TableCell>
                            {isToday && (
                              <TableCell>
                                {r.todayStatus ? (
                                  <Badge
                                    className={cn(
                                      "font-medium",
                                      TODAY_STATUS_META[r.todayStatus].badge,
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "mr-1.5 size-1.5 rounded-full",
                                        TODAY_STATUS_META[r.todayStatus].dot,
                                      )}
                                    />
                                    {TODAY_STATUS_META[r.todayStatus].label}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            )}
                            <TableCell className="tabular-nums">{fmtTime(r.clockIn)}</TableCell>
                            <TableCell className="tabular-nums">
                              {r.running ? (
                                <span className="text-success">running</span>
                              ) : (
                                fmtTime(r.clockOut)
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {fmtRowHours(r, now)}
                            </TableCell>
                            {correction && !isRange ? (
                              <TableCell className="text-right">
                                {r.status && CORRECTABLE.has(r.status) ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Correct ${r.name}'s day`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCorrecting({ userId: r.userId, name: r.name });
                                    }}
                                  >
                                    Correct
                                  </Button>
                                ) : null}
                              </TableCell>
                            ) : null}
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-1">
              <p className="text-xs text-muted-foreground">
                Showing {safePage * PAGE_SIZE + 1}–
                {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  Page {safePage + 1} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
      {correction ? (
        <DayOverrideDialog
          target={correcting}
          date={correction.date}
          dateLabel={label}
          onClose={() => setCorrecting(null)}
          onSaved={(userId, status) => {
            setCorrecting(null);
            setCorrected((c) => ({
              date: correction.date,
              byUser: new Map<string, string>(
                c.date === correction.date ? c.byUser : undefined,
              ).set(userId, status),
            }));
            correction.onSaved();
          }}
        />
      ) : null}
    </Card>
  );
}

function SortHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : null}
      </button>
    </TableHead>
  );
}

/* ────────────────────────── Log date picker ────────────────────────── */

export interface SelectedDate {
  year: number;
  month: number;
  day: number;
}

/** The shared date notation (UX audit XC-06 / TIME-14) — it was a hand-built "Oct 14, 2026". */
const isoOfDate = (d: SelectedDate) =>
  `${d.year}-${String(d.month + 1).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
const dateLabel = (d: SelectedDate) => formatDate(isoOfDate(d));

export function LogDatePicker({
  value,
  onChange,
}: {
  value: SelectedDate;
  onChange: (d: SelectedDate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: value.year, month: value.month });
  // The real today, re-read at midnight — the picker used to refuse days after the load day (WP-258).
  const now = useToday();

  const weeks = useMemo(
    () => monthMatrix(view.year, view.month, undefined, now),
    [view, now],
  );

  const step = (dir: -1 | 1) =>
    setView((v) => {
      const m = v.month + dir;
      if (m < 0) return { year: v.year - 1, month: 11 };
      if (m > 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: m };
    });

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        // Open on the selected day's month. The month was seeded from `value` once, so after the
        // chevrons, "Today" or the big calendar moved the selection, the picker reopened on the
        // month it was last left on (QA audit 2026-10-08, WP-542).
        if (next) setView({ year: value.year, month: value.month });
        setOpen(next);
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            aria-label={`Pick a day — showing ${dateLabel(value)}`}
          />
        }
      >
        <CalendarDays className="size-4" />
        {dateLabel(value)}
        <ChevronDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => step(-1)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-medium">
            {MONTH_NAMES[view.month]} {view.year}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div
          className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground"
          aria-hidden="true"
        >
          {WEEKDAY_LABELS.map((d) => (
            <span key={d}>{d[0]}</span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {weeks.flat().map((cell, i) => {
            const selected =
              cell.inMonth &&
              cell.year === value.year &&
              cell.month === value.month &&
              cell.day === value.day;
            const disabled =
              !cell.inMonth || isFutureDate(cell.year, cell.month, cell.day, now);
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                // A bare "14" told a screen reader nothing about which month, or which is chosen
                // (UX audit 2026-10-16, TIME-15).
                aria-label={formatDate(isoOfDate(cell), { weekday: true })}
                aria-pressed={selected}
                aria-current={cell.isToday ? "date" : undefined}
                onClick={() => {
                  onChange({
                    year: cell.year,
                    month: cell.month,
                    day: cell.day,
                  });
                  setOpen(false);
                }}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-xs tabular-nums transition-colors",
                  selected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : disabled
                      ? "cursor-default text-muted-foreground/40"
                      : cell.isToday
                        ? "text-primary ring-1 ring-primary hover:bg-muted"
                        : "hover:bg-muted",
                )}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

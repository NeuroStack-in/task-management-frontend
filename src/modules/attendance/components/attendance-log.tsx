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
 * It carries no attendance data and is shared by the personal attendance view and the locations
 * module, so it stays exported here unchanged.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { initials } from "@/lib/format";
import { downloadBlob } from "@/lib/download";
import {
  isFutureDate,
  monthMatrix,
  MONTH_NAMES,
  WEEKDAY_LABELS,
} from "../lib/calendar";
import type {
  OversightMode,
  OversightRow,
} from "../use-oversight-attendance";
import { cn } from "@/lib/utils";

/* ────────────────────────── Attendance log ────────────────────────── */

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  present: { label: "Present", badge: "bg-success/12 text-success", dot: "bg-success" },
  partial: { label: "Partial", badge: "bg-warning/15 text-warning", dot: "bg-warning" },
  leave: { label: "On leave", badge: "bg-primary/12 text-primary", dot: "bg-primary" },
  absent: { label: "Absent", badge: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
  non_workday: { label: "Non-working", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" },
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
  non_workday: 6,
};
const statusRank = (s?: string) => STATUS_RANK[s ?? ""] ?? 99;

/** Epoch ms → local `HH:MM`, or `—`. Client-only (the log renders after mount), so no SSR skew. */
const fmtTime = (ms?: number) =>
  ms
    ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
    : "—";
/** Worked minutes → one-decimal hours, or `—`. */
const fmtHours = (mins?: number) => (mins && mins > 0 ? (mins / 60).toFixed(1) : "—");

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

export function AttendanceLog({
  rows,
  mode,
  loading,
  error,
  label,
  note,
}: {
  rows: OversightRow[];
  mode: OversightMode;
  loading: boolean;
  error: string | null;
  label: string;
  note: string | null;
}) {
  const router = useRouter();
  const isRange = mode === "range";
  // Today has no closed verdict, so it gets the extra live-classification column (leave/absent/late).
  const isToday = mode === "today";

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  // Today's roster leads with whoever is working right now — that is the question the live view is
  // open to answer, and alphabetical order buries it (four In-now people scattered through seven
  // Out rows). Name stays the tiebreak, and the column headers still re-sort on demand. A past day
  // is a record rather than a live board, so it keeps opening alphabetically.
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: mode === "today" ? "status" : "name",
    dir: "asc",
  });
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
    const order = ["present", "partial", "leave", "absent", "non_workday", "in", "out"];
    return ["all", ...order.filter((s) => seen.has(s))];
  }, [rows, isRange]);

  const statusCounts = useMemo(() => {
    const base: Record<string, number> = { all: rows.length };
    for (const r of rows) if (r.status) base[r.status] = (base[r.status] ?? 0) + 1;
    return base;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter(
      (r) =>
        (status === "all" || r.status === status) &&
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
  }, [rows, query, status, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
    setPage(0);
  };

  const exportCsv = () => {
    const fields = isRange
      ? ["Employee", "Department", "Days present", "Days counted", "Rate %"]
      : isToday
        ? ["Employee", "Department", "Status", "Attendance", "Clock in", "Clock out", "Hours"]
        : ["Employee", "Department", "Status", "Clock in", "Clock out", "Hours"];
    const data = filtered.map((r) => {
      if (isRange) {
        return [r.name, r.dept, r.daysPresent ?? 0, r.daysCounted ?? 0, r.rate ?? 0];
      }
      const base = [r.name, r.dept, statusMeta(r.status ?? "").label];
      const tail = [
        fmtTime(r.clockIn),
        r.running ? "running" : fmtTime(r.clockOut),
        fmtHours(r.workedMinutes),
      ];
      return isToday
        ? [...base, r.todayStatus ? TODAY_STATUS_META[r.todayStatus].label : "—", ...tail]
        : [...base, ...tail];
    });
    const csv = Papa.unparse({ fields, data });
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
                onClick={() => {
                  setStatus(s);
                  setPage(0);
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  status === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "all" ? "All" : statusMeta(s).label} · {statusCounts[s] ?? 0}
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
            <div className="overflow-x-auto">
              <Table>
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
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs">
                                {initials(r.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{r.name}</span>
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
                              {fmtHours(r.workedMinutes)}
                            </TableCell>
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

const dateLabel = (d: SelectedDate) =>
  `${MONTH_NAMES[d.month].slice(0, 3)} ${d.day}, ${d.year}`;

export function LogDatePicker({
  value,
  onChange,
}: {
  value: SelectedDate;
  onChange: (d: SelectedDate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: value.year, month: value.month });

  const weeks = useMemo(() => monthMatrix(view.year, view.month), [view]);

  const step = (dir: -1 | 1) =>
    setView((v) => {
      const m = v.month + dir;
      if (m < 0) return { year: v.year - 1, month: 11 };
      if (m > 11) return { year: v.year + 1, month: 0 };
      return { year: v.year, month: m };
    });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="h-8 gap-1.5" />}
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

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
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
              !cell.inMonth || isFutureDate(cell.year, cell.month, cell.day);
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
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

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { users } from "@/lib/data";
import { initials } from "@/lib/format";
import { type AttendanceStatus } from "@/lib/mock-metrics";
import {
  dayRecordFor,
  isFutureDate,
  monthMatrix,
  MONTH_NAMES,
  TODAY,
  WEEKDAY_LABELS,
} from "@/lib/mock-attendance";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  AttendanceStatus,
  { label: string; badge: string; row: string }
> = {
  present: { label: "Present", badge: "bg-success/12 text-success", row: "" },
  late: {
    label: "Late",
    badge: "bg-warning/15 text-warning",
    row: "bg-warning/[0.04]",
  },
  leave: {
    label: "On leave",
    badge: "bg-accent text-accent-foreground",
    row: "",
  },
  absent: {
    label: "Absent",
    badge: "bg-destructive/12 text-destructive",
    row: "bg-destructive/[0.04]",
  },
};

const STATUS_FILTERS: (AttendanceStatus | "all")[] = [
  "all",
  "present",
  "late",
  "leave",
  "absent",
];

type SortKey = "name" | "clockIn" | "hours";
const PAGE_SIZE = 10;

interface Row {
  id: string;
  name: string;
  avatarUrl?: string;
  department: string;
  status: AttendanceStatus;
  clockIn: string;
  clockOut: string;
  hours: number;
}

interface SelectedDate {
  year: number;
  month: number;
  day: number;
}

const isToday = (d: SelectedDate) =>
  d.year === TODAY.year && d.month === TODAY.month && d.day === TODAY.day;

const dateLabel = (d: SelectedDate) =>
  `${MONTH_NAMES[d.month].slice(0, 3)} ${d.day}, ${d.year}`;

export function AttendanceLog({
  date,
  onDateChange,
}: {
  date: SelectedDate;
  onDateChange: (d: SelectedDate) => void;
}) {
  const router = useRouter();

  const allRows: Row[] = useMemo(
    () =>
      users.map((u) => {
        const a = dayRecordFor(u.id, date.year, date.month, date.day);
        return {
          id: u.id,
          name: u.name,
          avatarUrl: u.avatarUrl,
          department: u.department,
          status: a.status,
          clockIn: a.clockIn,
          clockOut: a.clockOut,
          hours: a.hours,
        };
      }),
    [date],
  );

  const departments = useMemo(
    () => ["all", ...[...new Set(allRows.map((r) => r.department))].sort()],
    [allRows],
  );

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AttendanceStatus | "all">("all");
  const [dept, setDept] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const [page, setPage] = useState(0);

  const statusCounts = useMemo(() => {
    const base = { all: allRows.length } as Record<string, number>;
    for (const s of ["present", "late", "leave", "absent"] as const)
      base[s] = allRows.filter((r) => r.status === s).length;
    return base;
  }, [allRows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = allRows.filter(
      (r) =>
        (status === "all" || r.status === status) &&
        (dept === "all" || r.department === dept) &&
        (q === "" || r.name.toLowerCase().includes(q)),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      if (sort.key === "hours") return (a.hours - b.hours) * dir;
      // clockIn: "—" (no clock-in) sorts last regardless of direction
      const av = a.clockIn === "—" ? "99:99" : a.clockIn;
      const bv = b.clockIn === "—" ? "99:99" : b.clockIn;
      return av.localeCompare(bv) * dir;
    });
    return rows;
  }, [allRows, query, status, dept, sort]);

  // Clamp page to valid range when filters shrink the result set.
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  const resetPage = () => setPage(0);

  const toggleSort = (key: SortKey) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" },
    );
    resetPage();
  };

  const exportCsv = () => {
    const csv = Papa.unparse({
      fields: ["Employee", "Department", "Status", "Clock in", "Clock out", "Hours"],
      data: filtered.map((r) => [
        r.name,
        r.department,
        STATUS_META[r.status].label,
        r.clockIn,
        r.clockOut,
        r.hours ? r.hours.toFixed(1) : "—",
      ]),
    });
    const fname = `attendance-${date.year}-${String(date.month + 1).padStart(2, "0")}-${String(date.day).padStart(2, "0")}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Attendance log exported", {
      description: `${dateLabel(date)} · ${filtered.length} rows · ${fname}`,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>{isToday(date) ? "Today's log" : "Attendance log"}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{dateLabel(date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LogDatePicker
            value={date}
            onChange={(d) => {
              onDateChange(d);
              resetPage();
            }}
          />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                resetPage();
              }}
              placeholder="Search name…"
              className="h-9 w-44 pl-8"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="h-9 gap-1.5" />
              }
            >
              {dept === "all" ? "All departments" : dept}
              <ChevronDown className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
              {departments.map((d) => (
                <DropdownMenuItem
                  key={d}
                  onClick={() => {
                    setDept(d);
                    resetPage();
                  }}
                >
                  {d === "all" ? "All departments" : d}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-9" onClick={exportCsv}>
            <Download className="size-4" /> Download
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status chips */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                resetPage();
              }}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All" : STATUS_META[s].label} · {statusCounts[s]}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matches"
            description="No employees match these filters. Try clearing the search or status."
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
                    <TableHead>Status</TableHead>
                    <SortHead
                      label="Clock in"
                      active={sort.key === "clockIn"}
                      dir={sort.dir}
                      onClick={() => toggleSort("clockIn")}
                    />
                    <TableHead>Clock out</TableHead>
                    <SortHead
                      label="Hours"
                      active={sort.key === "hours"}
                      dir={sort.dir}
                      onClick={() => toggleSort("hours")}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => {
                    const meta = STATUS_META[r.status];
                    return (
                      <TableRow
                        key={r.id}
                        onClick={() => router.push(`/employees/${r.id}`)}
                        className={cn("cursor-pointer", meta.row)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarImage src={r.avatarUrl} alt={r.name} />
                              <AvatarFallback className="text-xs">
                                {initials(r.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{r.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.department}
                        </TableCell>
                        <TableCell>
                          <Badge className={meta.badge}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {r.clockIn}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {r.clockOut}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {r.hours ? r.hours.toFixed(1) : "—"}
                        </TableCell>
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
                {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
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
  align,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "right";
}) {
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground",
          align === "right" && "flex-row-reverse",
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

function LogDatePicker({
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
        render={<Button variant="outline" size="sm" className="h-9 gap-1.5" />}
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

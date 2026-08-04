"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader } from "@/components/shared/loader";
import { formatDuration } from "@/lib/format";
import { useTimesheet } from "../use-timesheet";
import { todayLocal } from "../services/timesheet.service";

/**
 * A past day's timesheet, under the (primary) today view.
 *
 * **Reads the same endpoint as today.** `GET /v1/me/timesheet/today?date=` has always taken an
 * arbitrary date — only the UI was pinned to today — so this needed no new route and returns rows in
 * the identical shape. Nothing here re-derives totals: `total_secs`/`billable_secs` come from the
 * server, so a day cannot total differently in two places.
 *
 * The default is **yesterday**, not today: today is already the whole view above, and defaulting a
 * "previous days" section to the day you are looking at would show the same table twice.
 */
export function TimesheetHistory() {
  // Resolved on the client, never at render. `new Date()` during render is a hydration mismatch (and
  // the CLAUDE.md convention forbids it in render paths) — the empty first pass renders the picker
  // without a value and settles a tick later.
  const [date, setDate] = useState("");
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setDate(localIso(d));
  }, []);

  // `undefined` until the date settles, so the hook does not fetch today twice on first paint.
  const { rows, totalSec, billableSec, loading, error } = useTimesheet(date || undefined);

  const max = useMemo(() => todayLocal(), []);

  // Client-side, for the same hydration reason the default date is: `new Date()` in a render path
  // would differ between server and client.
  const [shortcuts, setShortcuts] = useState({
    yesterday: "",
    dayBefore: "",
    dayBeforeLabel: "",
  });
  useEffect(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const b = new Date();
    b.setDate(b.getDate() - 2);
    setShortcuts({
      yesterday: localIso(y),
      dayBefore: localIso(b),
      dayBeforeLabel: b.toLocaleDateString(undefined, { weekday: "short" }),
    });
  }, []);
  const showing = Boolean(date);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="text-muted-foreground size-4" />
          Previous days
        </CardTitle>
        <div className="flex items-center gap-1.5">
          {/* Shortcuts for the two days people actually ask for, so the common case is one click
              rather than opening a calendar and finding the date. */}
          <Button
            variant={date === shortcuts.yesterday ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => setDate(shortcuts.yesterday)}
          >
            Yesterday
          </Button>
          <Button
            variant={date === shortcuts.dayBefore ? "secondary" : "ghost"}
            size="sm"
            className="hidden h-8 px-2.5 text-xs sm:inline-flex"
            onClick={() => setDate(shortcuts.dayBefore)}
          >
            {shortcuts.dayBeforeLabel}
          </Button>
          {/* The app's own picker, not `<input type="date">`. This was the only raw date input left
              in the codebase: it rendered the browser's native calendar, which looks nothing like
              the rest of the app and positions itself over whatever happens to be above it. The
              shared DatePicker portals into the body, so it is anchored and cannot be clipped.
              `max` still caps it at today — a future day has no entries by construction, and its
              empty state reads as data loss. */}
          <DatePicker value={date} onChange={setDate} max={max} className="w-[10.5rem]" />
        </div>
      </CardHeader>

      <CardContent>
        {!showing ? null : loading ? (
          <div className="py-8">
            <Loader label="Loading that day…" />
          </div>
        ) : error ? (
          <p className="text-muted-foreground py-6 text-center text-sm">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No time was tracked on {date}.
          </p>
        ) : (
          <>
            <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span className="text-foreground font-medium tabular-nums">
                  {formatDuration(totalSec)}
                </span>
                tracked
              </span>
              <span>
                <span className="text-foreground font-medium tabular-nums">
                  {formatDuration(billableSec)}
                </span>{" "}
                billable
              </span>
              <span>
                {rows.length} {rows.length === 1 ? "entry" : "entries"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left text-xs tracking-wide uppercase">
                    <th className="py-2 pr-3 font-medium">Task</th>
                    <th className="py-2 pr-3 font-medium">Project</th>
                    <th className="py-2 pr-3 font-medium">Time</th>
                    <th className="py-2 text-right font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="max-w-[22rem] py-2.5 pr-3">
                        <span className="block truncate font-medium">
                          {r.task ?? r.description ?? "—"}
                        </span>
                        {/* Description only when it is not already the label above, so a
                            project-only session does not print the same string twice. */}
                        {r.task && r.description ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {r.description}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-muted-foreground py-2.5 pr-3">{r.project}</td>
                      <td className="text-muted-foreground py-2.5 pr-3 tabular-nums">
                        {r.start} – {r.end ?? "—"}
                      </td>
                      <td className="py-2.5 text-right font-medium tabular-nums">
                        {formatDuration(r.durationSec)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** `YYYY-MM-DD` in the **local** zone — `toISOString()` would shift the day either side of UTC. */
function localIso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

"use client";

import { useState } from "react";
import { CalendarClock, ChevronDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import { formatHoursOff } from "@/modules/leave/lib/days";
import { formatDate, formatDateRange } from "@/lib/format";
import { formatWallClock } from "../lib/clock";
import { useUpcomingLeave, type UpcomingLeaveItem } from "../use-upcoming-leave";

/**
 * "Kishore M is on leave on 1 Sept 2026" — said as a sentence, because that is the form the
 * question is asked in. A date range and a fraction in separate columns is the same information
 * the roster already shows and would need reassembling in the reader's head.
 *
 * Dates and times in the product's one notation, in the viewer's locale (UX audit XC-06 / TIME-14):
 * this printed "Sept 1, 2026" and a forced 12-hour "2:30 pm" while the roster above used 24 hours.
 */
function sentence(i: UpcomingLeaveItem): string {
  // "on 1 Sep 2026" for one day; "1 – 3 Sep 2026" for a span.
  const when = i.from === i.to ? `on ${formatDate(i.from)}` : formatDateRange(i.from, i.to);
  // A few hours off, not "on permission" — HR jargon (UX audit 2026-10-16, TIME-08).
  if (i.permissionMinutes > 0 && i.fromTime && i.toTime) {
    return `taking ${formatHoursOff(i.permissionMinutes)} ${when}, ${formatWallClock(i.fromTime)} to ${formatWallClock(i.toTime)}`;
  }
  return `on leave ${when}`;
}

/**
 * Approved leave that has not started yet.
 *
 * Collapsed by default and rendered only for someone who can already see the org roster — it is a
 * planning aid beneath the day's attendance, not a second thing competing with it. Leave covering
 * *today* is deliberately absent: the roster above already shows that person as On leave, and
 * repeating them here would make the panel a duplicate of the page it sits on.
 */
export function UpcomingLeave() {
  const [open, setOpen] = useState(false);
  const { items, loading, error } = useUpcomingLeave(open);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="bg-feature-tint text-primary flex size-8 items-center justify-center rounded-full">
              <CalendarClock className="size-4" />
            </span>
            <div>
              <CardTitle>Upcoming leave</CardTitle>
              <p className="text-muted-foreground text-sm">
                Approved time off that hasn&apos;t started yet
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? "Hide upcoming leave" : "Show upcoming leave"}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </CardHeader>

      {open ? (
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Loading…</p>
          ) : error ? (
            <p className="text-destructive py-6 text-center text-sm">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              Nobody has approved leave coming up.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {items.map((i) => (
                <li
                  key={`${i.userId}-${i.from}-${i.to}-${i.fromTime ?? ""}`}
                  className="flex items-center gap-3 py-3"
                >
                  <UserAvatar userId={i.userId} name={i.name} className="size-8" />
                  {/* Wraps on a phone rather than cutting the dates off (TIME-12). */}
                  <p className="min-w-0 flex-1 text-sm sm:truncate">
                    <span className="font-medium">{i.name}</span>{" "}
                    <span className="text-muted-foreground">is {sentence(i)}</span>
                  </p>
                  <Badge variant="secondary" className="shrink-0 font-normal">
                    {i.typeName}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

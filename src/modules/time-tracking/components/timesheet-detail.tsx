"use client";

import { Clock, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  formatHours,
  type TimesheetDayEntry,
  type TimesheetStatus,
} from "../types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  TimesheetStatus,
  { label: string; className: string }
> = {
  "on-track": { label: "On track", className: "bg-success/12 text-success" },
  flagged: { label: "Flagged", className: "bg-destructive/12 text-destructive" },
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ----------------------------- view model -----------------------------
 *
 * Only real facts, threaded from the hook: the day's real tracked hours and the real time
 * entries for that day (project or contributor name + duration). No seeded idle time, activity
 * %, task pools, or progress bars — those had no honest source.
 */

export type ActivityView =
  | {
      kind: "day";
      rowId: string;
      name: string;
      subtitle: string;
      isProject: boolean;
      status: TimesheetStatus;
      dateLabel: string;
      hours: number;
      /** Real entries logged on this day (`label` = project or contributor, `hours` real). */
      entries: TimesheetDayEntry[];
    }
  | {
      kind: "week";
      rowId: string;
      name: string;
      subtitle: string;
      isProject: boolean;
      status: TimesheetStatus;
      weekRange: string;
      /** Real hours per weekday, Mon→Sun. */
      days: number[];
      /** Real entries per weekday, Mon→Sun. */
      entriesByDay: TimesheetDayEntry[][];
    };

/** Sum entry hours by label, biggest first. Used for the day and week entry lists. */
function rollUp(entries: TimesheetDayEntry[]): TimesheetDayEntry[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    map.set(e.label, Math.round(((map.get(e.label) ?? 0) + e.hours) * 100) / 100);
  }
  return [...map.entries()]
    .map(([label, hours]) => ({ label, hours }))
    .sort((a, b) => b.hours - a.hours);
}

/* ------------------------------ component ----------------------------- */

export function ActivityDialog({
  view,
  onClose,
}: {
  view: ActivityView | null;
  onClose: () => void;
}) {
  const meta = view ? STATUS_META[view.status] : null;

  return (
    <Dialog open={!!view} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {view ? (
          <>
            <DialogHeader className="border-b p-5 pr-12 text-left">
              <div className="flex items-center gap-2">
                {/* "On track" is the norm — only surface the badge when flagged. */}
                {view.status === "flagged" ? (
                  <Badge className={meta!.className}>{meta!.label}</Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {view.kind === "day"
                    ? `Daily time · ${view.dateLabel}`
                    : `Weekly time · ${view.weekRange}`}
                </span>
              </div>
              <DialogTitle className="mt-1 text-lg">{view.name}</DialogTitle>
              <DialogDescription>{view.subtitle}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 p-5">
              {view.kind === "day" ? (
                <DayDetail view={view} />
              ) : (
                <WeekDetail view={view} />
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DayDetail({
  view,
}: {
  view: Extract<ActivityView, { kind: "day" }>;
}) {
  if (view.hours <= 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
        No time tracked on this day.
      </div>
    );
  }

  const entries = rollUp(view.entries);

  return (
    <>
      <Tile icon={Clock} label="Tracked" value={formatHours(view.hours)} />

      <Section title={view.isProject ? "Contributors" : "Time entries"}>
        {entries.length > 0 ? (
          <ul className="space-y-2.5">
            {entries.map((e, i) => (
              <EntryRow key={i} entry={e} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No individual entries — a running session with no duration yet.
          </p>
        )}
      </Section>
    </>
  );
}

function WeekDetail({
  view,
}: {
  view: Extract<ActivityView, { kind: "week" }>;
}) {
  const total = Math.round(view.days.reduce((s, h) => s + h, 0) * 100) / 100;
  const max = Math.max(...view.days, 1);
  const entries = rollUp(view.entriesByDay.flat());

  return (
    <>
      {/* Real hours per day, Mon→Sun. */}
      <Section title="Hours per day">
        <div className="flex items-end justify-between gap-2 pt-1">
          {view.days.map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[0.7rem] tabular-nums text-muted-foreground">
                {h > 0 ? formatHours(h) : "—"}
              </span>
              <div className="flex h-24 w-full max-w-9 flex-col justify-end overflow-hidden rounded-md bg-muted">
                {h > 0 ? (
                  <div
                    className="w-full bg-primary"
                    style={{ height: `${(h / max) * 100}%` }}
                    title={`${DAY_LABELS[i]} · ${formatHours(h)}`}
                  />
                ) : null}
              </div>
              <span className="text-[0.7rem] text-muted-foreground">
                {DAY_LABELS[i]}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Tile icon={Clock} label="Total tracked" value={formatHours(total)} />

      <Section
        title={view.isProject ? "Contributors this week" : "Projects this week"}
      >
        {entries.length > 0 ? (
          <ul className="space-y-2.5">
            {entries.map((e, i) => (
              <EntryRow key={i} entry={e} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No entries with a recorded duration this week.
          </p>
        )}
      </Section>
    </>
  );
}

/* ------------------------------- atoms -------------------------------- */

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-1 font-heading text-lg font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function EntryRow({ entry }: { entry: TimesheetDayEntry }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0 truncate font-medium">{entry.label}</span>
      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {entry.hours > 0 ? formatHours(entry.hours) : "—"}
      </span>
    </li>
  );
}

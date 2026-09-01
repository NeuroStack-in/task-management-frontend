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
import { formatHours, type TimesheetDayEntry, type TimesheetStatus } from "../types";
import type { Period } from "../use-team-timesheet";
import { formatHMS, useRunningSeconds } from "@/hooks/use-live-refresh";
import { cn } from "@/lib/utils";

const STATUS_META: Record<TimesheetStatus, { label: string; className: string }> = {
  "on-track": { label: "On track", className: "bg-success/12 text-success" },
  flagged: { label: "Flagged", className: "bg-destructive/12 text-destructive" },
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** `YYYY-MM-DD` → weekday index with **Monday = 0**, matching `DAY_LABELS`. */
function weekdayIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00`).getDay() + 6) % 7;
}

/** `YYYY-MM-DD` → `Wed, Aug 5` — the hover label on a bar. */
function barTitle(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${DAY_LABELS[weekdayIndex(iso)]}, ${MONTHS[m - 1]} ${d}`;
}

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
      /**
       * The whole selected range — a **week or a month**.
       *
       * Named `range`, not `week`, because it was called `week` while already being opened for a
       * month, and the name is what licensed the bugs: `days[]` was documented "Mon→Sun" and the
       * chart read `DAY_LABELS[i]`, which is `undefined` from the eighth bar on. A month opened
       * this dialog and got seven weekday names followed by twenty-four blanks.
       */
      kind: "range";
      rowId: string;
      name: string;
      subtitle: string;
      isProject: boolean;
      status: TimesheetStatus;
      /** Human label for the range, e.g. `Aug 1 – 31, 2026`. */
      rangeLabel: string;
      /** Which span this is — decides the wording and how the chart is laid out. */
      period: Period;
      /**
       * The iso dates `days`/`entriesByDay` align to — 7 for a week, 28-31 for a month.
       *
       * Carried rather than inferred: the bars' weekday, weekend shading and hover labels are all
       * facts about the **date**, and deriving them from the array index is only correct for a
       * Monday-aligned week.
       */
      dates: string[];
      /** Real hours per day, aligned to `dates`. */
      days: number[];
      /** Real entries per day, aligned to `dates`. */
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
  const isMonth = view?.kind === "range" && view.period === "month";

  return (
    <Dialog open={!!view} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent
        className={cn(
          "max-h-[85vh] gap-0 overflow-x-hidden overflow-y-auto p-0",
          // A month needs the extra width: 31 bars in the 512px `lg` dialog leave ~7px each once
          // the gaps are paid for, which is a hairline, not a bar. Everything else keeps `lg` —
          // widening a seven-bar chart would only stretch it.
          isMonth ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        {view ? (
          <>
            <DialogHeader className="border-b p-5 pr-12 text-left">
              <div className="flex items-center gap-2">
                {/* "On track" is the norm — only surface the badge when flagged. */}
                {view.status === "flagged" ? (
                  <Badge className={meta!.className}>{meta!.label}</Badge>
                ) : null}
                <span className="text-muted-foreground text-xs">
                  {view.kind === "day"
                    ? `Daily time · ${view.dateLabel}`
                    : // Said "Weekly time" over a month's range, so the dialog contradicted the
                      // date beside it.
                      `${view.period === "month" ? "Monthly" : "Weekly"} time · ${view.rangeLabel}`}
                </span>
              </div>
              <DialogTitle className="mt-1 text-lg">{view.name}</DialogTitle>
              <DialogDescription>{view.subtitle}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 p-5">
              {view.kind === "day" ? (
                <DayDetail view={view} />
              ) : (
                <RangeDetail view={view} />
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DayDetail({ view }: { view: Extract<ActivityView, { kind: "day" }> }) {
  if (view.hours <= 0) {
    return (
      <div className="bg-muted/20 text-muted-foreground rounded-2xl border border-dashed px-4 py-10 text-center text-sm">
        No time tracked on this day.
      </div>
    );
  }

  // Sessions, when the rows carry them — one line per session, in the order they were worked. A
  // per-project roll-up answers "how long on this project" but not "what was actually done", which
  // is the question someone opens a day to ask. The project total is still shown, as a heading per
  // project, so nothing is lost.
  const sessions = view.entries.filter((e) => e.session);
  const rolled = rollUp(view.entries);

  return (
    <>
      <Tile icon={Clock} label="Tracked" value={formatHours(view.hours)} />

      <Section title={view.isProject ? "Contributors" : "Sessions"}>
        {sessions.length > 0 ? (
          <div className="space-y-4">
            {groupByLabel(sessions).map(([label, group]) => (
              <div key={label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 border-b pb-1">
                  <span className="min-w-0 text-xs font-semibold tracking-wide break-words uppercase">
                    {label}
                  </span>
                  <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                    {formatHours(group.reduce((t, e) => t + e.hours, 0))}
                  </span>
                </div>
                {/* A rule between sessions, not just a gap. Each session is three stacked lines
                    (task, note, times) and `space-y-2` put less air between two sessions than a
                    single session had inside it — so five sessions read as one wall of text. The
                    divider is what says where one ends. */}
                <ul className="divide-border/70 divide-y">
                  {group.map((e) => (
                    <SessionRow key={e.session!.id} entry={e} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : rolled.length > 0 ? (
          // Rows without session detail (a synthesised or project-rolled view) keep the old shape
          // rather than rendering an empty panel.
          <ul className="space-y-2.5">
            {rolled.map((e, i) => (
              <EntryRow key={i} entry={e} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No individual entries — a running session with no duration yet.
          </p>
        )}
      </Section>
    </>
  );
}

/** Group entries under their label (project), preserving first-seen order. */
function groupByLabel(entries: TimesheetDayEntry[]): [string, TimesheetDayEntry[]][] {
  const map = new Map<string, TimesheetDayEntry[]>();
  for (const e of entries) {
    const list = map.get(e.label);
    if (list) list.push(e);
    else map.set(e.label, [e]);
  }
  return [...map.entries()];
}

/**
 * One session: what was worked on, when, for how long.
 *
 * The label is the **task**, falling back to the description and then "Untitled session".
 *
 * It used to be the description, and the reason was real: task titles resolved from the caller's
 * own task list, which does not cover another employee's tasks, so an admin would have seen blanks
 * or the wrong name. The server now resolves the title itself (`EntryRow.task_title`, one batch
 * read per day), which removes that constraint — an admin gets the right name for a task they
 * could never have listed. The description keeps its place on the line below.
 */
/**
 * How a session ended, in words — or "" for the ordinary case.
 *
 * `user` is deliberately silent: someone pressing Stop is what is supposed to happen, and labelling
 * it would put a badge on nearly every row and drown the ones that matter. Anything unrecognised is
 * passed through rather than dropped, so a reason added server-side still says something here.
 */
function stopReasonLabel(reason: string | undefined): string {
  if (!reason || reason === "user") return "";
  const known: Record<string, string> = {
    idle: "ended when idle",
    logout: "ended at sign-out",
    shutdown: "ended by shutdown",
    abandoned: "ended without a stop",
    superseded: "replaced by a newer session",
  };
  return known[reason] ?? `ended: ${reason}`;
}

function SessionRow({ entry }: { entry: TimesheetDayEntry }) {
  const s = entry.session!;
  // Ticks only while this session is running; `null` starts no interval at all.
  const liveSec = useRunningSeconds(s.running ? s.startMs : null);
  // **The task names the row; the description details it.**
  //
  // This was the description — the sentence typed into "what are you working on?" — so a day read
  // as rows of free text with the actual task nowhere on screen. The task is what the work *is*;
  // the note is what was said about it, and it moves to the line below.
  //
  // Never fall back to the raw `taskId`: an id is opaque, and "Untitled session" at least says
  // what it means.
  const label = s.taskTitle || s.description || "Untitled session";
  // Only when it adds something the line above does not already say.
  const detail = s.taskTitle && s.description && s.description !== s.taskTitle ? s.description : "";
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 text-sm first:pt-1 last:pb-0">
      <span className="min-w-0 flex-1">
        {/* Wraps rather than truncating: a typed description is the whole point of the row, and an
            ellipsis hides exactly the part someone opened the dialog to read. `break-words` also
            breaks a single unbroken token (a pasted URL, a long ID), which is what was pushing the
            panel wider than the dialog and producing a horizontal scrollbar. */}
        <span className="block font-medium break-words">{label}</span>
        {detail ? (
          <span className="text-muted-foreground mt-0.5 block text-xs break-words">{detail}</span>
        ) : null}
        <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="font-mono tabular-nums">
            {s.start} – {s.end ?? "now"}
          </span>
          {s.billable ? <span className="text-success">Billable</span> : null}
          {s.running ? <span className="text-primary font-medium">Running</span> : null}
          {/* Surfaced because it explains a session the person did not stop themselves. Rendered as
              a sentence, not the raw enum: "shutdown" on its own reads as a category label and had
              to be guessed at; "ended by shutdown" says what happened to the session. */}
          {stopReasonLabel(s.stopReason) ? (
            <span className="text-warning">{stopReasonLabel(s.stopReason)}</span>
          ) : null}
          {s.taskInvalid ? <span className="text-warning">task removed</span> : null}
        </span>
      </span>
      {/* A running session used to render "—" on the grounds that it has contributed no *settled*
          time. True of the stored total, but useless on screen: the row someone is watching is the
          one that should be moving. `useRunningSeconds` recomputes from the session's own start
          stamp each second, so it climbs between the 30 s polls and self-corrects after a sleep. */}
      {/* Fixed width, right-aligned, so the durations form a column. `tabular-nums` lines the
          digits up but not the "h"/"m" around them, so "6m" and "1h 42m" still sat at
          different x-positions and the eye could not scan down them. */}
      <span
        className={cn(
          "min-w-[4.5rem] shrink-0 text-right font-mono text-xs tabular-nums",
          s.running ? "text-primary font-medium" : "text-muted-foreground",
        )}
      >
        {s.running ? formatHMS(liveSec) : formatHours(entry.hours)}
      </span>
    </li>
  );
}

/**
 * The whole selected range: hours per day, the total, and what the time went to.
 *
 * ## Why a month is laid out differently from a week
 *
 * The two spans differ by more than a count, so the same seven-bar layout cannot serve both.
 *
 * - **The per-bar duration label has to go.** `05:18:00` is ~60px of text that cannot shrink, and
 *   thirty-one of them are ~1,860px wide. That is what pushed the chart past the dialog and let
 *   `overflow-x-hidden` clip it — the bars were never sized wrong, the *labels* were unshrinkable.
 *   In a month the value moves to the bar's hover title; in a week all seven still fit and stay.
 * - **The axis becomes a scale, not a name per bar.** Thirty-one weekday names are unreadable and
 *   tell you nothing about *which* Tuesday — the same reasoning the grid's `columnHeading` already
 *   applies to its column headers. A month ticks the 1st and every 5th day; a week names all seven.
 * - **Weekends are shaded**, because the only way to read a 31-bar chart is to find the weekly
 *   rhythm in it. The tint is on the empty track, not the bar, so it groups the bars without
 *   implying that weekend work counts for less.
 *
 * Every one of those is derived from `dates[i]`, never from `i`. The index is a weekday only in a
 * Monday-aligned week, which is exactly the assumption that broke this dialog for a month.
 */
function RangeDetail({ view }: { view: Extract<ActivityView, { kind: "range" }> }) {
  const total = Math.round(view.days.reduce((s, h) => s + h, 0) * 100) / 100;
  const max = Math.max(...view.days, 1);
  const entries = rollUp(view.entriesByDay.flat());
  const isMonth = view.period === "month";
  const span = isMonth ? "month" : "week";

  return (
    <>
      <Section title="Hours per day">
        <div className={cn("flex items-end pt-1", isMonth ? "gap-[3px]" : "justify-between gap-2")}>
          {view.days.map((h, i) => {
            const iso = view.dates[i];
            // `dates` and `days` are built together and always align; the guard is for the one
            // frame where a period switch has swapped one but not the other.
            const dow = iso ? weekdayIndex(iso) : i;
            const dayOfMonth = iso ? Number(iso.slice(8, 10)) : i + 1;
            // Ticks read as a scale: the 1st, then every 5th. Labelling all 31 produces a picket
            // fence at this width, and labelling none leaves the bars unanchored to a date.
            const tick = isMonth
              ? dayOfMonth === 1 || dayOfMonth % 5 === 0
                ? String(dayOfMonth)
                : ""
              : DAY_LABELS[dow];
            return (
              <div
                key={iso ?? i}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              >
                {!isMonth ? (
                  <span className="text-muted-foreground text-[0.7rem] tabular-nums">
                    {h > 0 ? formatHours(h) : "—"}
                  </span>
                ) : null}
                <div
                  className={cn(
                    "flex h-24 w-full flex-col justify-end overflow-hidden rounded-md",
                    isMonth ? "max-w-6" : "max-w-9",
                    dow >= 5 ? "bg-muted-foreground/20" : "bg-muted",
                  )}
                  // On the track, so a day with no hours is still hoverable — "nothing on the 9th"
                  // is an answer, and a bar of zero height cannot be pointed at.
                  title={iso ? `${barTitle(iso)} · ${h > 0 ? formatHours(h) : "no time tracked"}` : undefined}
                >
                  {h > 0 ? (
                    <div className="bg-primary w-full" style={{ height: `${(h / max) * 100}%` }} />
                  ) : null}
                </div>
                <span className="text-muted-foreground h-3 text-[0.7rem] tabular-nums">
                  {tick}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      <Tile icon={Clock} label="Total tracked" value={formatHours(total)} />

      <Section
        title={`${view.isProject ? "Contributors" : "Projects"} this ${span}`}
      >
        {entries.length > 0 ? (
          <ul className="space-y-2.5">
            {entries.map((e, i) => (
              <EntryRow key={i} entry={e} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No entries with a recorded duration this {span}.
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
    <div className="bg-muted/30 rounded-xl border p-3">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="font-heading mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
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
      {/* Same column width as `SessionRow` — both lists appear in this one dialog. No divider here:
          these are single-line rows, so the gap alone already separates them. */}
      <span className="text-muted-foreground min-w-[4.5rem] shrink-0 text-right font-mono text-xs tabular-nums">
        {entry.hours > 0 ? formatHours(entry.hours) : "—"}
      </span>
    </li>
  );
}

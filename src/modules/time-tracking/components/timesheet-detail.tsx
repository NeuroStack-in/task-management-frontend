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
import { formatHMS, useRunningSeconds } from "@/hooks/use-live-refresh";
import { cn } from "@/lib/utils";

const STATUS_META: Record<TimesheetStatus, { label: string; className: string }> = {
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
      <DialogContent className="max-h-[85vh] gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-lg">
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

function WeekDetail({ view }: { view: Extract<ActivityView, { kind: "week" }> }) {
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
              <span className="text-muted-foreground text-[0.7rem] tabular-nums">
                {h > 0 ? formatHours(h) : "—"}
              </span>
              <div className="bg-muted flex h-24 w-full max-w-9 flex-col justify-end overflow-hidden rounded-md">
                {h > 0 ? (
                  <div
                    className="bg-primary w-full"
                    style={{ height: `${(h / max) * 100}%` }}
                    title={`${DAY_LABELS[i]} · ${formatHours(h)}`}
                  />
                ) : null}
              </div>
              <span className="text-muted-foreground text-[0.7rem]">{DAY_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </Section>

      <Tile icon={Clock} label="Total tracked" value={formatHours(total)} />

      <Section title={view.isProject ? "Contributors this week" : "Projects this week"}>
        {entries.length > 0 ? (
          <ul className="space-y-2.5">
            {entries.map((e, i) => (
              <EntryRow key={i} entry={e} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
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

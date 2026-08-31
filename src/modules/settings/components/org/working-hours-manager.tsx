"use client";

/**
 * Working hours — the org's declared day (`/v1/org/working-hours`, identity).
 *
 * **These four fields drive real behaviour and, until now, had no UI at all.** The route has been
 * deployed the whole time and `WorkingDaysManager` beside this card wrote `workdays` through it, but
 * `work_start`, `work_end`, `break_minutes` and the two thresholds were reachable only by calling
 * the API by hand. Two consequences worth knowing:
 *
 *  - **The productivity score's U term divides by the expected day** (`docs/PRODUCTIVITY.md` §1.2),
 *    so before this an org that runs a 6-hour day was still scored against 8 hours — a part-time
 *    employee could work every contracted minute and cap at 75% utilization.
 *  - **`late_threshold` and `min_present_minutes` decide who reads as late or partial** in the
 *    nightly attendance close, which is what appears on someone's attendance record.
 *
 * Its own save action, independent of the org-profile save bar — the same posture as the other
 * managers on this tab. Reads are open to members; writes need `settings:manage` (server 403 →
 * toast).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/shared/loader";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import { formatMinutes } from "@/lib/format";
import { invalidateWorkingHours } from "@/hooks/use-working-hours";
import {
  getWorkingHours,
  updateWorkingHours,
  type OrgWorkingHours,
} from "@/modules/settings/services/org.service";
import { recomputeAttendance } from "@/modules/attendance/services/attendance.service";

/** Local `YYYY-MM-DD` for a date `n` days before today — the recompute window is client-local. */
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The editable subset — `workdays` belongs to the card next to this one. */
interface HoursDraft {
  work_start: string;
  work_end: string;
  break_minutes: number;
  late_threshold: string;
  min_present_minutes: number;
}

const draftOf = (h: OrgWorkingHours): HoursDraft => ({
  work_start: h.work_start,
  work_end: h.work_end,
  break_minutes: h.break_minutes,
  late_threshold: h.late_threshold,
  min_present_minutes: h.min_present_minutes,
});

/** `"HH:MM"` → minutes past midnight; `null` when it isn't that shape. */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * The expected working day the score will actually divide by — mirrors
 * `insights::shared::org::expected_sec_of` (PRODUCTIVITY.md §1.2).
 *
 * Shown live because it is the whole point of these fields, and because the arithmetic is not
 * obvious: 09:00–18:00 with an hour's break is an *eight*-hour expected day, not nine. `null` means
 * the server will fall back to its 8h default rather than use what is typed.
 */
export function expectedMinutes(d: {
  work_start: string;
  work_end: string;
  break_minutes: number;
}): number | null {
  const start = toMinutes(d.work_start);
  const end = toMinutes(d.work_end);
  if (start === null || end === null || end <= start) return null;
  return Math.max(60, end - start - Math.max(0, d.break_minutes || 0));
}

const fmtDuration = (mins: number) => formatMinutes(mins);

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

export function WorkingHoursManager() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");
  // The recompute is an attendance write (re-resolves everyone's past days), gated on its own perm.
  const canRecompute = can("attendance:manage");

  const [saved, setSaved] = useState<OrgWorkingHours | null>(null);
  const [draft, setDraft] = useState<HoursDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getWorkingHours()
      .then((h) => {
        if (!live) return;
        setSaved(h);
        setDraft(draftOf(h));
      })
      .catch((e) => {
        if (live) setError(messageOf(e, "Couldn't load working hours."));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load]);

  const dirty = useMemo(
    () =>
      !!saved &&
      !!draft &&
      JSON.stringify(draft) !== JSON.stringify(draftOf(saved)),
    [draft, saved],
  );

  const expected = draft ? expectedMinutes(draft) : null;
  // Mirrored from the server so the reason is visible before the request, not after a 400.
  const invalidSpan = !!draft && expected === null;

  const set = <K extends keyof HoursDraft>(key: K, value: HoursDraft[K]) =>
    setDraft((cur) => (cur ? { ...cur, [key]: value } : cur));

  async function save() {
    if (!draft || !dirty || invalidSpan || saving) return;
    setSaving(true);
    try {
      const next = await updateWorkingHours(draft);
      setSaved(next);
      setDraft(draftOf(next));
      // Refresh the cached schedule so attendance/insights agree without a reload.
      invalidateWorkingHours(next);
      toast.success("Working hours saved", {
        description:
          "Productivity scores use the new expected day from the next recompute.",
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to change working hours.");
      } else if (e instanceof ApiError && e.status === 400) {
        toast.error("Check your entries", { description: e.message });
      } else {
        toast.error(messageOf(e, "Couldn't save working hours."));
      }
    } finally {
      setSaving(false);
    }
  }

  /**
   * Re-resolve recent already-closed days under the current schedule. Needed because changing the
   * working days/thresholds does not retroactively re-close past days — a Saturday closed while the
   * org was Mon–Fri keeps its "day off" status until this runs. Window is a fixed ~6 weeks, which
   * covers the calendar's browsable range and the recent-days list.
   */
  async function recompute() {
    if (recomputing) return;
    setRecomputing(true);
    try {
      const res = await recomputeAttendance(isoDaysAgo(45), isoDaysAgo(1));
      toast.success("Recent attendance recomputed", {
        description: `Re-resolved ${res.recomputed} day record${res.recomputed === 1 ? "" : "s"} under the current schedule.`,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to recompute attendance.");
      } else {
        toast.error(messageOf(e, "Couldn't recompute attendance."));
      }
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1.5">
          <CardTitle>Working hours</CardTitle>
          <CardDescription>
            The day your organization is scheduled to work. This sets the expected day
            productivity is measured against, and when someone counts as late or as
            having worked only part of a day.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex min-h-[6rem] items-center justify-center">
            <Loader label="Loading working hours…" />
          </div>
        ) : error || !draft ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-muted-foreground text-sm">
              {error ?? "Couldn't load working hours."}
            </p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="wh-start">Day starts</Label>
                <TimePicker
                  id="wh-start"
                  value={draft.work_start}
                  onChange={(v) => set("work_start", v)}
                  disabled={!canManage || saving}
                  stepMinutes={5}
                  // A working day must have a start: "Any time" would write an empty string into a
                  // setting the attendance close reads on every tenant, every night.
                  clearable={false}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-end">Day ends</Label>
                <TimePicker
                  id="wh-end"
                  value={draft.work_end}
                  onChange={(v) => set("work_end", v)}
                  disabled={!canManage || saving}
                  stepMinutes={5}
                  // A working day must have a start: "Any time" would write an empty string into a
                  // setting the attendance close reads on every tenant, every night.
                  clearable={false}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-break">Unpaid break (minutes)</Label>
                <Input
                  id="wh-break"
                  type="number"
                  min={0}
                  max={480}
                  value={draft.break_minutes}
                  disabled={!canManage || saving}
                  onChange={(e) => set("break_minutes", Number(e.target.value))}
                />
                <p className="text-muted-foreground text-xs">
                  Subtracted from the span above to get the expected working day.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-late">Late after</Label>
                <TimePicker
                  id="wh-late"
                  value={draft.late_threshold}
                  onChange={(v) => set("late_threshold", v)}
                  disabled={!canManage || saving}
                  stepMinutes={5}
                  // A working day must have a start: "Any time" would write an empty string into a
                  // setting the attendance close reads on every tenant, every night.
                  clearable={false}
                  className="w-full"
                />
                <p className="text-muted-foreground text-xs">
                  A first session after this marks the day late.
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="wh-min">Minimum minutes for a full day</Label>
                <Input
                  id="wh-min"
                  type="number"
                  min={1}
                  max={1440}
                  value={draft.min_present_minutes}
                  disabled={!canManage || saving}
                  onChange={(e) =>
                    set("min_present_minutes", Number(e.target.value))
                  }
                />
                <p className="text-muted-foreground text-xs">
                  Below this, a worked day is recorded as partial rather than present.
                </p>
              </div>
            </div>

            {invalidSpan ? (
              <p className="text-destructive flex items-start gap-2 text-sm">
                <Clock className="mt-0.5 size-4 shrink-0" />
                The day must end after it starts. Until this is valid, productivity is
                measured against the default 8-hour day rather than what&apos;s entered
                here.
              </p>
            ) : (
              <p className="text-muted-foreground flex items-start gap-2 text-xs">
                <Clock className="mt-0.5 size-3.5 shrink-0" />
                Expected working day:{" "}
                <span className="text-foreground font-medium">
                  {fmtDuration(expected ?? 480)}
                </span>{" "}
                — productivity is measured against this, so a shorter declared day is not
                penalised.
              </p>
            )}

            {canManage && dirty ? (
              <div className="border-border flex items-center gap-2 border-t pt-4">
                <Button size="sm" onClick={save} disabled={saving || invalidSpan}>
                  {saving ? "Saving…" : "Save working hours"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => saved && setDraft(draftOf(saved))}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            ) : null}

            {/* Applying a schedule change to *past* days: the nightly close only ever resolves
                yesterday, so already-closed days keep the status they were closed with until this
                re-runs the close over a recent window. */}
            {canRecompute ? (
              <div className="border-border flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-xs">
                  Changed the schedule? Recompute recent attendance so past days reflect the new
                  working days and thresholds (e.g. a now-working Saturday stops showing as a day
                  off).
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={recompute}
                  disabled={recomputing}
                >
                  {recomputing ? "Recomputing…" : "Recompute recent attendance"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

/**
 * Working days — which weekdays the org schedules (`/v1/org/working-hours`, identity).
 *
 * **This decides who is counted absent, not what gets recorded.** Time tracked on a designated day
 * off is still captured and still counts toward hours; an unscheduled day simply resolves
 * `non_workday` instead of `absent`, so nobody is marked truant for a quiet Sunday — and someone who
 * *does* work that Sunday still shows up as present.
 *
 * Its own save action, independent of the org-profile save bar (same posture as the other managers
 * on this tab). Reads are open to members; writes need `settings:manage` (server 403 → toast).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarRange } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { invalidateWorkingHours } from "@/hooks/use-working-hours";
import { type IsoWeekday } from "@/lib/workdays";
import {
  getWorkingHours,
  updateWorkingHours,
  type OrgWorkingHours,
} from "@/modules/settings/services/org.service";

/** Monday-first, matching the calendars elsewhere in the product. */
const DAYS: { iso: IsoWeekday; short: string; label: string }[] = [
  { iso: 1, short: "Mon", label: "Monday" },
  { iso: 2, short: "Tue", label: "Tuesday" },
  { iso: 3, short: "Wed", label: "Wednesday" },
  { iso: 4, short: "Thu", label: "Thursday" },
  { iso: 5, short: "Fri", label: "Friday" },
  { iso: 6, short: "Sat", label: "Saturday" },
  { iso: 7, short: "Sun", label: "Sunday" },
];

const sortedKey = (days: readonly IsoWeekday[]) =>
  [...days].sort((a, b) => a - b).join(",");

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

export function WorkingDaysManager() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");

  const [saved, setSaved] = useState<OrgWorkingHours | null>(null);
  const [draft, setDraft] = useState<IsoWeekday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getWorkingHours()
      .then((h) => {
        if (!live) return;
        setSaved(h);
        setDraft(h.workdays);
      })
      .catch((e) => {
        if (live) setError(messageOf(e, "Couldn't load working days."));
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
    () => !!saved && sortedKey(draft) !== sortedKey(saved.workdays),
    [draft, saved],
  );
  // The server rejects an empty list; mirror that here so the reason is visible before the request.
  const empty = draft.length === 0;

  function toggle(day: IsoWeekday) {
    setDraft((cur) =>
      cur.includes(day)
        ? cur.filter((d) => d !== day)
        : [...cur, day].sort((a, b) => a - b),
    );
  }

  async function save() {
    if (!dirty || empty || saving) return;
    setSaving(true);
    try {
      const next = await updateWorkingHours({ workdays: draft });
      setSaved(next);
      setDraft(next.workdays);
      // Refresh the cached schedule so the attendance/insights surfaces agree without a reload.
      invalidateWorkingHours(next);
      toast.success("Working days saved", {
        description: "Attendance will use this schedule from the next nightly close.",
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to change working days.");
      } else if (e instanceof ApiError && e.status === 400) {
        toast.error("Check your selection", { description: e.message });
      } else {
        toast.error(messageOf(e, "Couldn't save working days."));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1.5">
          <CardTitle>Working days</CardTitle>
          <CardDescription>
            The days your organization is scheduled to work. Attendance only counts
            someone absent on these days — time tracked on a day off is still recorded.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex min-h-[6rem] items-center justify-center">
            <Loader label="Loading working days…" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Working days">
              {DAYS.map((d) => {
                const on = draft.includes(d.iso);
                return (
                  <Button
                    key={d.iso}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    aria-label={d.label}
                    disabled={!canManage || saving}
                    className={cn("min-w-[3.75rem]", !on && "text-muted-foreground")}
                    onClick={() => toggle(d.iso)}
                  >
                    {d.short}
                  </Button>
                );
              })}
            </div>

            {empty ? (
              <p className="text-destructive flex items-start gap-2 text-sm">
                <CalendarRange className="mt-0.5 size-4 shrink-0" />
                Select at least one working day. With none selected nobody could ever be
                marked absent and your attendance rate would stop meaning anything.
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                {draft.length} {draft.length === 1 ? "day" : "days"} a week ·{" "}
                {DAYS.filter((d) => !draft.includes(d.iso))
                  .map((d) => d.short)
                  .join(", ") || "no days"}{" "}
                off
              </p>
            )}

            {canManage && dirty ? (
              <div className="border-border flex items-center gap-2 border-t pt-4">
                <Button size="sm" onClick={save} disabled={saving || empty}>
                  {saving ? "Saving…" : "Save working days"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => saved && setDraft(saved.workdays)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

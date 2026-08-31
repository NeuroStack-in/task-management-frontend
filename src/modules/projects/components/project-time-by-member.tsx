"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/shared/user-avatar";
import { usePermissions } from "@/hooks/use-permissions";
import { mapWithConcurrency } from "@/lib/concurrency";
import { formatHours } from "@/lib/format";
import { getUserTimesheet } from "@/modules/time-tracking/services/timesheet.service";

import { Segmented } from "./parts";
import type { UserMini } from "../lib";

type Period = "week" | "month";

const pad = (n: number) => String(n).padStart(2, "0");
const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** `{from,to}` local ISO dates for the period — Monday→today (week) or the 1st→today (month). */
function rangeFor(period: Period): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = isoLocal(today);
  if (period === "week") {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Mon=0 after the shift
    return { from: isoLocal(monday), to };
  }
  return { from: isoLocal(new Date(today.getFullYear(), today.getMonth(), 1)), to };
}

interface MemberTime {
  userId: string;
  seconds: number;
}

/**
 * **Time by member** — how many hours each project member tracked **against this project** over the
 * selected period. This is the project × person cross-tab neither the team timesheet (project totals
 * *or* per-person totals across all projects) nor the project report (tasks/status only) shows.
 *
 * Fans out the per-user timesheet read (bounded at 4, skip-on-fail so one 403 doesn't blank the
 * panel) and sums only the entries whose `project_id` is this project. Reading another person's
 * timesheet needs `TimeReadTeam`, so this renders **only** for a viewer who can read
 * other people's time — an Employee sees no card at all, rather than an empty one they have no way
 * to fill;
 * everyone else gets nothing (the server wouldn't serve them anyway).
 */
export function ProjectTimeByMember({
  projectId,
  memberIds,
  userMap,
}: {
  projectId: string;
  memberIds: string[];
  userMap: Record<string, UserMini>;
}) {
  const { can } = usePermissions();
  // **The bit the SERVER enforces, not the one that sounds right.**
  //
  // This was `time-tracking:view`, which an Employee holds — it is what lets them open their own
  // Time Tracking page (bit 30, `TimeReadSelf`). But every row here comes from
  // `GET /v1/timesheet/user/{id}`, which opens with `auth.require(Permission::TimeReadTeam)` before
  // it even looks at whose timesheet was asked for. So an Employee got the card, all the fan-out
  // reads 403'd — including the one for their own id — and the `.catch` below turned each refusal
  // into zero seconds. The panel then said "No time tracked yet" about a project with 27 entries
  // against it, telling the viewer to go and do the thing they had already done.
  //
  // `time-tracking:manage` is what bits 31/32 (`TimeReadTeam`/`TimeReadOrg`) light in
  // `lib/permission-bits.ts`, so the boundary is now the same on both sides.
  const allowed = can("time-tracking:manage");

  const [period, setPeriod] = useState<Period>("month");
  // `null` = loading; an array = loaded (possibly empty).
  const [rows, setRows] = useState<MemberTime[] | null>(null);

  // Stable key so the effect doesn't re-run just because the array identity changed.
  const memberKey = useMemo(() => [...memberIds].sort().join(","), [memberIds]);

  useEffect(() => {
    if (!allowed || memberIds.length === 0) {
      setRows([]);
      return;
    }
    let live = true;
    setRows(null);
    const { from, to } = rangeFor(period);
    void mapWithConcurrency(memberIds, 4, (uid) =>
      getUserTimesheet(uid, from, to)
        .then((grid) => {
          let seconds = 0;
          for (const day of grid.days) {
            for (const e of day.entries) {
              if (e.project_id === projectId) seconds += e.duration_secs ?? 0;
            }
          }
          return { userId: uid, seconds };
        })
        // A member whose timesheet we can't read, or a failed read, contributes nothing rather
        // than failing the whole panel. This is a per-member fallback and is only sound as one:
        // when the CALLER cannot read team time at all, every read fails and the sum is a uniform
        // zero indistinguishable from an idle project. The `allowed` gate above is what keeps that
        // case from reaching here.
        .catch(() => ({ userId: uid, seconds: 0 })),
    ).then((results) => {
      if (live) setRows([...results].sort((a, b) => b.seconds - a.seconds));
    });
    return () => {
      live = false;
    };
    // memberKey stands in for the (stable) member list; the others drive a re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, memberKey, period, allowed]);

  // Only for viewers who can read team time — checked after the hooks so hook order stays stable.
  if (!allowed) return null;

  const withTime = rows?.filter((r) => r.seconds > 0) ?? [];
  const totalSec = withTime.reduce((s, r) => s + r.seconds, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle>Time by member</CardTitle>
          <CardDescription>
            Hours tracked against this project {period === "week" ? "this week" : "this month"}
          </CardDescription>
        </div>
        <div className="w-36 shrink-0">
          <Segmented
            options={[
              { value: "week", label: "Week" },
              { value: "month", label: "Month" },
            ]}
            value={period}
            onChange={setPeriod}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows === null ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : withTime.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Clock className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm font-medium">No time tracked yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Each member&apos;s hours on this project appear here once they run a timer against it.
            </p>
          </div>
        ) : (
          <>
            {withTime.map((r) => {
              const u = userMap[r.userId];
              const pct = totalSec > 0 ? (r.seconds / totalSec) * 100 : 0;
              return (
                <div key={r.userId} className="flex items-center gap-3">
                  <UserAvatar
                    userId={r.userId}
                    name={u?.name ?? "—"}
                    className="size-8"
                    fallbackClassName="text-[10px]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u?.name ?? "Unknown member"}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-medium tabular-nums">
                    {formatHours(r.seconds / 3600)}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t border-border pt-2.5 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-mono font-medium tabular-nums">
                {formatHours(totalSec / 3600)}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

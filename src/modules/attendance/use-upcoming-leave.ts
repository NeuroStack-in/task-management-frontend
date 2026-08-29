"use client";

import { useEffect, useMemo, useState } from "react";

import { getQueue } from "@/modules/approvals/services/approvals.service";
import { getTypes } from "@/modules/leave/services/leave.service";
import { employeeNameMap } from "@/modules/employees/services/employees.service";

export interface UpcomingLeaveItem {
  userId: string;
  name: string;
  typeName: string;
  /** `YYYY-MM-DD`. */
  from: string;
  to: string;
  days: number;
  /** Minutes of permission; 0 for a full day. */
  permissionMinutes: number;
  fromTime?: string;
  toTime?: string;
}

export interface UpcomingLeaveData {
  items: UpcomingLeaveItem[];
  loading: boolean;
  error: string | null;
}

/**
 * Approved leave that has not started yet — "who will be away, and when".
 *
 * Built from the **approvals queue**, not a new endpoint: `GET /v1/approvals?status=approved`
 * already returns every approved request with its dates, and an admin can already read it (it is
 * what the Approvals page renders). A dedicated "upcoming" route would be a second definition of
 * "approved leave" to keep in step with the first.
 *
 * **Strictly future.** A leave covering today is already visible on the attendance roster as
 * "On leave"; repeating it here would make the panel a duplicate of the page it sits on. The
 * question this answers is the one the roster cannot: what is coming.
 */
export function useUpcomingLeave(enabled: boolean): UpcomingLeaveData {
  const [items, setItems] = useState<UpcomingLeaveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayIso = useMemo(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // Names and leave-type labels are niceties: a failure degrades to the id rather than
        // blanking the panel, the same rule the timesheet's project catalog follows.
        const [rows, typeName, names] = await Promise.all([
          getQueue("approved"),
          getTypes()
            .then((ts) => new Map(ts.map((t) => [t.type_id, t.name])))
            .catch(() => new Map<string, string>()),
          employeeNameMap().catch(() => new Map<string, string>()),
        ]);
        if (!live) return;
        const out = rows
          .filter((r) => r.from > todayIso)
          .map((r) => ({
            userId: r.user_id,
            name: names.get(r.user_id) ?? r.user_id,
            typeName: typeName.get(r.type_id) ?? "Leave",
            from: r.from,
            to: r.to,
            days: r.days,
            permissionMinutes: r.permission_minutes ?? 0,
            fromTime: r.from_time,
            toTime: r.to_time,
          }))
          // Soonest first — the panel is read to plan the next few days, not to browse a year.
          .sort((a, b) => a.from.localeCompare(b.from) || a.name.localeCompare(b.name));
        setItems(out);
      } catch {
        if (live) setError("Couldn't load upcoming leave.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled, todayIso]);

  return { items, loading, error };
}

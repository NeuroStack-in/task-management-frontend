"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getWorkingHours,
  type OrgWorkingHours,
} from "@/modules/settings/services/org.service";
import { useAuthStore } from "@/stores/auth.store";
import { DEFAULT_WORKDAYS, safeWorkdays, type IsoWeekday } from "@/lib/workdays";

/**
 * The org's configured schedule (`GET /v1/org/working-hours`), for the attendance and insights
 * aggregations that must agree with the backend's attendance close cron.
 *
 * Cached at module scope **keyed by tenant**, mirroring `useOrgName` — fetched once per session,
 * never leaked across an org switch. Until it resolves (or if the read fails) callers get the
 * Mon–Fri default, which is exactly what the server would apply for an unconfigured org, so a slow
 * or failed settings read degrades to today's behaviour rather than an empty chart.
 *
 * Call `invalidateWorkingHours()` after a successful save so open surfaces pick the change up
 * without a reload.
 */
let cache: { tenant: string; hours: OrgWorkingHours } | null = null;

export function invalidateWorkingHours(next?: OrgWorkingHours): void {
  if (next && cache) cache = { tenant: cache.tenant, hours: next };
  else cache = null;
}

export function useWorkingHours(): OrgWorkingHours | null {
  const tenant = useAuthStore((s) => s.user?.organizationId ?? null);
  const [hours, setHours] = useState<OrgWorkingHours | null>(
    cache && cache.tenant === tenant ? cache.hours : null,
  );

  useEffect(() => {
    if (!tenant) return;
    if (cache && cache.tenant === tenant) {
      setHours(cache.hours);
      return;
    }
    let live = true;
    getWorkingHours()
      .then((h) => {
        if (!live) return;
        cache = { tenant, hours: h };
        setHours(h);
      })
      .catch(() => {
        // Fall through to the Mon–Fri default — the same schedule the server assumes when unset.
        // Surfacing this would put an error banner on pages the schedule only decorates.
      });
    return () => {
      live = false;
    };
  }, [tenant]);

  return hours;
}

/**
 * Just the scheduled weekdays, defaulted and guaranteed non-empty.
 *
 * **Memoised deliberately.** Callers feed this into `useMemo` dependency arrays that drive day-range
 * fetches; a fresh array each render would recompute the range every time and re-fire the fetch in a
 * loop.
 */
export function useWorkdays(): IsoWeekday[] {
  const hours = useWorkingHours();
  return useMemo(
    () => (hours ? safeWorkdays(hours.workdays) : [...DEFAULT_WORKDAYS]),
    [hours],
  );
}

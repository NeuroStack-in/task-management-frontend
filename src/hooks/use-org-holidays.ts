"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listHolidays,
  type OrgHoliday,
} from "@/modules/settings/services/org.service";
import { useAuthStore } from "@/stores/auth.store";

/**
 * The org's holiday calendar (`GET /v1/org/holidays`), for the attendance and time-tracking surfaces
 * that mark a non-working holiday day.
 *
 * Cached at module scope **keyed by tenant**, mirroring `useWorkingHours` / `useOrgName` — fetched
 * once per session, never leaked across an org switch. Until it resolves (or if the read fails)
 * callers get an empty index, so nothing is marked rather than an error banner appearing on a page
 * holidays only decorate.
 */
let cache: { tenant: string; holidays: OrgHoliday[] } | null = null;

export interface HolidayIndex {
  /** Every org holiday date as `YYYY-MM-DD`. */
  dates: Set<string>;
  /** True when `iso` (`YYYY-MM-DD`) is an org holiday. */
  isHoliday: (iso: string) => boolean;
  /** The holiday's name for `iso` (`YYYY-MM-DD`), or `undefined` if that day isn't a holiday. */
  nameFor: (iso: string) => string | undefined;
}

/**
 * Pure date-set builder — no React, so it is unit-testable on its own.
 *
 * Last write wins if two holiday rows share a date (the server shouldn't emit dupes, but the UI must
 * not crash on them), and rows without a `date` are skipped rather than adding an empty key.
 */
export function buildHolidayIndex(list: readonly OrgHoliday[]): HolidayIndex {
  const byDate = new Map<string, string>();
  for (const h of list) {
    if (h?.date) byDate.set(h.date, h.name);
  }
  const dates = new Set(byDate.keys());
  return {
    dates,
    isHoliday: (iso) => dates.has(iso),
    nameFor: (iso) => byDate.get(iso),
  };
}

export function useOrgHolidays(): HolidayIndex {
  const tenant = useAuthStore((s) => s.user?.organizationId ?? null);
  const [list, setList] = useState<OrgHoliday[]>(
    cache && cache.tenant === tenant ? cache.holidays : [],
  );

  useEffect(() => {
    if (!tenant) return;
    if (cache && cache.tenant === tenant) {
      setList(cache.holidays);
      return;
    }
    let live = true;
    listHolidays()
      .then((h) => {
        if (!live) return;
        cache = { tenant, holidays: h };
        setList(h);
      })
      .catch(() => {
        // Empty index — decorate nothing rather than surface an error on a page holidays annotate.
      });
    return () => {
      live = false;
    };
  }, [tenant]);

  return useMemo(() => buildHolidayIndex(list), [list]);
}

/** Drop the cached holiday calendar — call after a holidays save so open surfaces pick it up. */
export function invalidateOrgHolidays(): void {
  cache = null;
}

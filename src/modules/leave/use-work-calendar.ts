"use client";

import { useMemo } from "react";
import { useOrgHolidays } from "@/hooks/use-org-holidays";
import { useWorkdays } from "@/hooks/use-working-hours";
import type { WorkCalendar } from "./lib/working-days";

/**
 * The org's working week and holidays, as leave is charged against them (owner decision
 * 2026-10-20, UX audit TIME-07). Both reads are cached per tenant; until they land this is the
 * Mon–Fri, no-holiday default — the server's own count is what a request is actually charged.
 */
export function useWorkCalendar(): WorkCalendar {
  const workdays = useWorkdays();
  const { dates } = useOrgHolidays();
  return useMemo(() => ({ workdays, holidays: dates }), [workdays, dates]);
}

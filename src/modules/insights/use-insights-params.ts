"use client";

/**
 * The day and department every Analytics tab shows, held in the URL (UX audit 2026-10-16, MON-13) —
 * see `lib/url-params` for why.
 *
 * The value is held in state as well as the URL, so a date step renders at once instead of waiting
 * for the router; the URL is written with `history.replaceState`, which Next's `useSearchParams`
 * follows without a server round trip (and without a history entry per day stepped through).
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { todayIso } from "@/lib/format";
import {
  DATE_PARAM,
  DEPT_PARAM,
  nextSearch,
  validDateParam,
  validDeptParam,
} from "./lib/url-params";

/** Replace the current URL's query, keeping its path and hash. */
export function replaceSearch(update: Record<string, string | null>): void {
  if (typeof window === "undefined") return;
  const { pathname, search, hash } = window.location;
  window.history.replaceState(null, "", `${pathname}${nextSearch(search, update)}${hash}`);
}

/**
 * `[date, setDate, today]` — the hub's day. `date` is `""` until mounted (no server/client date
 * mismatch), then `?date=` when it is a real day that isn't in the future, else today. Setting today
 * drops the parameter, so a bare URL keeps meaning "today" tomorrow too.
 */
export function useInsightsDate(): [string, (iso: string) => void, string] {
  const raw = useSearchParams().get(DATE_PARAM);
  const [date, setLocal] = useState("");
  const today = todayIso();
  useEffect(() => {
    const t = todayIso();
    setLocal(validDateParam(raw, t) ? raw : t);
  }, [raw]);
  const setDate = useCallback((iso: string) => {
    if (!iso) return;
    setLocal(iso);
    replaceSearch({ [DATE_PARAM]: iso === todayIso() ? null : iso });
  }, []);
  return [date, setDate, today];
}

/** `[dept, setDept]` — the hub's department id, or `"all"`. */
export function useInsightsDept(): [string, (id: string) => void] {
  const raw = useSearchParams().get(DEPT_PARAM);
  const [dept, setLocal] = useState<string>(validDeptParam(raw) ? raw : "all");
  useEffect(() => {
    setLocal(validDeptParam(raw) ? raw : "all");
  }, [raw]);
  const setDept = useCallback((id: string) => {
    const next = validDeptParam(id) ? id : "all";
    setLocal(next);
    replaceSearch({ [DEPT_PARAM]: next === "all" ? null : next });
  }, []);
  return [dept, setDept];
}

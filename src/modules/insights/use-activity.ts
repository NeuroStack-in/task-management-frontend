"use client";

import { useEffect, useState } from "react";
import { LIVE_REFRESH_MS, useLiveRefresh } from "@/hooks/use-live-refresh";
import { ApiError } from "@/lib/api";
import { todayIso } from "@/lib/format";
import { getOrgActivity, type OrgActivity } from "./services/insights.service";

export interface OrgActivityState {
  data: OrgActivity | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Loads the org activity rollup for a day (`YYYY-MM-DD`). Empty `date` skips the fetch. */
export function useOrgActivity(date: string): OrgActivityState {
  const [data, setData] = useState<OrgActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Live: a quiet background re-fetch every 30 s, so time on screen keeps up with what the
  // agents have uploaded. `reload` stays the visible path; the poll uses `refresh`.
  //
  // **Today only.** A past day's rollup no longer moves, and an empty `date` (the Activity tab in
  // Weekly/Monthly, which does not read this) has nothing to fetch — polling either was a request
  // every 30 s for an answer nothing displays (QA audit 2026-10-08, WP-492).
  const { nonce, reload, isBackground } = useLiveRefresh(
    date !== "" && date === todayIso() ? LIVE_REFRESH_MS : null,
  );
  useEffect(() => {
    if (!date) {
      setLoading(false);
      return;
    }
    let live = true;
    if (!isBackground()) setLoading(true);
    setError(null);
    // Another day's figures must not sit under the newly picked date while it loads; only a
    // refresh of the **same** day keeps them on screen (QA audit 2026-10-08, WP-279).
    setData((d) => (d && d.date !== date ? null : d));
    getOrgActivity(date)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(messageOf(e, "the team's activity"));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [date, nonce, isBackground]);

  return { data, loading, error, reload };
}

function messageOf(e: unknown, what: string): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to team insights.";
    return e.message;
  }
  return `Couldn't load ${what}. Check your connection and retry.`;
}

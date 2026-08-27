"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { ApiError } from "@/lib/api";
import {
  getOrgActivity,
  getSelfActivity,
  type OrgActivity,
  type SelfActivity,
} from "./services/insights.service";

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
  const { nonce, reload, isBackground } = useLiveRefresh();
  useEffect(() => {
    if (!date) return;
    let live = true;
    if (!isBackground()) setLoading(true);
    setError(null);
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

export interface SelfActivityState {
  data: SelfActivity | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Loads the caller's own daily scores over `[from, to]` (`YYYY-MM-DD`). Empty bounds skip the fetch. */
export function useSelfActivity(from: string, to: string): SelfActivityState {
  const [data, setData] = useState<SelfActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Live, same as the day hook above.
  const { nonce, reload, isBackground } = useLiveRefresh();

  useEffect(() => {
    if (!from || !to) return;
    let live = true;
    if (!isBackground()) setLoading(true);
    setError(null);
    getSelfActivity(from, to)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(messageOf(e, "your activity trend"));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [from, to, nonce]);

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

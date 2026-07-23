"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  getAttention,
  regenerateAttention,
  type AttentionList,
} from "./services/insights.service";

export interface AttentionState {
  data: AttentionList | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Force a fresh AI brief over the current ranking (a billed model run; otherwise cached). */
  regenerate: () => void;
  regenerating: boolean;
}

/** Loads the AttentionList for a day (`YYYY-MM-DD`). Empty `date` skips the fetch. */
export function useAttention(date: string): AttentionState {
  const [data, setData] = useState<AttentionList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!date) return;
    let live = true;
    setLoading(true);
    setError(null);
    getAttention(date)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [date, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const [regenerating, setRegenerating] = useState(false);
  const regenerate = useCallback(() => {
    if (!date || regenerating) return;
    setRegenerating(true);
    regenerateAttention(date)
      .then((d) => setData(d))
      .catch((e) => setError(messageOf(e)))
      .finally(() => setRegenerating(false));
  }, [date, regenerating]);

  return { data, loading, error, reload, regenerate, regenerating };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to team insights.";
    return e.message;
  }
  return "Couldn't load the attention list. Check your connection and retry.";
}

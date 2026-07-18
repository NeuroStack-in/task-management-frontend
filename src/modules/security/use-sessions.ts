"use client";

/**
 * Your signed-in sessions from the live backend (`GET /v1/me/sessions`, identity context).
 *
 * The row is lean by necessity — `{session_id, last_seen}` only. Cognito exposes no device / IP /
 * location without its paid advanced-security tier, so those columns are honestly absent rather than
 * invented, and there is no per-session revoke endpoint (§15). An empty list is the honest failure:
 * we never fall back to demo devices on a real account.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listMySessions, type ApiSession } from "./services/security.service";

export interface SessionsState {
  sessions: ApiSession[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useSessions(): SessionsState {
  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    listMySessions()
      .then((s) => {
        if (!live) return;
        setSessions([...s].sort((a, b) => (b.last_seen ?? 0) - (a.last_seen ?? 0)));
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
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { sessions, loading, error, reload };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    return e.message;
  }
  return "Couldn't load your sessions. Check your connection and retry.";
}

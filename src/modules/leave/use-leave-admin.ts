"use client";

/**
 * Leave administration — the org's leave-type catalog and the balance backfill.
 *
 * Kept apart from `use-leave` (which is the *caller's own* leave) because this is org configuration:
 * it carries the config `version` for the optimistic lock, and its writes need the backend's
 * `leave:manage` bit. A fresh org has no stored config at all — the server answers the platform
 * defaults at `version: 0`, so the editor always has something to show.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import * as api from "./services/leave.service";
import type { ApiLeaveType, ApiSeedResult } from "./services/leave.service";

export interface LeaveAdminData {
  types: ApiLeaveType[];
  /** Optimistic-lock version to send back with a save. */
  version: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Replace the whole catalog. Throws `ApiError` (409 on a stale version). */
  save: (types: ApiLeaveType[]) => Promise<void>;
  /** Reset to the platform defaults. */
  restore: () => Promise<void>;
  /** Backfill balances for a year (defaults to the current year server-side). */
  seed: (year?: string) => Promise<ApiSeedResult>;
}

export function useLeaveAdmin(enabled = true): LeaveAdminData {
  const [types, setTypes] = useState<ApiLeaveType[]>([]);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    api
      .getTypesConfig()
      .then((cfg) => {
        if (!live) return;
        setTypes(cfg.types);
        setVersion(cfg.version);
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
  }, [nonce, enabled]);

  // Both writes answer with the authoritative catalog + its new version, so state is adopted from
  // the response rather than re-read — that also keeps the lock version in step for the next save.
  const save = useCallback(
    async (next: ApiLeaveType[]) => {
      const cfg = await api.setTypes(next, version);
      setTypes(cfg.types);
      setVersion(cfg.version);
    },
    [version],
  );

  const restore = useCallback(async () => {
    const cfg = await api.restoreTypes();
    setTypes(cfg.types);
    setVersion(cfg.version);
  }, []);

  const seed = useCallback((year?: string) => api.seedBalances(year), []);

  return { types, version, loading, error, reload, save, restore, seed };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to leave configuration.";
    return e.message;
  }
  return "Couldn't load leave types. Check your connection and retry.";
}

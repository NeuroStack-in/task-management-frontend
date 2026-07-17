"use client";

/**
 * The caller's leave — balances, request history, and the org's type catalog — from the real backend.
 *
 * One hook feeding the leave page: it loads all three reads together, exposes them, and provides
 * `submit`/`cancel` that hit the server and then re-read (so the list and the balances stay in step
 * with what the server actually recorded, rather than a guessed optimistic edit).
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import * as api from "./services/leave.service";
import type {
  ApiBalance,
  ApiLeaveRequest,
  ApiLeaveType,
  NewLeaveRequest,
} from "./services/leave.service";

export interface LeaveData {
  balances: ApiBalance[];
  requests: ApiLeaveRequest[];
  types: ApiLeaveType[];
  /** `type_id → display name`, for labelling requests whose type is just an id. */
  typeName: (typeId: string) => string;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Submit a new request; resolves once the server has recorded it and the page re-read. */
  submit: (req: NewLeaveRequest) => Promise<void>;
  /** Withdraw a request; resolves after the server transition and re-read. */
  cancel: (id: string) => Promise<void>;
}

export function useLeave(): LeaveData {
  const [balances, setBalances] = useState<ApiBalance[]>([]);
  const [requests, setRequests] = useState<ApiLeaveRequest[]>([]);
  const [types, setTypes] = useState<ApiLeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // The type catalog is a nicety (labels + the picker). Its failure — e.g. a role without
        // `leave:manage` visibility — must not blank the page, so it degrades to an empty list while
        // balances and requests, the actual content, still load.
        const [bal, reqs, tys] = await Promise.all([
          api.getBalances(),
          api.getRequests(),
          api.getTypes().catch(() => [] as ApiLeaveType[]),
        ]);
        if (!live) return;
        setBalances(bal.balances);
        setRequests(reqs);
        setTypes(tys);
      } catch (e) {
        if (live) setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce]);

  // Prefer the type catalog for names, but fall back to a balance's name (balances carry it too), so
  // a request's type still labels even if the catalog read failed. Last resort: the raw id.
  const typeName = useCallback(
    (typeId: string): string => {
      return (
        types.find((t) => t.type_id === typeId)?.name ??
        balances.find((b) => b.type_id === typeId)?.name ??
        typeId
      );
    },
    [types, balances],
  );

  const submit = useCallback(
    async (req: NewLeaveRequest) => {
      await api.createRequest(req);
      reload();
    },
    [reload],
  );

  const cancel = useCallback(
    async (id: string) => {
      await api.cancelRequest(id);
      reload();
    },
    [reload],
  );

  return {
    balances,
    requests,
    types,
    typeName,
    loading,
    error,
    reload,
    submit,
    cancel,
  };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to leave.";
    return e.message;
  }
  return "Couldn't load your leave. Check your connection and retry.";
}

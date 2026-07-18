"use client";

/**
 * The org's live subscription (`GET /v1/billing`) — plan, seats, status.
 *
 * This is the real, money-adjacent state. What the backend does **not** serve yet — invoices, a
 * payment method, historical spend — has no endpoint (invoicing/payments are unbuilt seams), so the
 * billing surfaces show honest "not enabled" states for those rather than the old mock rows.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  changePlan as changePlanRequest,
  getBillingOverview,
  type BillingOverview,
  type ChangePlanRequest,
} from "./services/billing.service";

export interface BillingState {
  overview: BillingOverview | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /**
   * Switch the org's plan (`POST /v1/billing/change-plan`). Resolves with the server's new
   * overview, which is adopted directly — the handler returns the authoritative post-change state
   * (including the derived `seat_cap`), so there is nothing to re-read or guess.
   */
  changePlan: (req: ChangePlanRequest) => Promise<BillingOverview>;
}

export function useBilling(): BillingState {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getBillingOverview()
      .then((o) => {
        if (live) setOverview(o);
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

  const changePlan = useCallback(async (req: ChangePlanRequest) => {
    const next = await changePlanRequest(req);
    setOverview(next);
    return next;
  }, []);

  return { overview, loading, error, reload, changePlan };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to billing.";
    return e.message;
  }
  return "Couldn't load billing. Check your connection and retry.";
}

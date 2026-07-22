"use client";

/**
 * The tenant's security events from the live backend (`GET /v1/security-events`, identity context)
 * — the audit trail pre-filtered to the `security` category (LLD §15), newest-first.
 *
 * The row is lean by design — `{ts, actor, category, action, target?}`. There is no IP, device,
 * severity, or outcome on the server, so none is shown, and no pagination cursor (the "load more"
 * in the feed reveals more of the fetched window client-side). `actor` is a Cognito user id; it is
 * joined to the employee directory for a display name, mirroring `use-audit`.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { listEmployees } from "@/modules/employees/services/employees.service";
import { listSecurityEvents, type ApiSecurityEvent } from "./services/security.service";

export interface SecurityEvent {
  key: string;
  /** Epoch seconds. */
  ts: number;
  timestamp: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string | null;
}

export interface SecurityEventsState {
  events: SecurityEvent[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function fmt(tsSeconds: number): string {
  const d = new Date(tsSeconds * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function useSecurityEvents(enabled = true): SecurityEventsState {
  const currentUser = useAuthStore((s) => s.user);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [rows, roster] = await Promise.all([
          listSecurityEvents(),
          listEmployees().catch(() => []),
        ]);
        if (!live) return;
        const names = new Map<string, string>();
        for (const e of roster) names.set(e.user_id, e.name);
        if (currentUser?.id && currentUser.name) names.set(currentUser.id, currentUser.name);

        setEvents(
          rows.map((r: ApiSecurityEvent, i: number) => ({
            key: `${r.ts}-${r.actor}-${r.action}-${i}`,
            ts: r.ts,
            timestamp: fmt(r.ts),
            actorId: r.actor,
            actorName: names.get(r.actor) ?? shortId(r.actor),
            action: r.action,
            target: r.target ?? null,
          })),
        );
      } catch (e) {
        if (live) setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [enabled, nonce, currentUser?.id, currentUser?.name]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { events, loading, error, reload };
}

/** A recognisable stub of an unresolved actor id — never a blank cell. */
function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to security events.";
    return e.message;
  }
  return "Couldn't load security events. Check your connection and retry.";
}

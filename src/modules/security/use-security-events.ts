"use client";

/**
 * The org's security-category audit events, with `actor` ids resolved to names.
 *
 * Deliberately *not* provided, because the server does not have it: severity. The mock ranked events
 * as "flagged"/"critical" and rendered an alert count from that; the real row carries only
 * `{ts, actor, category, action, target?}`. Classifying risk client-side from an action string would
 * be inventing a security signal, so the view lists events plainly instead.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { listEmployees } from "@/modules/employees/services/employees.service";
import { listSecurityEvents, type ApiSecurityEvent } from "./services/security.service";

export interface SecurityEvent {
  key: string;
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
  /** 403 here means "you may view Security but not its event trail" — not a failure. */
  forbidden: boolean;
  error: string | null;
  reload: () => void;
}

function fmt(tsSeconds: number): string {
  const d = new Date(tsSeconds * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function useSecurityEvents(): SecurityEventsState {
  const currentUser = useAuthStore((s) => s.user);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setForbidden(false);

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
          rows.map((r: ApiSecurityEvent) => ({
            key: `${r.ts}-${r.actor}-${r.action}`,
            ts: r.ts,
            timestamp: fmt(r.ts),
            actorId: r.actor,
            actorName: names.get(r.actor) ?? shortId(r.actor),
            action: r.action,
            target: r.target ?? null,
          })),
        );
      } catch (e) {
        if (!live) return;
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce, currentUser?.id, currentUser?.name]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { events, loading, forbidden, error, reload };
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    return e.message;
  }
  return "Couldn't load security events. Check your connection and retry.";
}

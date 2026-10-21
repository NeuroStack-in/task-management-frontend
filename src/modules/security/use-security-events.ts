"use client";

/**
 * The tenant's security events from the live backend (`GET /v1/security-events`, identity context)
 * — the audit trail pre-filtered to the `security` category (LLD §15), newest-first.
 *
 * The row is lean by design — `{ts, actor, category, action, target?}`. There is no IP, device,
 * severity, or outcome on the server, so none is shown, and no pagination cursor (the "load more"
 * in the feed reveals more of the fetched window client-side). `actor` is a Cognito user id — or a
 * device's agent id for agent-side events; it is joined to the directory and the fleet for a display
 * name, mirroring `use-audit`.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { formatDateTime, isUuid } from "@/lib/format";
import { useAuthStore } from "@/stores/auth.store";
import { listAllEmployees } from "@/modules/employees/services/employees.service";
import { listFleet } from "@/modules/agents/services/fleet.service";
import { auditActionLabel, resolveAuditTarget } from "@/modules/audit/lib/categories";
import { listSecurityEvents, type ApiSecurityEvent } from "./services/security.service";

export interface SecurityEvent {
  key: string;
  /** Epoch seconds. */
  ts: number;
  timestamp: string;
  actorId: string;
  actorName: string;
  /** The actor is an agent on a device, not a person. */
  actorIsDevice: boolean;
  /** The action in words; the code is on `actionCode`. */
  action: string;
  actionCode: string;
  /** The target in words where its id resolves to a person or a device. */
  target: string | null;
}

export interface SecurityEventsState {
  events: SecurityEvent[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** The one date notation (UX audit XC-06) — it printed "2026-10-15 14:05". */
const fmt = (tsSeconds: number): string => formatDateTime(tsSeconds * 1000);

/**
 * Said for an id the directory and the fleet can't name — a removed employee, or someone the reader's
 * scope can't see. It printed the first eight characters of the id (UX audit SET-23 / XC-12: no raw
 * ids); the device list says the same words for the same case.
 */
const UNRESOLVED = "Outside your directory";

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
        // The fleet too, as `use-audit` does: capture-now and device events are stamped with a
        // DEVICE's id, which the roster never resolves — they showed a short id under a person's
        // avatar (QA audit 2026-10-08, WP-520). Best-effort, like the roster.
        const [rows, roster, fleet] = await Promise.all([
          listSecurityEvents(),
          listAllEmployees().catch(() => []),
          listFleet().catch(() => ({ devices: [] })),
        ]);
        if (!live) return;
        const names = new Map<string, string>();
        for (const e of roster) names.set(e.user_id, e.name);
        if (currentUser?.id && currentUser.name) names.set(currentUser.id, currentUser.name);
        const devices = new Map<string, string>();
        for (const d of fleet.devices ?? []) devices.set(d.agent_id, `${d.hostname} · agent`);

        setEvents(
          rows.map((r: ApiSecurityEvent, i: number) => ({
            key: `${r.ts}-${r.actor}-${r.action}-${i}`,
            ts: r.ts,
            timestamp: fmt(r.ts),
            actorId: r.actor,
            actorName: names.get(r.actor) ?? devices.get(r.actor) ?? UNRESOLVED,
            actorIsDevice: !names.has(r.actor) && devices.has(r.actor),
            action: auditActionLabel(r.action, r.target ?? null),
            actionCode: r.action,
            target: nameTarget(resolveAuditTarget(r.target ?? null, names, devices)),
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

/** A target still carrying a bare id after resolution is shown as words, never the id. */
function nameTarget(t: string | null): string | null {
  return t && isUuid(t) ? UNRESOLVED : t;
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to security events.";
    return e.message;
  }
  return "Couldn't load security events. Check your connection and retry.";
}

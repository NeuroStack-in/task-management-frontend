"use client";

/**
 * The tenant's audit trail from the live backend, with `actor` ids resolved to names.
 *
 * Names come from the employee directory (best-effort); the signed-in user resolves to their own
 * name even when the directory doesn't carry them (the seeded owner's roster row is a known gap). An
 * actor that resolves to nothing shows a short id rather than a blank — honest, and still traceable.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { listEmployees } from "@/modules/employees/services/employees.service";
import { listFleet } from "@/modules/agents/services/fleet.service";
import { listAudit, type ApiAuditRow } from "./services/audit.service";

export interface AuditEntry {
  key: string;
  ts: number;
  timestamp: string;
  actorId: string;
  actorName: string;
  /** The actor is an agent on a device, not a person. */
  actorIsDevice: boolean;
  category: string;
  action: string;
  target: string | null;
}

export interface AuditState {
  entries: AuditEntry[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function fmt(tsSeconds: number): string {
  const d = new Date(tsSeconds * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function useAudit(): AuditState {
  const currentUser = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // The fleet is fetched too because **not every actor is a person.** An agent-side event
        // (`monitoring.capture_now.captured`) is stamped with the DEVICE's id, which will never
        // be in the employee roster — so the row fell back to a raw UUID with a meaningless
        // avatar. Best-effort: without fleet access the human actors still resolve.
        const [rows, roster, fleet] = await Promise.all([
          listAudit(),
          listEmployees().catch(() => []),
          listFleet().catch(() => ({ devices: [] })),
        ]);
        if (!live) return;
        const names = new Map<string, string>();
        for (const e of roster) names.set(e.user_id, e.name);
        if (currentUser?.id && currentUser.name) names.set(currentUser.id, currentUser.name);
        // A device id resolves to "<hostname> · agent" — that machine's agent is what acted, and
        // saying so is both true and useful. Kept out of `names` so a device can never be taken
        // for a person by anything else reading that map.
        const devices = new Map<string, string>();
        for (const d of fleet.devices ?? []) devices.set(d.agent_id, `${d.hostname} · agent`);

        setEntries(
          rows.map((r: ApiAuditRow) => ({
            key: `${r.ts}-${r.actor}-${r.action}`,
            ts: r.ts,
            timestamp: fmt(r.ts),
            actorId: r.actor,
            actorName: names.get(r.actor) ?? devices.get(r.actor) ?? shortId(r.actor),
            actorIsDevice: !names.has(r.actor) && devices.has(r.actor),
            category: r.category,
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
  }, [nonce, currentUser?.id, currentUser?.name]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { entries, loading, error, reload };
}

/** A recognisable stub of an unresolved actor id — never a blank cell. */
function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to the audit log.";
    return e.message;
  }
  return "Couldn't load the audit log. Check your connection and retry.";
}

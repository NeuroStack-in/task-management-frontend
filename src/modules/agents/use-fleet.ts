"use client";

/**
 * The tenant's agent devices from the live backend, with `user_id` resolved to names.
 *
 * Names come from the employee directory (best-effort, same approach as `use-audit`); a device whose
 * user doesn't resolve shows a short id rather than a blank.
 *
 * Two server-side caveats worth knowing when reading these numbers:
 * - `cpu_pct` is currently always ~0 (the agent builds a fresh `System` per heartbeat, and
 *   `refresh_cpu_usage` needs two samples on the same instance to report anything).
 * - `idle` is currently hardcoded false in the agent's heartbeat, so no device reports `idle` yet.
 * Both are agent-side defects, not display bugs — the values shown here are exactly what the fleet
 * reports.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listEmployees } from "@/modules/employees/services/employees.service";
import { getFleet, type ApiDevice } from "./services/fleet.service";

export type DeviceStatus = "online" | "idle" | "offline";

export interface FleetDevice {
  id: string;
  hostname: string;
  userId: string;
  userName: string;
  os: string;
  osVersion: string;
  version: string;
  ip: string;
  status: DeviceStatus;
  lastHeartbeat: number;
  lastSeen: string;
  cpu: number;
  memory: number;
  outboxMb: number;
  deactivated: boolean;
}

export interface FleetState {
  devices: FleetDevice[];
  total: number;
  online: number;
  offline: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useFleet(): FleetState {
  const [state, setState] = useState<Omit<FleetState, "reload">>({
    devices: [],
    total: 0,
    online: 0,
    offline: 0,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const [fleet, roster] = await Promise.all([
          getFleet(),
          listEmployees().catch(() => []),
        ]);
        if (!live) return;

        const names = new Map<string, string>();
        for (const e of roster) names.set(e.user_id, e.name);

        setState({
          devices: fleet.devices.map((d) => toDevice(d, names)),
          total: fleet.total,
          online: fleet.online,
          offline: fleet.offline,
          loading: false,
          error: null,
        });
      } catch (e) {
        if (live) setState((s) => ({ ...s, loading: false, error: messageOf(e) }));
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

function toDevice(d: ApiDevice, names: Map<string, string>): FleetDevice {
  return {
    id: d.agent_id,
    hostname: d.hostname || d.agent_id,
    userId: d.user_id,
    userName: names.get(d.user_id) ?? shortId(d.user_id),
    os: d.os,
    osVersion: d.os_version,
    version: d.agent_version,
    ip: d.ip,
    status: d.connectivity,
    lastHeartbeat: d.last_heartbeat,
    lastSeen: relativeTime(d.last_heartbeat),
    cpu: Math.round(d.cpu_pct),
    memory: Math.round(d.mem_pct),
    outboxMb: d.outbox_mb,
    deactivated: d.state === "deactivated",
  };
}

/** Epoch ms → a short relative label. `0` means the device has never heartbeated. */
function relativeTime(epochMs: number): string {
  if (!epochMs) return "Never";
  const mins = Math.floor((Date.now() - epochMs) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to device agents.";
    return e.message;
  }
  return "Couldn't load device agents. Check your connection and retry.";
}

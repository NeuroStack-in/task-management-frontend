"use client";

/**
 * The parts of an employee's profile that live in other contexts — this year's leave and the devices
 * attributed to them (UX audit PEOPLE-15: "time, attendance, leave and devices aren't on the
 * profile").
 *
 * **No new routes.** Leave comes from the org ledger (`GET /v1/leave/balances`, `leave:manage`) and
 * devices from the fleet (`GET /v1/fleet`, `agents:manage`), each filtered to this person. Both load
 * only when their tab is opened by someone holding the permission — a profile view must not fire
 * two org-wide reads, or a guaranteed 403, for a tab nobody looked at.
 */
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  getOrgBalances,
  type ApiTypeBalance,
} from "@/modules/leave/services/leave.service";
import { listFleet, type ApiDevice } from "@/modules/agents/services/fleet.service";
import { effectiveUserId } from "@/modules/agents/lib/presence";

export type ExtraState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "forbidden" }
  | { status: "failed"; retry: () => void };

function useLazyRead<T>(enabled: boolean, read: () => Promise<T>, key: string): ExtraState<T> {
  const [state, setState] = useState<ExtraState<T>>({ status: "idle" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setState({ status: "loading" });
    read()
      .then((value) => live && setState({ status: "ready", value }))
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 403) setState({ status: "forbidden" });
        else setState({ status: "failed", retry: () => setNonce((n) => n + 1) });
      });
    return () => {
      live = false;
    };
    // `read` is rebuilt each render; `key` names what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key, nonce]);
  return state;
}

export interface EmployeeLeave {
  year: string;
  /** Empty when the ledger has no row for this person (a monitored employee, say). */
  balances: ApiTypeBalance[];
}

/** This year's leave balances for one person, from the org ledger. */
export function useEmployeeLeave(userId: string, enabled: boolean): ExtraState<EmployeeLeave> {
  return useLazyRead(
    enabled,
    () =>
      getOrgBalances().then((org) => ({
        year: org.year,
        balances: org.employees.find((e) => e.user_id === userId)?.balances ?? [],
      })),
    `leave:${userId}`,
  );
}

/**
 * Devices attributed to one person — the managed agent's assigned employee or the interactive app's
 * signed-in user, the same attribution the device list uses. Live devices first, then by last
 * check-in.
 */
export function useEmployeeDevices(userId: string, enabled: boolean): ExtraState<ApiDevice[]> {
  return useLazyRead(
    enabled,
    () =>
      listFleet().then((f) =>
        f.devices
          .filter((d) => effectiveUserId(d) === userId)
          .sort(
            (a, b) =>
              Number(isRetired(a)) - Number(isRetired(b)) || b.last_heartbeat - a.last_heartbeat,
          ),
      ),
    `devices:${userId}`,
  );
}

function isRetired(d: ApiDevice): boolean {
  return Boolean(d.state) && d.state !== "active";
}

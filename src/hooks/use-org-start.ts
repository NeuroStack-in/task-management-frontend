"use client";

import { useEffect, useState } from "react";
import { listAllEmployees } from "@/modules/employees/services/employees.service";
import { useAuthStore } from "@/stores/auth.store";

/**
 * The org's **first day** — the earliest employee join date (`joined_at`), as a local `YYYY-MM-DD`
 * string.
 *
 * Attendance cannot predate it: the owner's account is created when the org is, so the earliest
 * `joined_at` is effectively the org's creation day. Calendar days before it are blocked out (hatched,
 * like weekends) rather than shown as "0% attended" — an org created on the 27th never had a
 * 3rd-of-the-month roster to be absent from, and the backend's all-absent fallback for those empty
 * days reads as a real, alarming zero.
 *
 * (The `ORG#meta` `created_at` would be the exact source, but it isn't serialized on `GET /v1/org`
 * and is absent on some orgs, so the roster's earliest join date is the reliable available signal.)
 *
 * `null` while loading, on a read failure, or for a legacy org where no one has a join date — there
 * the calendar keeps its prior behaviour (nothing blocked). Cached per tenant, like `useWorkingHours`.
 */
let cache: { tenant: string; start: string | null } | null = null;

function localIso(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function useOrgStartDate(): string | null {
  const tenant = useAuthStore((s) => s.user?.organizationId ?? null);
  const [start, setStart] = useState<string | null>(
    cache && cache.tenant === tenant ? cache.start : null,
  );

  useEffect(() => {
    if (!tenant) return;
    if (cache && cache.tenant === tenant) {
      setStart(cache.start);
      return;
    }
    let live = true;
    listAllEmployees()
      .then((roster) => {
        if (!live) return;
        const joined = roster
          .map((e) => e.joined_at)
          .filter((v): v is number => typeof v === "number");
        const next = joined.length ? localIso(Math.min(...joined)) : null;
        cache = { tenant, start: next };
        setStart(next);
      })
      .catch(() => {
        // Leave `null` — the calendar simply won't block pre-start days (its prior behaviour).
      });
    return () => {
      live = false;
    };
  }, [tenant]);

  return start;
}

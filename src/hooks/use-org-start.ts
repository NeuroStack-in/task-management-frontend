"use client";

import { useEffect, useState } from "react";
import { listAllEmployees } from "@/modules/employees/services/employees.service";
import { getMyProfile } from "@/modules/profile/services/profile.service";
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

/**
 * **My own first day** — when the signed-in person joined, as a local `YYYY-MM-DD`.
 *
 * The org-wide {@link useOrgStartDate} is the wrong floor for one person's calendar: someone who
 * joined in August has no attendance for a March the org was already running, and rendering those
 * days as blank workdays invites the same misreading the org calendar was fixed for — an empty
 * grid that looks like a record of absence rather than a record that does not exist.
 *
 * Sourced from `GET /v1/me/profile`, **not** the roster. `listAllEmployees` needs oversight
 * permissions a plain Employee does not have, and this view is theirs above all — reading it from
 * the roster would leave the block-out silently not working for exactly the people who see this
 * page most. `created_at` there already falls back to `joined_at` server-side.
 *
 * `null` while loading, on failure, or when the org never recorded a date: the calendar then keeps
 * its prior behaviour and blocks nothing, which is the safe direction to be wrong in.
 */
let meCache: { user: string; start: string | null } | null = null;

export function useMyStartDate(): string | null {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [start, setStart] = useState<string | null>(
    meCache && meCache.user === userId ? meCache.start : null,
  );

  useEffect(() => {
    if (!userId) return;
    if (meCache && meCache.user === userId) {
      setStart(meCache.start);
      return;
    }
    let live = true;
    getMyProfile()
      .then((p) => {
        if (!live) return;
        const next = typeof p.created_at === "number" ? localIso(p.created_at) : null;
        meCache = { user: userId, start: next };
        setStart(next);
      })
      .catch(() => {
        // Leave `null` — block nothing, as before.
      });
    return () => {
      live = false;
    };
  }, [userId]);

  return start;
}

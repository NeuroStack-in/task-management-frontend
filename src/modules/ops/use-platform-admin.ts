"use client";

import { useCallback, useEffect, useState } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { BASELINE } from "@/lib/permission-bits";
import { useAuthStore } from "@/stores/auth.store";
import { getOpsMe } from "./services/ops.service";

/**
 * True when a resolved role carries **no customer permission of its own** — nothing beyond the
 * baseline ids (`dashboard:view`) every authenticated member gets for free. A zero-perm operator
 * account lands here; an owner (who holds the `"*"` wildcard) and any real role do not.
 *
 * This is the load-bearing distinction for `opsOnly`: a `perm=0` account still resolves to
 * `permissions: ["dashboard:view"]` (the baseline is always injected), so a naive `length === 0`
 * check never fires. Filter the baseline out first.
 */
export function hasNoCustomerPermissions(
  permissions: readonly string[] | undefined,
): boolean {
  if (!permissions) return false;
  return permissions.every((p) => (BASELINE as readonly string[]).includes(p));
}

/**
 * One `GET /v1/ops/me` per signed-in user per page load, shared by every caller — the guard, each
 * sidebar mount and the ops pages each fired their own. A failure is not cached: the next caller (or
 * `retry`) asks again.
 */
let opsMe: { userId: string; answer: Promise<boolean> } | null = null;

function readOpsMe(userId: string, fresh: boolean): Promise<boolean> {
  if (fresh || !opsMe || opsMe.userId !== userId) {
    const answer = getOpsMe().then((r) => r.platform_admin === true);
    opsMe = { userId, answer };
    answer.catch(() => {
      if (opsMe?.answer === answer) opsMe = null;
    });
  }
  return opsMe.answer;
}

export interface PlatformAdminState {
  isAdmin: boolean;
  loading: boolean;
  /**
   * The lookup failed. Not the same as "not an operator": the ops pages read "Not authorized" after
   * one transient failure, with no way to try again (QA audit 2026-10-08, WP-465).
   */
  failed: boolean;
  retry: () => void;
}

/**
 * Whether the signed-in account is a platform-support operator (on the server-side allowlist).
 * Used only to *reveal* the ops console and its nav entry — the server is the real gate on every
 * ops route, so a non-operator who reaches the page by URL still gets nothing.
 *
 * `enabled: false` skips the lookup — for a caller that runs before there is a session to ask about
 * (the route guard renders for signed-out visitors on their way to the sign-in page).
 */
export function usePlatformAdmin(enabled = true): PlatformAdminState {
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const [state, setState] = useState({ isAdmin: false, loading: true, failed: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !userId) return;
    let live = true;
    setState((s) => (s.loading && !s.failed ? s : { ...s, loading: true, failed: false }));
    readOpsMe(userId, attempt > 0)
      .then((isAdmin) => live && setState({ isAdmin, loading: false, failed: false }))
      .catch(() => live && setState({ isAdmin: false, loading: false, failed: true }));
    return () => {
      live = false;
    };
  }, [enabled, userId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

/**
 * A **dedicated operator** account: on the platform-admin allowlist AND holding no customer
 * permissions of its own. These accounts exist only to work the support queue, so the app hides the
 * customer shell for them (sidebar shows just Support desk) and lands them straight on `/ops/support`.
 *
 * An owner/admin who is *also* an operator (a normal user added to the allowlist) is NOT ops-only —
 * they keep their full console; `opsOnly` stays false because they hold real permissions.
 *
 * `undecided` is true while the answer could still be "ops-only": the role holds no customer
 * permission and the allowlist lookup hasn't answered. Anyone with a real permission is decided at
 * once, so the guard only ever waits on the lookup for an account that could be an operator.
 */
export function useIsOpsOnly(enabled = true): {
  opsOnly: boolean;
  loading: boolean;
  undecided: boolean;
} {
  const { isAdmin, loading } = usePlatformAdmin(enabled);
  const { role } = usePermissions();
  // `!!role` guards the loading window: a null role would make `hasNoCustomerPermissions` vacuously
  // true and briefly flag a normal admin as ops-only before their permissions land.
  const couldBeOps = !!role && hasNoCustomerPermissions(role.permissions);
  const opsOnly = isAdmin && couldBeOps;
  return { opsOnly, loading, undecided: couldBeOps && loading };
}

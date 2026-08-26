"use client";

import { useEffect, useState } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { BASELINE } from "@/lib/permission-bits";
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
 * Whether the signed-in account is a platform-support operator (on the server-side allowlist).
 * Used only to *reveal* the ops console and its nav entry — the server is the real gate on every
 * ops route, so a non-operator who reaches the page by URL still gets nothing.
 */
export function usePlatformAdmin(): { isAdmin: boolean; loading: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    getOpsMe()
      .then((r) => live && setIsAdmin(r.platform_admin))
      .catch(() => live && setIsAdmin(false))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  return { isAdmin, loading };
}

/**
 * A **dedicated operator** account: on the platform-admin allowlist AND holding no customer
 * permissions of its own. These accounts exist only to work the support queue, so the app hides the
 * customer shell for them (sidebar shows just Support desk) and lands them straight on `/ops/support`.
 *
 * An owner/admin who is *also* an operator (a normal user added to the allowlist) is NOT ops-only —
 * they keep their full console; `opsOnly` stays false because they hold real permissions.
 */
export function useIsOpsOnly(): { opsOnly: boolean; loading: boolean } {
  const { isAdmin, loading } = usePlatformAdmin();
  const { role } = usePermissions();
  // `!!role` guards the loading window: a null role would make `hasNoCustomerPermissions` vacuously
  // true and briefly flag a normal admin as ops-only before their permissions land.
  const opsOnly = isAdmin && !!role && hasNoCustomerPermissions(role.permissions);
  return { opsOnly, loading };
}

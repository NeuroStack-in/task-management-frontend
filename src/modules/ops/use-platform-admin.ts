"use client";

import { useEffect, useState } from "react";
import { getOpsMe } from "./services/ops.service";

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

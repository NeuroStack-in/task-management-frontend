"use client";

import { redirect } from "next/navigation";
import { INSIGHTS_TABS } from "@/constants/navigation";
import { useCurrentRole } from "@/hooks/use-permissions";
import { canAccess } from "@/lib/rbac";

/**
 * Redirects to the first Analytics tab the current role can access. The role
 * lives in the client store, so this stays a client component — but it resolves
 * the redirect during render via redirect() rather than in an effect, so the
 * navigation isn't dropped when the router is still mid-transition from the
 * sidebar click (which left the loader spinning). Employees with no accessible
 * tab go to the dashboard.
 */
export default function InsightsIndex() {
  const role = useCurrentRole();
  const first = INSIGHTS_TABS.find((t) => canAccess(role, t.permission));
  redirect(first ? first.href : "/dashboard");
}

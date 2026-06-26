"use client";

import { usePermissions } from "@/hooks/use-permissions";

/**
 * True when the current role is "self-scoped" — it can't see people or activity
 * org-wide (e.g. a plain Employee), so pages should show only the user's own
 * data instead of company-wide aggregates. Roles with `employees:view` or
 * `activity:view` (Owner/Admin/Manager/HR) get the full org view.
 */
export function useIsSelfScoped(): boolean {
  const { can } = usePermissions();
  return !can("employees:view") && !can("activity:view");
}

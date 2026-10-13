"use client";

import { useIsSelfScoped } from "@/hooks/use-self-scope";

/**
 * The org dashboard is built on the whole directory (`listAllEmployees`, `EmployeesRead`), so that
 * is what selects it — a role without it got "You don't have access to the dashboard" instead of
 * its own board (QA audit 2026-10-08, WP-322).
 */
export function useIsPersonalDashboard(): boolean {
  return useIsSelfScoped(["employees:view"]);
}

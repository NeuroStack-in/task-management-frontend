"use client";

import { usePermissions } from "@/hooks/use-permissions";
import type { PermissionId } from "@/types/rbac";

/**
 * True when the current role should get a page's **personal** view rather than its oversight one.
 *
 * Each caller passes the permission(s) its oversight view actually reads with — any one of them
 * selects oversight. There used to be one rule for every page (`!employees:view && !activity:view`),
 * a proxy unrelated to what the views need: a "Recruiter" (directory + own attendance) got the
 * attendance roster and a 403, an "Attendance supervisor" (org attendance, no directory) could never
 * reach the roster, and a monitoring analyst without the directory landed on "You don't have access
 * to the dashboard" (QA audit 2026-10-08, WP-322).
 */
export function useIsSelfScoped(oversight: PermissionId[]): boolean {
  const { canAny } = usePermissions();
  return !canAny(oversight);
}

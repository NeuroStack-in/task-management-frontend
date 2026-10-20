"use client";

import { usePathname } from "next/navigation";
import { ShieldX } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole, usePermissions } from "@/hooks/use-permissions";
import {
  isEntitlementGated,
  isOwnerOf,
  useEntitlementsSettled,
  useIsFeatureOn,
  useIsPageOn,
  useTrackingMode,
} from "@/hooks/use-features";
import { featureForPath, isPathModeHidden } from "@/constants/features";
import { PERMISSION_MAP } from "@/constants/permissions";
import { canAccessPath, requiredPermissionsForPath, titleForPath } from "@/lib/rbac";
import { AccessWall } from "@/components/shared/access-wall";
import { FeatureGateNotice } from "@/components/shared/feature-gate-notice";
import { Loader } from "@/components/shared/loader";
import { PAYSLIPS_HREF } from "@/modules/time-tracking/components/payroll-widget";

/** "A", "A or B", "A, B or C". */
function orList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

/**
 * Closes a route the viewer can't use, **inside** the app shell (UX audit XC-02 / SHELL-01).
 *
 * These checks used to live in `AuthGuard`, which returned the wall in place of the whole shell: the
 * sidebar, top bar, bell and running timer vanished, and the only way out was one "Back to Dashboard"
 * button. Session, org and ops checks stay in `AuthGuard` (a signed-out visitor must never see the
 * shell); everything from the permission check down is here, rendered as the page content. Each wall
 * names what's missing and who can change it.
 */
export function RouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const role = useCurrentRole();
  const { can } = usePermissions();
  const isOwner = useAuthStore(isOwnerOf);
  const entitlementsSettled = useEntitlementsSettled();
  const isFeatureOn = useIsFeatureOn();
  const isPageOn = useIsPageOn();
  const mode = useTrackingMode();
  const label = titleForPath(pathname) ?? "This page";

  // Permission first. Checked last, a role without access to a plan-gated page was told to upgrade
  // the plan — which would not have let them in (WP-465).
  if (!canAccessPath(role, pathname)) {
    const needed = (requiredPermissionsForPath(pathname) ?? []).map(
      (id) => PERMISSION_MAP[id]?.label ?? id,
    );
    const canFixRoles = can("roles:manage");
    // Someone after their own payslip lands here from an old link or habit — point them to it
    // (UX audit TIME-19).
    const payslips = pathname === "/payroll" || pathname.startsWith("/payroll/");
    return (
      <AccessWall
        icon={ShieldX}
        title={`You don't have access to ${label}`}
        action={
          payslips && can("time-tracking:view")
            ? { label: "Open my payslips", href: PAYSLIPS_HREF }
            : canFixRoles
              ? { label: "Open Roles & Permissions", href: "/settings/roles" }
              : undefined
        }
      >
        {payslips ? (
          <p>Looking for your own payslips? They&apos;re on Time Tracking.</p>
        ) : null}
        <p>
          Your role{role?.name ? ` (${role.name})` : ""} doesn&apos;t include{" "}
          {needed.length ? (
            <strong className="text-foreground font-medium">{orList(needed)}</strong>
          ) : (
            "the permission this page needs"
          )}
          .
        </p>
        <p>
          {canFixRoles
            ? "You can add it to a role under Settings → Roles & Permissions."
            : "Ask an owner or admin to add it to your role, or to give you a role that has it."}
        </p>
      </AccessWall>
    );
  }

  // Until the org's entitlements are known, a page a feature, mode or page toggle could close is not
  // mounted: it used to render, fire its requests and paint real data (a bookmarked /payroll in a
  // machine-mode org) before being swapped for the wall below (QA audit 2026-10-08, WP-317).
  if (!entitlementsSettled && isEntitlementGated(pathname)) {
    return <Loader className="min-h-[60vh]" label="Checking access…" />;
  }

  // Hiding the nav entry isn't enough — the URL still works. A feature that's unavailable is closed
  // here too, so a bookmark or a typed address can't walk straight into it. The notice tells the
  // honest reason: **not in the plan → Upgrade**, or **in the plan but toggled off → enable it**.
  const feature = featureForPath(pathname);
  if (feature && !isFeatureOn(feature)) {
    return <FeatureGateNotice feature={feature} label={label} />;
  }

  // A route the org's tracking mode hides (e.g. Projects/Payroll in machine mode) is closed the same
  // way — including the key-less ones a feature check can't catch (MANAGED-AGENT.md §4/§8).
  if (isPathModeHidden(pathname, mode)) {
    return (
      <AccessWall
        icon={ShieldX}
        title={`${label} isn't part of your setup`}
        action={isOwner ? { label: "Open Organization settings", href: "/settings/organization" } : undefined}
      >
        <p>
          Your organization tracks time by device sign-in rather than by project, so {label} isn&apos;t
          used.
        </p>
        <p>
          {isOwner
            ? "You can change how the organization tracks work under Settings → Organization."
            : "An owner can change how the organization tracks work under Settings → Organization."}
        </p>
      </AccessWall>
    );
  }

  // Layer 3 — the org hid this page. Checked alongside the others rather than only in the nav,
  // because hiding a route in the sidebar while leaving the URL open is the exact gap that let an
  // Employee reach Analytics. Owners are exempt inside `isPageOn`, so they never land here.
  if (!isPageOn(pathname)) {
    const canToggle = can("entitlements:manage");
    return (
      <AccessWall
        icon={ShieldX}
        title={`${label} is turned off`}
        action={canToggle ? { label: "Open Settings → Features", href: "/settings/features" } : undefined}
      >
        <p>Your organization has hidden this page.</p>
        <p>
          {canToggle
            ? "You can show it again under Settings → Features."
            : `Someone with the ${PERMISSION_MAP["entitlements:manage"]?.label ?? "Manage Feature Toggles"} permission — usually an owner or admin — can show it again under Settings → Features.`}
        </p>
      </AccessWall>
    );
  }

  return <>{children}</>;
}

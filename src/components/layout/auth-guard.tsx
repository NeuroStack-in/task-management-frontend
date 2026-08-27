"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldX } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole } from "@/hooks/use-permissions";
import {
  useEntitlementsSync,
  useIsFeatureOn,
  useIsPageOn,
  useTrackingMode,
} from "@/hooks/use-features";
import { featureForPath, isPathModeHidden } from "@/constants/features";
import { canAccessPath } from "@/lib/rbac";
import { useIsOpsOnly } from "@/modules/ops/use-platform-admin";
import { FeatureGateNotice } from "@/components/shared/feature-gate-notice";
import { Loader } from "@/components/shared/loader";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Client-side route protection (TDD §9). Waits for the persisted auth store to
 * hydrate, redirects unauthenticated users to /login, and blocks access to
 * routes the current role lacks permission for.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useCurrentRole();

  // Load the org's entitlements once there's a session — the sidebar and the check below read the
  // result. This is the first point inside the authenticated tree, so everything downstream has it.
  useEntitlementsSync(hydrated && isAuthenticated);
  const isFeatureOn = useIsFeatureOn();
  const isPageOn = useIsPageOn();
  const mode = useTrackingMode();

  // A dedicated platform-support operator has no customer console at all — it is not a member of the
  // tenant its login happens to be minted in. Hiding the nav and redirecting the dashboard isn't
  // enough: /settings and other member-readable pages still answer to a typed URL, which would leak
  // the host org's details. Bounce the operator off every non-/ops route, the same way features and
  // hidden pages are closed here rather than only in the sidebar.
  const { opsOnly } = useIsOpsOnly();
  const isOpsRoute = pathname === "/ops" || pathname.startsWith("/ops/");

  // A signed-in user with no organization yet (the "Continue with Google" self-signup) has nothing to
  // see in the app shell — send them to the standalone onboarding flow to create their org first.
  const hasOrg = useAuthStore((s) => Boolean(s.user?.organizationId));

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  useEffect(() => {
    if (hydrated && isAuthenticated && !hasOrg) {
      router.replace("/onboarding");
    }
  }, [hydrated, isAuthenticated, hasOrg, router]);

  useEffect(() => {
    if (hydrated && isAuthenticated && opsOnly && !isOpsRoute) {
      router.replace("/ops/support");
    }
  }, [hydrated, isAuthenticated, opsOnly, isOpsRoute, router]);

  if (!hydrated || !isAuthenticated) {
    return <Loader label="Loading your workspace…" />;
  }

  // No org yet — don't flash the app shell before the onboarding redirect lands.
  if (!hasOrg) {
    return <Loader label="Setting up your account…" />;
  }

  // Don't paint a customer page for an operator account even for the tick before the redirect lands.
  if (opsOnly && !isOpsRoute) {
    return <Loader label="Opening the support desk…" />;
  }

  // Hiding the nav entry isn't enough — the URL still works. A feature that's unavailable is closed
  // here too, so a bookmark or a typed address can't walk straight into it. The notice tells the
  // honest reason: **not in the plan → Upgrade**, or **in the plan but toggled off → enable it**.
  const feature = featureForPath(pathname);
  if (feature && !isFeatureOn(feature)) {
    return <FeatureGateNotice feature={feature} />;
  }

  // A route the org's tracking mode hides (e.g. Projects/Payroll in machine mode) is closed the same
  // way — including the key-less ones a feature check can't catch (MANAGED-AGENT.md §4/§8).
  if (isPathModeHidden(pathname, mode)) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={ShieldX}
          title="Not available here"
          description="This section isn't part of your organization's tracking setup. An owner can change how this organization tracks work under Settings → Organization."
          action={
            <Button onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  // Layer 3 — the org hid this page. Checked alongside the others rather than only in the nav,
  // because hiding a route in the sidebar while leaving the URL open is the exact gap that let an
  // Employee reach Analytics earlier today.
  if (!isPageOn(pathname)) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={ShieldX}
          title="This page is turned off"
          description="Your organization has hidden this page. An owner or admin can show it again under Settings → Features."
          action={
            <Button onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  if (!canAccessPath(role, pathname)) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={ShieldX}
          title="Access denied"
          description="Your role doesn't have permission to view this section. Contact your administrator if you believe this is a mistake."
          action={
            <Button onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}

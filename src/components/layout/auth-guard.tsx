"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldX } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole } from "@/hooks/use-permissions";
import { useEntitlementsSync, useIsFeatureOn } from "@/hooks/use-features";
import { featureForPath } from "@/constants/features";
import { canAccess, permissionForPath } from "@/lib/rbac";
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

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  if (!hydrated || !isAuthenticated) {
    return <Loader label="Loading your workspace…" />;
  }

  // Hiding the nav entry isn't enough — the URL still works. A feature the org has switched off is
  // closed here too, so a bookmark or a typed address can't walk straight into it.
  const feature = featureForPath(pathname);
  if (feature && !isFeatureOn(feature)) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={ShieldX}
          title="This feature is turned off"
          description="Your organization has disabled this feature. An owner can switch it back on under Settings → Features."
          action={
            <Button onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  const required = permissionForPath(pathname);
  if (!canAccess(role, required)) {
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

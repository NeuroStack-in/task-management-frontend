"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldX } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole } from "@/hooks/use-permissions";
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

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  if (!hydrated || !isAuthenticated) {
    return <Loader label="Loading your workspace…" />;
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

"use client";

import { ShieldOff } from "lucide-react";
import { usePlatformAdmin } from "@/modules/ops/use-platform-admin";
import { OpsSupportConsole } from "@/modules/ops/components/ops-support-console";
import { Loader } from "@/components/shared/loader";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Platform-ops support desk. Reachable by URL for any signed-in user, but self-guarded: the console
 * only renders for accounts on the server-side platform-admin allowlist. The backend is the real
 * gate — every ops API refuses a non-operator regardless of what the page shows.
 */
export default function Page() {
  const { isAdmin, loading, failed, retry } = usePlatformAdmin();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Checking access…" />
      </div>
    );
  }

  // A failed check is not a "no" — it used to read "Not authorized", with no way to ask again.
  if (failed) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Couldn't check your access"
        description="Something went wrong confirming you're a platform-support operator. Try again in a moment."
        action={
          <Button variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        }
      />
    );
  }

  if (!isAdmin) {
    return (
      <EmptyState
        icon={ShieldOff}
        title="Not authorized"
        description="This area is for WorkPulse platform-support operators only."
      />
    );
  }

  return <OpsSupportConsole />;
}

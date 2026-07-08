"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { Loader } from "@/components/shared/loader";
import { OnboardingWizard } from "./onboarding-wizard";

/**
 * Guards the standalone /onboarding route. It's reached right after sign-up (the
 * OrgSetupModal logs the new member in, then hands off here), so it must not be
 * publicly viewable: wait for the persisted auth store to hydrate, then bounce
 * unauthenticated visitors to /login. Kept out of the (app) group on purpose so
 * onboarding stays full-screen, without the dashboard shell.
 */
export function OnboardingExperience() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent("/onboarding")}`);
    }
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader label="Loading…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Activity className="size-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">WorkPulse</span>
      </Link>
      <OnboardingWizard />
    </div>
  );
}

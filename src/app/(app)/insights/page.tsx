"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { INSIGHTS_TABS } from "@/constants/navigation";
import { useCurrentRole } from "@/hooks/use-permissions";
import { useIsFeatureOn, useTrackingMode } from "@/hooks/use-features";
import { isNavItemVisible } from "@/lib/rbac";
import { isPathModeHidden } from "@/constants/features";
import { Loader } from "@/components/shared/loader";

/**
 * `/insights` has no content of its own — it opens the first Analytics tab the role can access
 * (Activity for every oversight role; a role with only Screenshots/Reports lands there instead).
 * Employees with no accessible tab go to the dashboard.
 *
 * The role lives in the client store, so this is a client component. A bare `redirect()` in a client
 * render silently renders nothing (a blank Analytics shell — the bug this replaces), so navigate in
 * an effect with `router.replace` and show a loader in the meantime — never a blank.
 */
export default function InsightsIndex() {
  const router = useRouter();
  const role = useCurrentRole();
  const isFeatureOn = useIsFeatureOn();
  const mode = useTrackingMode();
  // Pick the first tab the role can access **and** the org has on — picking by permission alone
  // redirected straight into the "feature turned off" wall for a tab the org had switched off.
  const first = INSIGHTS_TABS.find((t) =>
    isNavItemVisible(role, t, isFeatureOn, (href) => isPathModeHidden(href, mode)),
  );
  const target = first ? first.href : "/dashboard";

  useEffect(() => {
    router.replace(target);
  }, [router, target]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader label="Opening Analytics…" />
    </div>
  );
}

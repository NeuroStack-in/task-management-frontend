"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { INSIGHTS_TABS } from "@/constants/navigation";
import { useCurrentRole } from "@/hooks/use-permissions";
import { useIsFeatureOn, useTrackingMode } from "@/hooks/use-features";
import { isNavItemVisible } from "@/lib/rbac";
import { isPathModeHidden } from "@/constants/features";
import { Loader } from "@/components/shared/loader";
import { FeatureGateNotice } from "@/components/shared/feature-gate-notice";

/**
 * `/insights` has no content of its own — it opens the first Analytics tab the role can access
 * (Activity for every oversight role; a role with only Screenshots/Reports lands there instead).
 *
 * When **no** tab is accessible — the free plan entitles none of the Analytics features — it shows an
 * **Upgrade** wall rather than silently bouncing to the dashboard. That bounce read as "clicking
 * Analytics does nothing / goes to the dashboard": the sidebar offered the section but the route
 * refused it with no explanation. The wall gives the honest reason and the way to fix it.
 *
 * The role lives in the client store, so this is a client component. A bare `redirect()` in a client
 * render silently renders nothing, so navigate in an effect with `router.replace` and show a loader
 * in the meantime — never a blank.
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

  useEffect(() => {
    if (first) router.replace(first.href);
  }, [router, first]);

  // No tab available — plan gate. `monitoring.activity` is the representative Analytics feature; the
  // notice resolves to "Upgrade" when it (and the other Analytics features) aren't in the plan.
  if (!first) {
    return <FeatureGateNotice feature="monitoring.activity" label="Analytics" />;
  }

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader label="Opening Analytics…" />
    </div>
  );
}

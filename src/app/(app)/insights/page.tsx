"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldX } from "lucide-react";
import { INSIGHTS_TABS } from "@/constants/navigation";
import { useCurrentRole } from "@/hooks/use-permissions";
import { useIsFeatureOn, useIsPageOn, useTrackingMode } from "@/hooks/use-features";
import { isNavItemVisible } from "@/lib/rbac";
import { isPathModeHidden } from "@/constants/features";
import { useEntitlementsStore } from "@/stores/entitlements.store";
import { Loader } from "@/components/shared/loader";
import { EmptyState } from "@/components/shared/empty-state";
import { FeatureGateNotice } from "@/components/shared/feature-gate-notice";

/**
 * How long to wait for the org's entitlements before choosing a tab anyway. They fail open, so a
 * redirect before they land picked a tab the org may have switched off or hidden, and landed on its
 * wall (QA audit 2026-10-08, WP-326). A read that never lands must not strand anyone on a spinner.
 */
const ENTITLEMENTS_GRACE_MS = 3000;

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
  const isPageOn = useIsPageOn();
  const mode = useTrackingMode();
  const loaded = useEntitlementsStore((s) => s.loaded);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setGaveUp(true), ENTITLEMENTS_GRACE_MS);
    return () => clearTimeout(t);
  }, [loaded]);
  const ready = loaded || gaveUp;

  const modeHidden = (href: string) => isPathModeHidden(href, mode);
  // Pick the first tab the role can access, the org has on **and has not hidden** — picking by
  // permission alone redirected straight into the "feature turned off" wall for a tab the org had
  // switched off, and ignoring page visibility sent everyone into "This page is turned off" for a
  // hidden Activity tab, with the other tabs unreachable behind it (WP-326).
  const first = INSIGHTS_TABS.find((t) =>
    isNavItemVisible(role, t, isFeatureOn, modeHidden, isPageOn),
  );
  // …and whether the only thing in the way is that the org hid the tabs.
  const hiddenOnly =
    !first && INSIGHTS_TABS.some((t) => isNavItemVisible(role, t, isFeatureOn, modeHidden));

  useEffect(() => {
    if (ready && first) router.replace(first.href);
  }, [router, first, ready]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader label="Opening Analytics…" />
      </div>
    );
  }

  if (!first && hiddenOnly) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={ShieldX}
          title="These pages are turned off"
          description="Your organization has hidden the Analytics pages. An owner or admin can show them again under Settings → Features."
        />
      </div>
    );
  }

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

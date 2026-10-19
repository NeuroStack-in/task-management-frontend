"use client";

import { Lock, ShieldX } from "lucide-react";
import { AccessWall } from "@/components/shared/access-wall";
import { PERMISSION_MAP } from "@/constants/permissions";
import { useIsFeatureAllowed } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import type { FeatureKey } from "@/stores/features.store";

/**
 * The wall shown when a feature route is reached but unavailable. It distinguishes the two reasons:
 *
 * - **Not in the plan** (`!isFeatureAllowed`) → an **Upgrade** prompt, linking whoever can see billing
 *   to the plans page. This is the case the free plan hits for Analytics, screenshots, AI, etc.
 * - **Allowed by the plan but toggled off** → "turned off", naming who can switch it back on, with a
 *   link for a viewer who can.
 *
 * Use it anywhere a feature gate blocks a page, so the reason (and the fix) is honest rather than a
 * silent bounce to the dashboard. It renders inside the app shell (`AccessWall`).
 */
export function FeatureGateNotice({
  feature,
  label = "This feature",
}: {
  feature: FeatureKey;
  /** Human name for the message, e.g. "Analytics". */
  label?: string;
}) {
  const isFeatureAllowed = useIsFeatureAllowed();
  const { can } = usePermissions();

  if (!isFeatureAllowed(feature)) {
    const canBill = can("billing:view");
    return (
      <AccessWall
        icon={Lock}
        title={`${label} isn't in your plan`}
        action={canBill ? { label: "View plans", href: "/settings/billing" } : undefined}
      >
        <p>Your organization&apos;s current plan doesn&apos;t include {label}.</p>
        <p>
          {canBill
            ? "Upgrading the plan turns it on for everyone who has access."
            : "Ask an owner to upgrade the organization's plan."}
        </p>
      </AccessWall>
    );
  }

  // In the plan, but the org switched it off. Owners are exempt from the toggle, so whoever lands
  // here is not an owner — but may still hold the toggle permission.
  const canToggle = can("entitlements:manage");
  return (
    <AccessWall
      icon={ShieldX}
      title={`${label} is turned off`}
      action={canToggle ? { label: "Open Settings → Features", href: "/settings/features" } : undefined}
    >
      <p>Your organization has switched this feature off.</p>
      <p>
        {canToggle
          ? "You can switch it back on under Settings → Features."
          : `Someone with the ${PERMISSION_MAP["entitlements:manage"]?.label ?? "Manage Feature Toggles"} permission — usually an owner or admin — can switch it back on under Settings → Features.`}
      </p>
    </AccessWall>
  );
}

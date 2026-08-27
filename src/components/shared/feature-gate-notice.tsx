"use client";

import { useRouter } from "next/navigation";
import { Lock, ShieldX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useIsFeatureAllowed } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import type { FeatureKey } from "@/stores/features.store";

/**
 * The wall shown when a feature route is reached but unavailable. It distinguishes the two reasons:
 *
 * - **Not in the plan** (`!isFeatureAllowed`) → an **Upgrade** prompt, linking whoever can see billing
 *   to the plans page. This is the case the free plan hits for Analytics, screenshots, AI, etc.
 * - **Allowed by the plan but toggled off** → a "turned off, enable in Settings → Features" prompt.
 *
 * Use it anywhere a feature gate blocks a page, so the reason (and the fix) is honest rather than a
 * silent bounce to the dashboard.
 */
export function FeatureGateNotice({
  feature,
  label = "This feature",
}: {
  feature: FeatureKey;
  /** Human name for the message, e.g. "Analytics". */
  label?: string;
}) {
  const router = useRouter();
  const isFeatureAllowed = useIsFeatureAllowed();
  const { can } = usePermissions();

  if (!isFeatureAllowed(feature)) {
    const canBill = can("billing:view");
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={Lock}
          title="Upgrade to unlock this"
          description={`${label} isn't included in your current plan. Upgrade your plan to start using it.`}
          action={
            canBill ? (
              <Button onClick={() => router.push("/settings/billing")}>View plans</Button>
            ) : (
              <div className="space-y-2 text-center">
                <p className="text-muted-foreground text-xs">
                  Ask an owner to upgrade the organization&apos;s plan.
                </p>
                <Button variant="outline" onClick={() => router.push("/dashboard")}>
                  Back to Dashboard
                </Button>
              </div>
            )
          }
        />
      </div>
    );
  }

  // In the plan, but the org switched it off.
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        icon={ShieldX}
        title="This feature is turned off"
        description="Your organization has disabled this feature. An owner can switch it back on under Settings → Features."
        action={
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        }
      />
    </div>
  );
}

"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

/**
 * A KPI tile for a metric the org's **plan doesn't include** — the same slot, a different answer.
 *
 * It replaces a `StatCard` rather than sitting beside one, because the alternative is worse than
 * useless: a Free-plan org has no `monitoring.activity` or `monitoring.screenshots` entitlement, so
 * nothing is ever captured, and the tiles read **"— no agent reported"**, **"0h"**, **"0 captured"**.
 * That tells an owner their agents are broken. They are not; the feature was never sold to them.
 *
 * Distinct from {@link FeatureGateNotice}, which is the full-page wall. This is the inline, tile-sized
 * form for a dashboard row where the surrounding cards are still real.
 *
 * **The CTA is permission-aware.** Only someone with `billing:view` can act on it, so only they get a
 * link to the plans page; everyone else is told who to ask. A button that leads to a 403 is a worse
 * dead end than no button.
 */
export function UpgradeStatCard({
  label,
  description,
  featured,
}: {
  /** The metric this stands in for, e.g. "Productivity Score" — keeps the row's labels stable. */
  label: string;
  /** One short line on what upgrading unlocks. */
  description: string;
  /** Match the tile it replaces, so the row's visual rhythm doesn't shift. */
  featured?: boolean;
}) {
  const { can } = usePermissions();
  const canBill = can("billing:view");

  const body = (
    <Card
      className={cn(
        "flex h-full flex-col justify-between gap-3 p-4 transition-shadow",
        !canBill && "wp-stat-card",
        featured
          ? "border-transparent bg-feature text-feature-foreground shadow-none"
          : "border-border border border-dashed",
        canBill && (featured ? "hover:bg-feature/90" : "hover:bg-accent/30"),
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "truncate text-sm",
            featured ? "text-feature-foreground/85" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            featured ? "bg-white/15" : "bg-muted",
          )}
          aria-hidden
        >
          <Lock className={cn("size-4", featured ? "" : "text-muted-foreground")} />
        </span>
      </div>

      <div>
        <p
          className={cn(
            "text-lg font-semibold",
            featured ? "" : "text-foreground",
          )}
        >
          {canBill ? "Upgrade to see" : "Not in your plan"}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs",
            featured ? "text-feature-foreground/75" : "text-muted-foreground",
          )}
        >
          {canBill ? description : "Ask an owner to upgrade the plan."}
        </p>
      </div>
    </Card>
  );

  // Only a billing-capable viewer gets a link — for anyone else the card states the fact and stops,
  // rather than offering a route they'd be refused at.
  return canBill ? (
    <Link
      href="/settings/billing"
      className="wp-stat-card block h-full focus-visible:ring-ring rounded-[var(--radius)] focus-visible:ring-2 focus-visible:outline-none"
      aria-label={`${label} — upgrade your plan to unlock`}
    >
      {body}
    </Link>
  ) : (
    body
  );
}

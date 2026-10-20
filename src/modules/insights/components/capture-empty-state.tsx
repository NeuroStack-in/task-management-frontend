"use client";

import Link from "next/link";
import { ArrowRight, Camera, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { usePermissions } from "@/hooks/use-permissions";
import { canAccessPath } from "@/lib/rbac";
import { formatDateTime, timeAgo } from "@/lib/format";
import { explainEmptyCaptureDay } from "../lib/capture-status";
import { startOfLocalDay } from "../lib/attention";
import { useCaptureContext } from "../use-capture-context";

/**
 * An empty capture day that says **why** it is empty, and links to the fix (UX audit 2026-10-16,
 * MON-10): screenshots switched off, the interval set to Off, no agent enrolled, agents silent since
 * a given time, or agents reporting with nothing captured. See `lib/capture-status` for the rules.
 *
 * Mount it only when the day is empty — it reads the agent config and the fleet on mount. Links the
 * reader's role can't open are left out, by the same rule the sidebar uses.
 */
export function CaptureEmptyState({
  date,
  today,
  userId,
  name,
  icon = Camera,
  title,
  lead,
  className,
}: {
  date: string;
  today: string;
  /** Narrow the agent part to one person's devices. */
  userId?: string;
  name?: string;
  icon?: LucideIcon;
  /** Replaces the cause's title — for a surface that names itself ("No hour-by-hour data yet"). */
  title?: string;
  /** A sentence before the cause — what this surface is drawn from. */
  lead?: string;
  className?: string;
}) {
  const ctx = useCaptureContext(true);
  const { role } = usePermissions();

  if (!ctx.ready) {
    return (
      <EmptyState
        icon={icon}
        title={title ?? (userId ? "No captures on this day" : "No screenshots for this day")}
        description={`${lead ? `${lead} ` : ""}Nothing was captured on this day — checking the agents to see why…`}
        className={className}
      />
    );
  }

  const gap = explainEmptyCaptureDay({
    ctx,
    date,
    today,
    dayStartMs: startOfLocalDay(date),
    userId,
    name,
    when: formatDateTime,
    ago: timeAgo,
  });
  const links = gap.links.filter((l) => canAccessPath(role, l.href));

  return (
    <EmptyState
      icon={icon}
      title={title ?? gap.title}
      // With a surface's own title, the cause's title leads the description so it isn't lost.
      description={`${lead ? `${lead} ` : ""}${title ? `${gap.title}. ` : ""}${gap.description}`}
      className={className}
      action={
        links.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2">
            {links.map((l, i) => (
              <Button
                key={l.href}
                variant={i === 0 ? "default" : "outline"}
                size="sm"
                render={<Link href={l.href} />}
                nativeButton={false}
              >
                {l.label}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
            ))}
          </div>
        ) : undefined
      }
    />
  );
}

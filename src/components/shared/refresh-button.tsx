"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A refresh control that re-fetches a page's data **in place** — the alternative to a full-page
 * browser reload. `onRefresh` triggers the page's own refetch (a data hook's `reload`, or
 * `useLiveRefresh().reload`): the surrounding chrome and the current data stay on screen while the
 * new data lands, so nothing blanks and scroll position is kept.
 *
 * The icon spins while the refetch is in flight. Pass `refreshing` (the page's `loading`) where you
 * have it so the spin tracks the real fetch; without it the button spins for a short pulse so the
 * click is always acknowledged, even when the refetch finishes faster than the eye can follow.
 */
export function RefreshButton({
  onRefresh,
  refreshing,
  label,
  size,
  variant = "outline",
  className,
}: {
  onRefresh: () => void | Promise<unknown>;
  /** True while the page's refetch is in flight — drives the spinner. Omit to use a min-spin pulse. */
  refreshing?: boolean;
  /** Optional text beside the icon; omit for an icon-only button (the title still reads "Refresh"). */
  label?: string;
  size?: "sm" | "default" | "icon" | "icon-sm";
  variant?: "outline" | "ghost" | "default";
  className?: string;
}) {
  // A short self-managed pulse so every click shows motion, even when the caller can't tell us when
  // its refetch finished (or it finished faster than the eye can follow).
  const [pulsing, setPulsing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onClick = useCallback(() => {
    setPulsing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPulsing(false), 600);
    void onRefresh();
  }, [onRefresh]);

  const spinning = pulsing || Boolean(refreshing);

  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (label ? "sm" : "icon-sm")}
      onClick={onClick}
      disabled={spinning}
      title="Refresh"
      aria-label="Refresh"
      className={className}
    >
      <RefreshCw className={cn(spinning && "animate-spin")} />
      {label}
    </Button>
  );
}

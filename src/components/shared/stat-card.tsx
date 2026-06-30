import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sparkline } from "./sparkline";
import { DeltaPill } from "./delta-pill";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  /** Percentage change vs previous period; positive = up. */
  delta?: number;
  /** Mini pulse-line series. */
  trend?: number[];
  hint?: string;
  /** Featured treatment (white text on the filled `--feature` accent surface). */
  featured?: boolean;
  /** When set, the whole card becomes a click-through link. */
  href?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  trend,
  hint,
  featured,
  href,
}: StatCardProps) {
  const card = (
    <Card
      className={cn(
        "flex h-full flex-col justify-between gap-3 p-4 transition-shadow",
        featured
          ? "border-transparent bg-feature text-feature-foreground shadow-none"
          : "border border-border",
        href && (featured ? "hover:bg-feature/90" : "hover:bg-accent/30"),
      )}
    >
      {/* Top row: label + optional icon */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "truncate text-sm",
            featured ? "text-feature-foreground/85" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        {Icon ? (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md",
              featured
                ? "bg-white/15 text-feature-foreground"
                : "bg-muted text-primary",
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>

      {/* Bottom row: value + sparkline */}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold tracking-tight tabular-nums leading-none">
            {value}
          </p>
          {(delta !== undefined || hint) ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {delta !== undefined ? (
                <DeltaPill
                  value={delta}
                  className={
                    featured
                      ? "rounded-full border-transparent bg-white/15 text-feature-foreground"
                      : undefined
                  }
                />
              ) : null}
              {hint ? (
                <span
                  className={cn(
                    "text-xs",
                    featured
                      ? "text-feature-foreground/80"
                      : "text-muted-foreground",
                  )}
                >
                  {hint}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {trend ? (
          <Sparkline
            data={trend}
            area
            width={80}
            height={36}
            className={cn(
              "shrink-0",
              featured ? "text-feature-foreground" : "text-primary",
            )}
          />
        ) : null}
      </div>
    </Card>
  );

  if (!href) return card;
  return (
    <Link href={href} className="group/stat block focus-visible:outline-none">
      {card}
    </Link>
  );
}

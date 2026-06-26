import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
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
  /** Featured sage treatment (white text on sage fill). */
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
        "h-full justify-between transition-shadow",
        featured && "bg-feature text-feature-foreground shadow-none",
        href && "group-hover/stat:shadow-md",
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5">
        <span
          className={cn(
            "text-sm",
            featured ? "text-feature-foreground/85" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        {Icon ? (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              featured ? "bg-white/15" : "bg-feature-tint text-primary",
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3 px-5">
        <div className="space-y-1.5">
          <p className="font-display text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          <div className="flex items-center gap-2">
            {delta !== undefined ? (
              featured ? (
                <FeaturedDelta value={delta} />
              ) : (
                <DeltaPill value={delta} />
              )
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
        </div>
        {trend ? (
          <Sparkline
            data={trend}
            area
            width={92}
            height={40}
            className={featured ? "text-white" : "text-primary"}
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

/** Delta pill tuned for the featured (white-on-accent) card. */
function FeaturedDelta({ value }: { value: number }) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/15 px-1.5 py-0.5 text-xs font-medium text-white">
      <Icon className="size-3" />
      {Math.abs(value)}%
    </span>
  );
}

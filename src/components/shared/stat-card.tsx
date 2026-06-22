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
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  trend,
  hint,
  featured,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "justify-between",
        featured && "bg-sage-strong text-sage-strong-foreground shadow-none",
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5">
        <span
          className={cn(
            "text-sm",
            featured ? "text-sage-strong-foreground/85" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        {Icon ? (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              featured ? "bg-white/15" : "bg-sage-tint text-primary",
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
            {delta !== undefined && !featured ? <DeltaPill value={delta} /> : null}
            {hint ? (
              <span
                className={cn(
                  "text-xs",
                  featured
                    ? "text-sage-strong-foreground/80"
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
}

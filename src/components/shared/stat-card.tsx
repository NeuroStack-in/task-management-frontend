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
  /** Featured treatment (top accent border). */
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
        "flex h-full flex-col justify-between gap-3 p-4 border border-border transition-shadow",
        featured && "border-t-2 border-t-primary",
        href && "hover:bg-accent/30",
      )}
    >
      {/* Top row: label + optional icon */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground truncate">{label}</span>
        {Icon ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
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
              {delta !== undefined ? <DeltaPill value={delta} /> : null}
              {hint ? (
                <span className="text-xs text-muted-foreground">{hint}</span>
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
            className="shrink-0 text-primary"
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

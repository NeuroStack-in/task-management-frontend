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
        "h-full justify-between border border-border transition-shadow",
        featured && "border-t-2 border-t-primary",
        href && "hover:bg-accent/30",
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Icon ? (
          <span className="flex size-7 items-center justify-center rounded-md bg-muted text-primary">
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3 px-5">
        <div className="space-y-1.5">
          <p className="font-display text-[1.75rem] font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          <div className="flex items-center gap-2">
            {delta !== undefined ? <DeltaPill value={delta} /> : null}
            {hint ? (
              <span className="text-xs text-muted-foreground">{hint}</span>
            ) : null}
          </div>
        </div>
        {trend ? (
          <Sparkline
            data={trend}
            area
            width={92}
            height={40}
            className="text-primary"
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


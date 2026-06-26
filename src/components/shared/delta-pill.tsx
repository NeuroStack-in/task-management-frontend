import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small percentage-change pill. Positive = sage/positive, negative = clay. */
export function DeltaPill({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-sm border px-1.5 py-0.5 text-xs font-medium",
        positive
          ? "border-success/30 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/10 text-destructive",
        className,
      )}
    >
      <Icon className="size-3" />
      {Math.abs(value)}%
    </span>
  );
}

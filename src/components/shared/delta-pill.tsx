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
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
        positive
          ? "bg-success/12 text-success"
          : "bg-destructive/12 text-destructive",
        className,
      )}
    >
      <Icon className="size-3" />
      {Math.abs(value)}%
    </span>
  );
}

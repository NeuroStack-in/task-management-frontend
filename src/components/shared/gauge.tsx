import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface GaugeProps {
  /** 0–100. */
  value: number;
  label?: string;
  size?: number;
  className?: string;
}

/** Semicircular gauge. Track + sage progress arc with the value in the center. */
export function Gauge({ value, label, size = 160, className }: GaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const cy = size / 2;
  // Semicircle arc length (half the full circumference).
  const arc = Math.PI * r;
  const offset = arc * (1 - clamped / 100);
  const height = size / 2 + stroke;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} aria-hidden="true">
        <path
          d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          className="wp-gauge-arc"
          style={{ ["--gauge-arc"]: arc } as CSSProperties}
          d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={arc}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="-mt-8 text-center">
        <div className="font-display text-2xl font-semibold tabular-nums">
          {Math.round(clamped)}%
        </div>
        {label ? (
          <div className="text-xs text-muted-foreground">{label}</div>
        ) : null}
      </div>
    </div>
  );
}

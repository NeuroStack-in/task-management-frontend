import { cn } from "@/lib/utils";

interface TickGaugeProps {
  /** 0–100. */
  value: number;
  label?: string;
  /** Overall width in px. */
  size?: number;
  /** Number of radial ticks. */
  ticks?: number;
  className?: string;
}

/**
 * Semicircular gauge built from discrete radial capsules (a speedometer-style
 * tick gauge). Filled ticks use the theme accent; the rest are muted. The value
 * and caption sit centered below the arc.
 */
export function TickGauge({
  value,
  label,
  size = 180,
  ticks = 26,
  className,
}: TickGaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const filled = Math.round((clamped / 100) * ticks);

  const cx = size / 2;
  const cy = size / 2;
  const thickness = Math.max(4, Math.round(size * 0.034));
  const outer = cx - thickness / 2 - 2;
  const inner = outer - Math.round(size * 0.1);
  const height = size / 2 + thickness;

  const marks = Array.from({ length: ticks }, (_, i) => {
    const t = ticks === 1 ? 0 : i / (ticks - 1);
    const angle = (Math.PI * (1 - t)); // π (left) → 0 (right), over the top
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      i,
      x1: cx + inner * cos,
      y1: cy - inner * sin,
      x2: cx + outer * cos,
      y2: cy - outer * sin,
      on: i < filled,
    };
  });

  return (
    <div
      className={cn("relative inline-flex flex-col items-center", className)}
      style={{ width: size }}
    >
      <svg
        width={size}
        height={height}
        viewBox={`0 0 ${size} ${height}`}
        aria-hidden="true"
      >
        {marks.map((m) => (
          <line
            key={m.i}
            x1={m.x1}
            y1={m.y1}
            x2={m.x2}
            y2={m.y2}
            strokeWidth={thickness}
            strokeLinecap="round"
            stroke={
              m.on
                ? "var(--primary)"
                : "color-mix(in srgb, var(--muted-foreground) 20%, var(--muted))"
            }
          />
        ))}
      </svg>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-display text-2xl font-semibold tabular-nums">
          {clamped % 1 === 0 ? clamped : clamped.toFixed(1)}%
        </span>
        {label ? (
          <span className="text-xs text-muted-foreground">{label}</span>
        ) : null}
      </div>
    </div>
  );
}

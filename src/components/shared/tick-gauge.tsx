import { cn } from "@/lib/utils";

interface TickGaugeProps {
  /** 0–100. */
  value: number;
  label?: string;
  /** Overall width in px. Default 160. */
  size?: number;
  /** Number of radial ticks. */
  ticks?: number;
  className?: string;
}

/**
 * Semicircular gauge built from discrete radial capsules (speedometer-style).
 * Filled ticks use the theme accent; the rest are muted.
 * The value and caption sit as SVG text inside the arc — no absolute overlay
 * that can overlap the arc when the component is narrow.
 */
export function TickGauge({
  value,
  label,
  size = 160,
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

  // Value label — rendered as SVG text so it can never overlap the ticks.
  const valueFontSize = Math.min(26, Math.round(size * 0.175));
  const captionFontSize = Math.min(11, Math.round(size * 0.072));
  // Place value slightly above center, label below it — both inside the arc opening.
  // The arc's "floor" is at cy (horizontal diameter). Keep text well above that.
  const valueLabelY = cy - Math.round(size * 0.18);
  const captionLabelY = valueLabelY + Math.round(valueFontSize * 0.95) + 3;

  // SVG height: bottom of arc ticks + small pad. Texts are inside the arc, above cy.
  const height = cy + thickness / 2 + 2;

  const marks = Array.from({ length: ticks }, (_, i) => {
    const t = ticks === 1 ? 0 : i / (ticks - 1);
    const angle = Math.PI * (1 - t); // π (left) → 0 (right)
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

  const displayValue =
    clamped % 1 === 0 ? `${clamped}%` : `${clamped.toFixed(1)}%`;

  return (
    <div
      className={cn("inline-flex flex-col items-center", className)}
      style={{ width: size, flexShrink: 0 }}
    >
      <svg
        width={size}
        height={height}
        viewBox={`0 0 ${size} ${height}`}
        aria-hidden="true"
        className="block"
        overflow="visible"
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

        {/* Value text — inside the arc, never overlapping the ticks */}
        <text
          x={cx}
          y={valueLabelY}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={valueFontSize}
          fontWeight={600}
          fill="currentColor"
          fontFamily="var(--font-display, inherit)"
          className="tabular-nums"
        >
          {displayValue}
        </text>
        {label ? (
          <text
            x={cx}
            y={captionLabelY}
            textAnchor="middle"
            dominantBaseline="auto"
            fontSize={captionFontSize}
            fill="var(--muted-foreground)"
          >
            {label}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface GaugeProps {
  /** 0–100. */
  value: number;
  label?: string;
  /** Overall diameter in px. Default 140 — fits most card widths without overflow. */
  size?: number;
  className?: string;
}

/**
 * Semicircular gauge. Track + primary progress arc with the value centered
 * cleanly inside the inner hole — no overlap at any size.
 */
export function Gauge({ value, label, size = 140, className }: GaugeProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = Math.max(6, Math.round(size * 0.055));
  const r = (size - stroke) / 2;
  const cy = size / 2;
  // Semicircle arc length (half the full circumference).
  const arc = Math.PI * r;
  const offset = arc * (1 - clamped / 100);
  // Height = top-half of circle + one stroke radius so the arc isn't clipped.
  const height = cy + stroke / 2;

  // Center-label sits at the midpoint of the flat chord (cy), inside the hole.
  // We push it up by a few px so it visually centers in the arc opening.
  const labelY = cy - stroke / 2 - 2;
  // Scale the value font to 26 % of diameter, cap at 28 px.
  const valueFontSize = Math.min(28, Math.round(size * 0.26));
  const captionFontSize = Math.min(11, Math.round(size * 0.09));

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      style={{ width: size, flexShrink: 0 }}
    >
      <div className="relative" style={{ width: size, height }}>
        <svg
          width={size}
          height={height}
          viewBox={`0 0 ${size} ${height}`}
          aria-hidden="true"
          className="block"
        >
          {/* Track */}
          <path
            d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
            fill="none"
            stroke="var(--muted)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Progress arc */}
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

        {/* Value label — absolutely positioned to sit inside the arc opening */}
        <div
          className="pointer-events-none absolute inset-x-0 flex flex-col items-center"
          style={{ top: labelY - valueFontSize / 2 - (label ? captionFontSize + 2 : 0) }}
        >
          <span
            className="font-display font-semibold tabular-nums leading-none"
            style={{ fontSize: valueFontSize }}
          >
            {Math.round(clamped)}%
          </span>
          {label ? (
            <span
              className="mt-0.5 text-center text-muted-foreground leading-none"
              style={{ fontSize: captionFontSize }}
            >
              {label}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

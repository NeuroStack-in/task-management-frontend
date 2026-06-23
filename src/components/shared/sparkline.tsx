import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  /** Render a soft area fill under the line. */
  area?: boolean;
  /** Show a dot at the latest point. Default true (turn off when stretched full-width). */
  showDot?: boolean;
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Monotone-cubic interpolation (Fritsch–Carlson): a smooth curve through every
 * point with **no overshoot**, which is what makes a sparkline read as
 * accurate/professional rather than wobbly.
 */
function monotonePath(pts: readonly (readonly [number, number])[]): string {
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    slope.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  let d = `M ${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = xs[i] + dx[i] / 3;
    const c1y = ys[i] + (m[i] * dx[i]) / 3;
    const c2x = xs[i + 1] - dx[i] / 3;
    const c2y = ys[i + 1] - (m[i + 1] * dx[i]) / 3;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

/**
 * The pulse line — WorkPulse's signature motif (Docs/DESIGN.md). Colour comes
 * from `currentColor`; set it via a text-* class. The stroke is non-scaling so
 * it stays crisp even when the SVG is stretched to fill its container.
 */
export function Sparkline({
  data,
  area = false,
  showDot = true,
  width = 120,
  height = 36,
  strokeWidth = 2,
  className,
}: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = strokeWidth + 1.5;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = data.map(
    (v, i) =>
      [
        pad + (i / (data.length - 1)) * innerW,
        pad + innerH - ((v - min) / range) * innerH,
      ] as const,
  );

  const d = monotonePath(points);
  const last = points[points.length - 1];
  const gradId = `spark-${width}x${height}-${data.length}-${Math.round(data[0])}-${Math.round(max)}`;
  const areaD = `${d} L ${last[0]},${height} L ${points[0][0]},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fill="none"
      preserveAspectRatio="none"
      className={cn("overflow-visible text-primary", className)}
      aria-hidden="true"
    >
      {area ? (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.2} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradId})`} stroke="none" />
        </>
      ) : null}
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showDot ? (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={strokeWidth + 0.5}
          fill="currentColor"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}

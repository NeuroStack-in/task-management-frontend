import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  /** Render a soft area fill under the line. */
  area?: boolean;
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * The pulse line — WorkPulse's signature motif (Docs/DESIGN.md). A smooth SVG
 * sparkline that scales from tiny (stat cards) to large (featured cards).
 * Colour comes from `currentColor`, so set it via a text-* class.
 */
export function Sparkline({
  data,
  area = false,
  width = 120,
  height = 36,
  strokeWidth = 2,
  className,
}: SparklineProps) {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pad = strokeWidth;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * innerW;
    const y = pad + innerH - ((v - min) / range) * innerH;
    return [x, y] as const;
  });

  // Smooth path via Catmull-Rom → cubic Bézier.
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }

  const gradId = `spark-${data.join("-").slice(0, 24)}-${width}x${height}`;
  const areaD = `${d} L ${points[points.length - 1][0]},${height} L ${points[0][0]},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fill="none"
      preserveAspectRatio="none"
      className={cn("text-primary", className)}
      aria-hidden="true"
    >
      {area ? (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#${gradId})`} />
        </>
      ) : null}
      <path
        d={d}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

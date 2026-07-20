/**
 * The WorkPulse clock backdrop — the brand's one signature motif.
 *
 * Lifted out of the landing hero so the auth screens can carry the same mark: signing in should
 * feel continuous with the page you arrived from, not like a different product.
 *
 * Presentational and server-safe — no hooks, no `"use client"`. The only motion is the sweeping
 * second hand (`.wp-clock-second`, a 60s linear rotation defined in `landing.css`), which is
 * disabled under `prefers-reduced-motion`. Everything else is static.
 *
 * Tick rotations are integer degrees on purpose: a floating-point transform would serialise
 * differently on the server and the client and trip a hydration mismatch.
 */

const CARDINALS: [string, number, number][] = [
  ["12", 100, 27],
  ["3", 171, 103],
  ["6", 100, 179],
  ["9", 29, 103],
];

export interface ClockBackdropProps {
  /** Dial width. The hero wants it oversized and bleeding; the auth panel wants it contained. */
  className?: string;
  /** Vertical centre of the dial within its container. */
  top?: string;
  /** Horizontal centre. `50%` on the hero; the auth panel pushes it off-centre. */
  left?: string;
  /** Scales the teal glow behind the dial. */
  glow?: string;
  /** Multiplies every stroke opacity — lets a panel carry the mark without competing with text. */
  intensity?: number;
  /**
   * Freeze the second hand.
   *
   * The sweep is page-initiated motion that runs forever, which under **WCAG 2.2.2 Pause, Stop,
   * Hide (Level A)** needs either a pause control or to settle within 5s. On the marketing hero it
   * sits alone and reads as an ambient signature; beside a password field it is motion in the
   * user's peripheral vision while they type, which is both a distraction problem and a
   * conformance one. The auth screens therefore pose the dial and leave it still.
   */
  still?: boolean;
}

export function ClockBackdrop({
  className = "aspect-square w-[min(140vw,920px)]",
  top = "42%",
  left = "50%",
  glow = "size-[62vw] max-w-[760px]",
  intensity = 1,
  still = false,
}: ClockBackdropProps) {
  const a = (base: number) => Math.min(1, base * intensity).toFixed(3);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* teal centre glow */}
      <span
        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${glow}`}
        style={{
          top,
          left,
          background: `radial-gradient(circle, color-mix(in srgb, var(--wp-accent) ${24 * intensity}%, transparent), transparent 60%)`,
        }}
      />
      <svg
        className={`absolute -translate-x-1/2 -translate-y-1/2 ${className}`}
        style={{ top, left }}
        viewBox="0 0 200 200"
        fill="none"
      >
        {/* dial rings */}
        <circle cx="100" cy="100" r="94" stroke={`rgb(200 230 235 / ${a(0.1)})`} strokeWidth="0.5" />
        <circle cx="100" cy="100" r="70" stroke={`rgb(200 230 235 / ${a(0.05)})`} strokeWidth="0.4" />

        {/* 60 minute ticks; every 5th is an hour tick */}
        {Array.from({ length: 60 }).map((_, i) => {
          const major = i % 5 === 0;
          return (
            <line
              key={i}
              x1="100"
              y1="8"
              x2="100"
              y2={major ? 18 : 13}
              transform={`rotate(${i * 6} 100 100)`}
              stroke={
                major
                  ? `color-mix(in srgb, var(--wp-accent-glow) ${70 * intensity}%, transparent)`
                  : `rgb(200 230 235 / ${a(0.14)})`
              }
              strokeWidth={major ? 1 : 0.5}
              strokeLinecap="round"
            />
          );
        })}

        {/* cardinal numerals */}
        {CARDINALS.map(([t, x, y]) => (
          <text
            key={t}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="wp-mono"
            style={{ fontSize: "7px", fill: `rgb(200 230 235 / ${a(0.3)})` }}
          >
            {t}
          </text>
        ))}

        {/* hands — posed ~10:10 */}
        <g className="wp-clock-hand" style={{ transform: "rotate(305deg)" }}>
          <line x1="100" y1="105" x2="100" y2="58" stroke={`rgb(200 230 235 / ${a(0.55)})`} strokeWidth="2.6" strokeLinecap="round" />
        </g>
        <g className="wp-clock-hand" style={{ transform: "rotate(60deg)" }}>
          <line x1="100" y1="107" x2="100" y2="42" stroke={`rgb(200 230 235 / ${a(0.42)})`} strokeWidth="1.8" strokeLinecap="round" />
        </g>

        {/* The one moving part: a 60s sweep — frozen at ~7s past when `still`. */}
        <g
          className={`wp-clock-hand${still ? "" : " wp-clock-second"}`}
          style={still ? { transform: "rotate(42deg)" } : undefined}
        >
          <line x1="100" y1="112" x2="100" y2="34" stroke="var(--wp-accent-glow)" strokeWidth="0.9" strokeLinecap="round" opacity={intensity} />
        </g>

        {/* hub */}
        <circle cx="100" cy="100" r="2.6" fill="var(--wp-accent-glow)" opacity={intensity} />
        <circle
          cx="100"
          cy="100"
          r="4.6"
          fill="none"
          stroke={`color-mix(in srgb, var(--wp-accent-glow) ${45 * intensity}%, transparent)`}
          strokeWidth="0.6"
        />
      </svg>
    </div>
  );
}

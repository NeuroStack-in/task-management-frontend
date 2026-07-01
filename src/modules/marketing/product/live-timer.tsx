"use client";

import { useEffect, useState } from "react";
import { Pause, SkipForward } from "lucide-react";

/** A live, ticking timer mock for the Time Tracking hero. */
export function LiveTimer() {
  // Start at 02:14:08 and tick every second on the client.
  const [secs, setSecs] = useState(2 * 3600 + 14 * 60 + 8);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(Math.floor(secs / 3600)).padStart(2, "0");
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  // A wave of activity bars (deterministic heights, animated via CSS pulse).
  const bars = [38, 62, 50, 74, 66, 82, 58, 70, 88, 64, 46, 78];

  return (
    <div
      className="m-enter-right relative mx-auto w-full max-w-md"
      style={{ animationDelay: "120ms" }}
    >
      {/* soft glow behind the card */}
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] opacity-70 blur-2xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--m-accent) 28%, transparent), transparent)" }}
        aria-hidden
      />
      <div className="m-card p-6 sm:p-7" style={{ boxShadow: "0 40px 90px -40px rgb(8 30 28 / 0.45)" }}>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--m-accent-ink)" }}>
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: "var(--m-accent)" }} />
              <span className="relative inline-flex size-2.5 rounded-full" style={{ background: "var(--m-accent)" }} />
            </span>
            Tracking now
          </span>
          <span className="text-xs" style={{ color: "var(--m-muted)" }}>Today · Mon 22</span>
        </div>

        <p className="m-mono mt-6 text-center text-5xl font-semibold tracking-tight tabular-nums" style={{ color: "var(--m-accent)" }}>
          {hh}:{mm}:{ss}
        </p>
        <p className="mt-1.5 text-center text-sm" style={{ color: "var(--m-muted)" }}>
          Checkout flow · <span style={{ color: "var(--m-text)" }}>Acme Storefront</span>
        </p>

        <div className="mt-5 flex justify-center gap-2.5">
          <span className="m-btn m-btn-primary text-sm">
            <Pause className="size-4" /> Pause
          </span>
          <span className="m-btn m-btn-ghost text-sm">
            <SkipForward className="size-4" /> Switch task
          </span>
        </div>

        {/* live activity bars */}
        <div className="mt-7 flex h-16 items-end gap-1.5">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 animate-pulse rounded-t"
              style={{
                height: `${h}%`,
                background: i === 8 ? "var(--m-accent)" : "color-mix(in srgb, var(--m-accent) 34%, transparent)",
                animationDelay: `${i * 110}ms`,
                animationDuration: "2.4s",
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px]" style={{ color: "var(--m-faint)" }}>
          <span>9 AM</span>
          <span>Active · 82%</span>
          <span>now</span>
        </div>
      </div>
    </div>
  );
}

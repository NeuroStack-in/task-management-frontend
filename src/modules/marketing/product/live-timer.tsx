"use client";

import { useEffect, useState } from "react";
import { Pause, SkipForward } from "lucide-react";

/**
 * A live, ticking timer mock for the Time Tracking hero — a warm card on the dark clock hero, like
 * the landing's own hero cards (2026-10-15; it was a dark-petrol card on a dark-petrol page).
 */
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

  // A wave of activity bars (deterministic heights).
  const bars = [38, 62, 50, 74, 66, 82, 58, 70, 88, 64, 46, 78];

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="wp-card p-6 sm:p-7" style={{ boxShadow: "0 40px 90px -36px rgb(0 0 0 / 0.55)" }}>
        <div className="flex items-center justify-between">
          <span className="wp-chip" style={{ color: "var(--wp-accent-ink)", borderColor: "var(--wp-accent)" }}>
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: "var(--wp-accent)" }} />
              <span className="relative inline-flex size-2 rounded-full" style={{ background: "var(--wp-accent)" }} />
            </span>
            Tracking now
          </span>
          <span className="text-xs" style={{ color: "var(--wp-faint)" }}>Today · Mon 22</span>
        </div>

        <div className="mt-6 rounded-2xl px-5 py-5" style={{ background: "var(--wp-accent-soft)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--wp-accent-ink)" }}>
            Checkout flow · Acme Storefront
          </p>
          <p className="wp-mono mt-1 text-[2.6rem] leading-none font-medium tracking-tight sm:text-5xl" style={{ color: "var(--wp-ink)" }}>
            {hh}:{mm}:{ss}
          </p>
        </div>

        <div className="mt-5 flex gap-2.5">
          <span className="wp-btn wp-btn-primary flex-1 px-3 py-2.5 text-sm whitespace-nowrap">
            <Pause className="size-4" /> Pause
          </span>
          <span className="wp-btn wp-btn-ghost flex-1 px-3 py-2.5 text-sm whitespace-nowrap">
            <SkipForward className="size-4" /> Switch task
          </span>
        </div>

        {/* activity bars */}
        <div className="mt-7 flex h-16 items-end gap-1.5" aria-hidden="true">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 animate-pulse rounded-t-md"
              style={{
                height: `${h}%`,
                background: i === 8 ? "var(--wp-accent)" : "var(--wp-border-strong)",
                animationDelay: `${i * 110}ms`,
                animationDuration: "2.4s",
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px]" style={{ color: "var(--wp-faint)" }}>
          <span>9 AM</span>
          <span>Active · 82%</span>
          <span>now</span>
        </div>
      </div>
    </div>
  );
}

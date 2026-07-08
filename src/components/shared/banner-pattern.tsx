"use client";

import { Sparkline } from "@/components/shared/sparkline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type BannerPattern =
  | "dots"
  | "grid"
  | "topographic"
  | "mesh"
  | "diagonal";

export const BANNER_PATTERNS: { value: BannerPattern; label: string }[] = [
  { value: "dots", label: "Dots" },
  { value: "grid", label: "Grid lines" },
  { value: "topographic", label: "Topographic" },
  { value: "mesh", label: "Mesh gradient" },
  { value: "diagonal", label: "Diagonal streaks" },
];

const LIGHT_DEPTH =
  "radial-gradient(130% 120% at 12% -10%, rgb(255 255 255 / 0.20), transparent 55%), radial-gradient(90% 120% at 100% 120%, rgb(0 0 0 / 0.26), transparent 60%)";

/**
 * Decorative, patterned background for a featured banner (`bg-feature`). Purely
 * presentational white/black-alpha layers, so it works in light and dark. Drop
 * inside a `relative overflow-hidden` banner; content sits above it.
 */
export function BannerBackground({ pattern }: { pattern: BannerPattern }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {pattern === "dots" ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(rgb(255 255 255 / 0.16) 1px, transparent 1.6px)",
            backgroundSize: "22px 22px",
            maskImage:
              "radial-gradient(125% 125% at 18% -10%, black 38%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(125% 125% at 18% -10%, black 38%, transparent 80%)",
          }}
        />
      ) : null}

      {pattern === "grid" ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgb(255 255 255 / 0.12) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage:
              "radial-gradient(125% 125% at 18% -10%, black 42%, transparent 82%)",
            WebkitMaskImage:
              "radial-gradient(125% 125% at 18% -10%, black 42%, transparent 82%)",
          }}
        />
      ) : null}

      {pattern === "topographic" ? (
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 1200 400"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
          style={{
            maskImage:
              "radial-gradient(120% 130% at 82% 28%, black 28%, transparent 84%)",
            WebkitMaskImage:
              "radial-gradient(120% 130% at 82% 28%, black 28%, transparent 84%)",
          }}
        >
          <g
            fill="none"
            stroke="rgb(255 255 255)"
            strokeWidth={1.5}
            strokeOpacity={0.13}
          >
            {[0.5, 0.9, 1.3, 1.7, 2.1, 2.6, 3.1, 3.7, 4.3].map((k, i) => (
              <path
                key={i}
                d="M120 18 C 176 14 196 58 188 92 C 182 132 150 152 108 146 C 68 140 52 108 58 72 C 64 36 88 22 120 18 Z"
                transform={`translate(900 175) scale(${k}) translate(-120 -85)`}
              />
            ))}
          </g>
        </svg>
      ) : null}

      {pattern === "mesh" ? (
        <>
          <div className="absolute -left-10 -top-24 size-72 rounded-full bg-white/[0.12] blur-3xl" />
          <div className="absolute right-8 -bottom-28 size-96 rounded-full bg-black/[0.16] blur-3xl" />
          <div className="absolute left-1/3 top-6 size-64 rounded-full bg-white/[0.08] blur-3xl" />
          <div className="absolute right-1/4 top-1/3 size-52 rounded-full bg-white/[0.1] blur-2xl" />
        </>
      ) : null}

      {pattern === "diagonal" ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, rgb(255 255 255 / 0.07) 0 3px, transparent 3px 34px)",
            maskImage:
              "radial-gradient(120% 120% at 20% 0%, black 45%, transparent 86%)",
            WebkitMaskImage:
              "radial-gradient(120% 120% at 20% 0%, black 45%, transparent 86%)",
          }}
        />
      ) : null}

      {/* Shared soft light + depth */}
      <div className="absolute inset-0" style={{ background: LIGHT_DEPTH }} />

      {/* Faint baseline wave (skip for the soft mesh look) */}
      {pattern !== "mesh" ? (
        <div className="absolute inset-x-0 bottom-0 opacity-[0.1]">
          <Sparkline
            data={[18, 42, 30, 58, 40, 72, 55, 84, 66, 92]}
            area
            height={110}
            strokeWidth={2}
            className="text-white"
          />
        </div>
      ) : null}

      {/* Crisp top highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
    </div>
  );
}

/** A small, banner-friendly dropdown to switch the pattern (temporary/demo). */
export function BannerPatternPicker({
  value,
  onChange,
  className,
}: {
  value: BannerPattern;
  onChange: (p: BannerPattern) => void;
  className?: string;
}) {
  return (
    <div className={cn("absolute right-4 top-4 z-20", className)}>
      <Select value={value} onValueChange={(v) => onChange(v as BannerPattern)}>
        <SelectTrigger
          aria-label="Banner pattern"
          className="h-8 gap-2 border-white/25 bg-white/15 text-white hover:bg-white/25 [&>svg]:text-white/80"
        >
          <SelectValue>
            {(v) =>
              BANNER_PATTERNS.find((p) => p.value === v)?.label ?? "Pattern"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {BANNER_PATTERNS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

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

export type BannerPattern = "dots" | "grid";

export const BANNER_PATTERNS: { value: BannerPattern; label: string }[] = [
  { value: "dots", label: "Dots" },
  { value: "grid", label: "Grid lines" },
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

      {/* Shared soft light + depth */}
      <div className="absolute inset-0" style={{ background: LIGHT_DEPTH }} />

      {/* Faint baseline wave */}
      <div className="absolute inset-x-0 bottom-0 opacity-[0.1]">
        <Sparkline
          data={[18, 42, 30, 58, 40, 72, 55, 84, 66, 92]}
          area
          height={110}
          strokeWidth={2}
          className="text-white"
        />
      </div>

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

"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PALETTES, applyPalette } from "@/components/layout/palette-switcher";
import { cn } from "@/lib/utils";

/** The colour palettes offered on the Appearance page. */
const PALETTE_OPTIONS = PALETTES.filter(
  (p) => p.id === "meridian" || p.id === "indigo",
);

interface ThemeOption {
  value: "light" | "dark" | "system";
  label: string;
  description: string;
  icon: LucideIcon;
  /** Mini preview swatches (canvas, card, accent). */
  swatch: { canvas: string; card: string; accent: string };
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    description: "Bright graphite canvas.",
    icon: Sun,
    swatch: { canvas: "#F4F5F7", card: "#FFFFFF", accent: "#4338CA" },
  },
  {
    value: "dark",
    label: "Dark",
    description: "Charcoal canvas for low light.",
    icon: Moon,
    swatch: { canvas: "#14161B", card: "#1B1E25", accent: "#6366F1" },
  },
  {
    value: "system",
    label: "System",
    description: "Match your device.",
    icon: Monitor,
    swatch: { canvas: "#9AA1AD", card: "#E7E9EE", accent: "#4F46E5" },
  },
];

function ThemePreview({ swatch }: { swatch: ThemeOption["swatch"] }) {
  return (
    <div
      className="flex h-28 w-full gap-2 rounded-md border border-border p-2.5"
      style={{ backgroundColor: swatch.canvas }}
    >
      {/* Mini sidebar */}
      <div
        className="flex w-1/4 flex-col gap-1.5 rounded-sm p-1.5"
        style={{ backgroundColor: swatch.card }}
      >
        <span
          className="block h-1.5 w-full rounded-full"
          style={{ backgroundColor: swatch.accent }}
        />
        <span
          className="block h-1.5 w-3/4 rounded-full opacity-40"
          style={{ backgroundColor: swatch.accent }}
        />
        <span
          className="block h-1.5 w-2/3 rounded-full opacity-40"
          style={{ backgroundColor: swatch.accent }}
        />
      </div>
      {/* Content cards */}
      <div className="flex flex-1 flex-col gap-2">
        <div
          className="h-1/2 rounded-sm"
          style={{ backgroundColor: swatch.card }}
        />
        <div className="flex flex-1 gap-2">
          <div
            className="flex-1 rounded-sm"
            style={{ backgroundColor: swatch.card }}
          />
          <div
            className="w-1/3 rounded-sm"
            style={{ backgroundColor: swatch.accent }}
          />
        </div>
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [palette, setPalette] = useState("meridian");

  // next-themes + the palette attr resolve on the client; read after mount to
  // avoid an SSR/hydration mismatch.
  useEffect(() => {
    setMounted(true);
    try {
      setPalette(window.localStorage.getItem("wp-palette") || "meridian");
    } catch {
      /* storage blocked — keep the default */
    }
  }, []);
  const active = mounted ? theme : undefined;

  const choosePalette = (id: string) => {
    applyPalette(id);
    setPalette(id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appearance"
        description="Choose how WorkPulse looks on this device."
      />

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Applies to your account on this browser only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label="Theme"
            className="grid gap-4 sm:grid-cols-3"
          >
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = active === option.value;
              return (
                <button
                  key={option.value}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-lg border border-border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    selected
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-primary/30 hover:bg-muted/50",
                  )}
                >
                  <ThemePreview swatch={option.swatch} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="size-4 text-muted-foreground" />
                        {option.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-transparent",
                      )}
                    >
                      <Check className="size-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colour theme</CardTitle>
          <CardDescription>
            Pick the accent palette used across WorkPulse. Saved on this browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label="Colour theme"
            className="grid gap-4 sm:grid-cols-2"
          >
            {PALETTE_OPTIONS.map((option) => {
              const selected = mounted && palette === option.id;
              return (
                <button
                  key={option.id}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choosePalette(option.id)}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-lg border border-border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    selected
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-primary/30 hover:bg-muted/50",
                  )}
                >
                  <ThemePreview
                    swatch={{
                      canvas: option.swatch[3],
                      card: "#ffffff",
                      accent: option.swatch[0],
                    }}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="flex shrink-0 -space-x-1">
                          {option.swatch.slice(0, 3).map((c, i) => (
                            <span
                              key={c + i}
                              className="size-3 rounded-full border border-border/60"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </span>
                        {option.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {option.note}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-transparent",
                      )}
                    >
                      <Check className="size-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

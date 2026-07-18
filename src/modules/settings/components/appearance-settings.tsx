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
import { FONTS, applyFont, currentFont } from "@/lib/fonts";
import { useSaveAppearance } from "@/modules/settings/use-appearance";
import { cn } from "@/lib/utils";

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
    description: "Bright graphite canvas for well-lit spaces.",
    icon: Sun,
    swatch: { canvas: "#F4F5F7", card: "#FFFFFF", accent: "#4338CA" },
  },
  {
    value: "dark",
    label: "Dark",
    description: "Charcoal canvas that's easy on the eyes at night.",
    icon: Moon,
    swatch: { canvas: "#14161B", card: "#1B1E25", accent: "#6366F1" },
  },
  {
    value: "system",
    label: "System",
    description: "Match your device's appearance automatically.",
    icon: Monitor,
    swatch: { canvas: "#9AA1AD", card: "#E7E9EE", accent: "#4F46E5" },
  },
];

function ThemePreview({ swatch }: { swatch: ThemeOption["swatch"] }) {
  return (
    <div
      className="flex h-16 w-full items-end gap-1.5 rounded-lg border p-2"
      style={{ backgroundColor: swatch.canvas }}
    >
      <div
        className="h-full flex-1 rounded-md"
        style={{ backgroundColor: swatch.card }}
      />
      <div className="flex h-full flex-col justify-end gap-1">
        <span
          className="block h-2 w-8 rounded-full"
          style={{ backgroundColor: swatch.accent }}
        />
        <span
          className="block h-2 w-6 rounded-full"
          style={{ backgroundColor: swatch.card }}
        />
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const { theme } = useTheme();
  const { saveTheme } = useSaveAppearance();
  const [mounted, setMounted] = useState(false);
  const [font, setFont] = useState("ibmplex");

  // next-themes + the persisted font resolve on the client; avoid an
  // SSR/hydration mismatch by reading them after mount.
  useEffect(() => {
    setMounted(true);
    setFont(currentFont());
  }, []);
  const active = mounted ? theme : undefined;

  const chooseFont = (id: string) => {
    applyFont(id);
    setFont(id);
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
            Saved to your account, so it follows you to any browser you sign in
            on. It does not change the theme for other members.
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
                  onClick={() => void saveTheme(option.value)}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-2xl border p-3 text-left transition-colors",
                    selected
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-foreground/20 hover:bg-muted/50",
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
          <CardTitle>Font</CardTitle>
          <CardDescription>
            Choose the type pairing used across WorkPulse. Unlike theme and
            palette, this one is saved on this browser only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label="Font"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            {FONTS.map((f) => {
              const selected = mounted && font === f.id;
              return (
                <button
                  key={f.id}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => chooseFont(f.id)}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-2xl border p-3 text-left transition-colors",
                    selected
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-foreground/20 hover:bg-muted/50",
                  )}
                >
                  {/* Live preview in the pairing's own fonts */}
                  <div className="flex h-16 w-full items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3">
                    <span
                      className="text-2xl font-semibold leading-none"
                      style={{ fontFamily: f.displayVar }}
                    >
                      Ag
                    </span>
                    <span
                      className="text-sm text-muted-foreground"
                      style={{ fontFamily: f.bodyVar }}
                    >
                      Dashboard
                    </span>
                    <span
                      className="text-sm tabular-nums"
                      style={{ fontFamily: f.monoVar }}
                    >
                      09:24
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.note}
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

"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { FONTS, applyFont, currentFont } from "@/lib/fonts";
import {
  PALETTES,
  applyPalette,
  currentPalette,
  DEFAULT_PALETTE,
} from "@/lib/palette";
import { markThemeChosen } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useAppearance, type AppearanceTheme } from "../use-appearance";

interface ThemeOption {
  value: "light" | "dark" | "system";
  label: string;
  description: string;
  icon: LucideIcon;
  /** Mini preview surfaces. The accent comes from the live palette, not from here. */
  swatch: { canvas: string; card: string };
}

/** `light` is the product default — see `AppProviders` (`defaultTheme="light"`, deliberately not
 *  `system`) and the server's own default in `identity::appearance`. Badged in the UI so it is
 *  obvious which option a new account lands on. */
const DEFAULT_THEME: ThemeOption["value"] = "light";

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Light",
    description: "Bright graphite canvas for well-lit spaces.",
    icon: Sun,
    swatch: { canvas: "#F4F5F7", card: "#FFFFFF" },
  },
  {
    value: "dark",
    label: "Dark",
    description: "Charcoal canvas that's easy on the eyes at night.",
    icon: Moon,
    swatch: { canvas: "#14161B", card: "#1B1E25" },
  },
  {
    value: "system",
    label: "System",
    description: "Match your device's appearance automatically.",
    icon: Monitor,
    swatch: { canvas: "#9AA1AD", card: "#E7E9EE" },
  },
];

/** The "this is what you get by default" pill, used on the default theme + palette. */
function DefaultBadge() {
  return (
    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      Default
    </span>
  );
}

/** `accent` is the *active* palette's swatch, so the preview shows the colours the app really uses —
 *  it used to hard-code the retired indigo and quietly lied after every palette change. */
function ThemePreview({
  swatch,
  accent,
}: {
  swatch: ThemeOption["swatch"];
  accent: string;
}) {
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
        <span className="block h-2 w-8 rounded-full" style={{ backgroundColor: accent }} />
        <span
          className="block h-2 w-6 rounded-full"
          style={{ backgroundColor: swatch.card }}
        />
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [font, setFont] = useState("ibmplex");
  const [palette, setPalette] = useState(DEFAULT_PALETTE);

  // The server holds the account-wide theme + palette; they apply instantly per browser and sync
  // across the account's devices.
  const { serverPalette, saveTheme, savePalette } = useAppearance();

  // next-themes + the persisted font resolve on the client; avoid an
  // SSR/hydration mismatch by reading them after mount.
  useEffect(() => {
    setMounted(true);
    setFont(currentFont());
    setPalette(currentPalette());
  }, []);
  const active = mounted ? theme : undefined;

  // The accent the theme previews draw with — the palette actually in use, so the previews can't
  // drift from the product's colours the way a hard-coded hex did.
  const defaultSwatch = PALETTES.find((p) => p.id === DEFAULT_PALETTE)?.swatch ?? "#0f9b8e";
  const activeSwatch = PALETTES.find((p) => p.id === palette)?.swatch ?? defaultSwatch;

  // Adopting the account's stored theme/palette is the shell's job now (`AppearanceSync`), so it
  // happens on every screen rather than only this one. This just mirrors whatever ended up applied,
  // so the selected swatch is right even if the sync landed after this page mounted.
  useEffect(() => {
    if (serverPalette === null) return;
    setPalette(currentPalette());
  }, [serverPalette]);

  const chooseTheme = (value: AppearanceTheme) => {
    setTheme(value); // instant, local
    // Record the deliberate pick so the shell stops forcing the light default here (lib/theme.ts) —
    // this is what lets "System" survive, given the server can't distinguish it from "unset".
    markThemeChosen();
    saveTheme(value).catch(() =>
      toast.error("Theme applied here, but couldn't save it to your account."),
    );
  };

  const chooseFont = (id: string) => {
    applyFont(id);
    setFont(id);
  };

  const choosePalette = (id: string) => {
    applyPalette(id); // instant, local
    setPalette(id);
    savePalette(id).catch(() =>
      toast.error("Palette applied here, but couldn't save it to your account."),
    );
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
            Applies to your account across your devices. It does not change the
            theme for other members.
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
                  onClick={() => chooseTheme(option.value)}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-2xl border p-3 text-left transition-colors",
                    selected
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-foreground/20 hover:bg-muted/50",
                  )}
                >
                  <ThemePreview swatch={option.swatch} accent={activeSwatch} />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="size-4 text-muted-foreground" />
                        {option.label}
                        {option.value === DEFAULT_THEME ? <DefaultBadge /> : null}
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
          <CardTitle>Color theme</CardTitle>
          <CardDescription>
            Pick the accent palette used across WorkPulse. Applies to your account across your
            devices; only the brand colors change — the neutrals stay put.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label="Color theme"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
          >
            {PALETTES.map((p) => {
              const selected = mounted && palette === p.id;
              return (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choosePalette(p.id)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    selected
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-foreground/20 hover:bg-muted/50",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-9 shrink-0 rounded-lg border shadow-sm"
                    style={{
                      background: `linear-gradient(135deg, ${p.swatch} 0%, ${p.swatch} 55%, color-mix(in srgb, ${p.swatch} 30%, #fff) 55%)`,
                    }}
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="truncate">{p.name}</span>
                      {p.id === DEFAULT_PALETTE ? <DefaultBadge /> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{p.note}</p>
                  </div>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-transparent",
                    )}
                  >
                    <Check className="size-3" />
                  </span>
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
            Choose the type pairing used across WorkPulse. Saved on this browser.
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

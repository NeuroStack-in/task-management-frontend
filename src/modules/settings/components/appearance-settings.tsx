"use client";

import { useEffect, useRef, useState } from "react";
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
  coercePalette,
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

/** The font a new browser starts on — `lib/fonts.ts` applies it when nothing is stored. */
const DEFAULT_FONT = "ibmplex";

/**
 * The palettes the picker offers (UX audit 2026-10-16, SET-17): eight that look different from one
 * another. It listed fifteen, several near-copies — three teals, four blues, two purples, two reds —
 * so choosing meant squinting at swatches. The others stay valid in `lib/palette.ts` and
 * `globals.css`, so an account that already uses one keeps it, and it stays on the picker for them
 * (see `keptPalette`).
 */
const OFFERED_PALETTES = [
  "teal",
  "evergreen",
  "corporate",
  "indigo",
  "violet",
  "crimson",
  "fireopal",
  "iron",
] as const;
const OFFERED = new Set<string>(OFFERED_PALETTES);

/** The "this is what you get by default" pill, used on the default theme, palette and font. */
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
  /**
   * A palette this account uses that the picker no longer offers. Shown for the whole visit, so
   * someone who tries another colour can still go back to theirs.
   */
  const [keptPalette, setKeptPalette] = useState<string | null>(null);
  const keep = (id: string) => {
    if (!OFFERED.has(id) && PALETTES.some((p) => p.id === id)) setKeptPalette(id);
  };

  // The server holds the account-wide theme + palette; they apply instantly per browser and sync
  // across the account's devices.
  const { serverPalette, saveTheme, savePalette, saveFont } = useAppearance();

  // next-themes + the persisted font resolve on the client; avoid an
  // SSR/hydration mismatch by reading them after mount.
  useEffect(() => {
    setMounted(true);
    setFont(currentFont());
    setPalette(currentPalette());
    keep(currentPalette());
  }, []);
  const active = mounted ? theme : undefined;

  // The accent the theme previews draw with — the palette actually in use, so the previews can't
  // drift from the product's colours the way a hard-coded hex did.
  const defaultSwatch = PALETTES.find((p) => p.id === DEFAULT_PALETTE)?.swatch ?? "#0f9b8e";
  const activeSwatch = PALETTES.find((p) => p.id === palette)?.swatch ?? defaultSwatch;

  // Adopting the account's stored theme/palette is the shell's job (`AppearanceSync`), so it happens
  // on every screen. But this page reads the same record, and when its read landed first it mirrored
  // the *old* palette and the swatch stayed there after the shell applied the new one (WP-515). So
  // it applies what it read too — whichever read lands first, both end on the account's palette —
  // unless a swatch was picked here since the page opened: that pick is saved, and wins.
  const pickedHere = useRef(false);
  useEffect(() => {
    if (serverPalette === null) return;
    if (!pickedHere.current) {
      const p = coercePalette(serverPalette);
      if (p !== currentPalette()) applyPalette(p);
    }
    setPalette(currentPalette());
    keep(currentPalette());
  }, [serverPalette]);

  // Personal preferences apply the moment they're picked and say where they were saved
  // (UX audit XC-11 / SET-17). One toast id per control, so quick clicks replace rather than stack.
  const chooseTheme = (value: AppearanceTheme) => {
    setTheme(value); // instant, local
    // Record the deliberate pick in this browser (lib/theme.ts): it stands in for the account's
    // theme whenever that can't be read.
    markThemeChosen();
    saveTheme(value).then(
      () =>
        toast.success("Theme saved to your account", {
          id: "appearance-theme",
          description: "It follows you to every device you sign in on.",
        }),
      () =>
        toast.error("Theme applied here, but couldn't save it to your account.", {
          id: "appearance-theme",
        }),
    );
  };

  const chooseFont = (id: string) => {
    applyFont(id); // instant, local
    setFont(id);
    // Saved to the account like the theme and palette (SET-17); an older server without the field
    // keeps it on this browser, and the toast says which happened.
    saveFont(id).then(
      (synced) =>
        toast.success(synced ? "Font saved to your account" : "Font saved on this browser", {
          id: "appearance-font",
          description: synced
            ? "It follows you to every device you sign in on."
            : "Your other devices keep their own font.",
        }),
      () =>
        toast.error("Font applied here, but couldn't save it to your account.", {
          id: "appearance-font",
        }),
    );
  };

  const choosePalette = (id: string) => {
    pickedHere.current = true;
    applyPalette(id); // instant, local
    setPalette(id);
    savePalette(id).then(
      () =>
        toast.success("Color theme saved to your account", {
          id: "appearance-palette",
          description: "It follows you to every device you sign in on.",
        }),
      () =>
        toast.error("Color theme applied here, but couldn't save it to your account.", {
          id: "appearance-palette",
        }),
    );
  };

  // The offered eight, plus the account's own palette when it is one no longer offered.
  const shownPalettes = PALETTES.filter((p) => OFFERED.has(p.id) || p.id === keptPalette);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appearance"
        description="Choose how WorkPulse looks for you. Theme, color theme and font are saved to your account and follow you to every device. Changes apply as you pick them."
      />

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Saved to your account, so it follows you to every device you sign in on.
            Other members aren&apos;t affected.
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
            The accent colors used across WorkPulse — the neutrals stay put. Saved to your
            account, so it follows you to every device you sign in on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label="Color theme"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
          >
            {shownPalettes.map((p) => {
              const selected = mounted && palette === p.id;
              const retired = !OFFERED.has(p.id);
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
                    <p className="truncate text-xs text-muted-foreground">
                      {retired ? "Yours — no longer offered" : p.note.replace(/^Default · /, "")}
                    </p>
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
            The type pairing used across WorkPulse. Saved to your account, like the theme.
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
                      {/* "Default", like the theme and palette — it said "Current" whatever was
                          picked (UX audit SET-17). */}
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">{f.name}</span>
                        {f.id === DEFAULT_FONT ? <DefaultBadge /> : null}
                      </p>
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

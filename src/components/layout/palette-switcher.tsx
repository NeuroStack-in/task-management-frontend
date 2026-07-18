"use client";

import { useEffect, useState } from "react";
import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSaveAppearance } from "@/modules/settings/use-appearance";
import { cn } from "@/lib/utils";

interface PaletteDef {
  id: string;
  name: string;
  note: string;
  /** Representative swatch (accent, deep, dark, light). */
  swatch: string[];
}

/**
 * Available palettes — the documented WorkPulse colour schemes
 * (Docs/DESIGN-color-guide.md). `indigo` is the default (no data-palette attr).
 */
export const PALETTES: PaletteDef[] = [
  {
    id: "meridian",
    name: "Meridian — Slate & Teal",
    note: "Default · enterprise",
    swatch: ["#0e7490", "#22a5b8", "#0f1729", "#f7f8fa"],
  },
  {
    id: "indigo",
    name: "Graphite & Indigo",
    note: "Classic · warm neutral",
    swatch: ["#4f46e5", "#6366f1", "#232427", "#f7f5f1"],
  },
  {
    id: "corporate",
    name: "Corporate Blue",
    note: "Refined · professional",
    swatch: ["#2563eb", "#60a5fa", "#1f2937", "#f5f7fa"],
  },
  {
    id: "evergreen",
    name: "Evergreen & Mint",
    note: "Calm · SaaS green",
    swatch: ["#059669", "#34d399", "#1d2a26", "#f5f8f6"],
  },
  {
    id: "fireopal",
    name: "Fire Opal",
    note: "Fire Opal · Raisin Black",
    swatch: ["#ef6448", "#2a2320", "#252320", "#f8f5f1"],
  },
  {
    id: "teal",
    name: "Slate & Teal",
    note: "Calm · HR-grade",
    swatch: ["#0f9b8e", "#16b8a6", "#232427", "#f7f5f1"],
  },
  {
    id: "violet",
    name: "Cloud & Violet",
    note: "Modern · people-ops",
    swatch: ["#7c3aed", "#a78bfa", "#232427", "#f7f5f1"],
  },
  {
    id: "sapphire",
    name: "Arctic & Sapphire",
    note: "Data-forward · analytics",
    swatch: ["#1d63c9", "#2563eb", "#232427", "#f7f5f1"],
  },
  {
    id: "dusk",
    name: "Dusk & Rose",
    note: "Editorial · executive",
    swatch: ["#7e3bd4", "#f43f5e", "#232427", "#f8f5f2"],
  },
  {
    id: "iron",
    name: "Iron & Crimson",
    note: "Security · compliance",
    swatch: ["#3f4855", "#6b7280", "#dc2626", "#f7f5f1"],
  },
  {
    id: "navy",
    name: "Midnight Navy",
    note: "Authoritative · corporate",
    swatch: ["#2c4e7c", "#4f74a8", "#232427", "#f5f7fa"],
  },
  {
    id: "cobalt",
    name: "Graphite Cobalt",
    note: "Data-driven · analytics",
    swatch: ["#3e63b0", "#6585c8", "#232427", "#f6f7f9"],
  },
  {
    id: "burgundy",
    name: "Burgundy Wine",
    note: "Premium · executive",
    swatch: ["#8c3f4d", "#a86472", "#262223", "#faf6f5"],
  },
  {
    id: "petrol",
    name: "Petrol Cyan",
    note: "Calm · technical",
    swatch: ["#1b6b77", "#3f8d97", "#222626", "#f4f8f8"],
  },
];

const STORAGE_KEY = "wp-palette";
/** Must match the fallback in the pre-paint script (`app/layout.tsx`). */
const DEFAULT_PALETTE = "meridian";

export function applyPalette(id: string) {
  const el = document.documentElement;
  if (id === "indigo") el.removeAttribute("data-palette");
  else el.setAttribute("data-palette", id);
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage blocked — runtime attribute still applies for the session */
  }
}

/** The palette showing right now. Mirrors the pre-paint script's default in `app/layout.tsx`. */
export function currentPalette(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}

export function PaletteSwitcher() {
  const [active, setActive] = useState(DEFAULT_PALETTE);
  const { savePalette } = useSaveAppearance();

  // Read the persisted choice on mount (the inline head script already applied
  // it pre-paint; this just syncs the active checkmark). Default = Meridian.
  useEffect(() => {
    setActive(currentPalette());
  }, []);

  // Applies immediately, then persists to the account so the choice follows the
  // user to another browser. A failed write leaves the local choice in place.
  const choose = (id: string) => {
    setActive(id);
    void savePalette(id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Change colour palette" />
        }
      >
        <Palette className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Colour palette
        </p>
        {PALETTES.map((p) => {
          const isActive = active === p.id;
          return (
            <DropdownMenuItem
              key={p.id}
              onClick={() => choose(p.id)}
              className="gap-2.5"
            >
              <span className="flex shrink-0 -space-x-1">
                {p.swatch.map((c, i) => (
                  <span
                    key={c + i}
                    className="size-4 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium">
                  {p.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {p.note}
                </span>
              </span>
              <Check
                className={cn(
                  "size-4 shrink-0 text-primary",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

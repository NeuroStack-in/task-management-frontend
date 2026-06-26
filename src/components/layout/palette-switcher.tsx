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
    id: "indigo",
    name: "Graphite & Indigo",
    note: "Default · warm neutral",
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
];

const STORAGE_KEY = "wp-palette";

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

export function PaletteSwitcher() {
  const [active, setActive] = useState("indigo");

  // Read the persisted choice on mount (the inline head script already applied
  // it pre-paint; this just syncs the active checkmark).
  useEffect(() => {
    try {
      setActive(window.localStorage.getItem(STORAGE_KEY) || "indigo");
    } catch {
      /* ignore */
    }
  }, []);

  const choose = (id: string) => {
    applyPalette(id);
    setActive(id);
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

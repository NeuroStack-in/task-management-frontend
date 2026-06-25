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

/** Available palettes. `indigo` is the default (no data-palette attribute). */
const PALETTES: PaletteDef[] = [
  {
    id: "indigo",
    name: "Graphite & Indigo",
    note: "Cool neutrals · indigo",
    swatch: ["#4338ca", "#3730a3", "#1a1d23", "#eef0ff"],
  },
  {
    id: "ember",
    name: "Ember",
    note: "Fire Opal · Masterpiece Red",
    swatch: ["#ef6448", "#5a2132", "#202322", "#efe9e9"],
  },
  {
    id: "fireopal",
    name: "Fire Opal",
    note: "Fire Opal · Raisin Black",
    swatch: ["#ef6448", "#202322", "#7c726a", "#f3efea"],
  },
  {
    id: "masterpiece",
    name: "Masterpiece Red",
    note: "Masterpiece Red · Dirty White",
    swatch: ["#5a2132", "#9c4a5a", "#2b141a", "#efe9e9"],
  },
  {
    id: "goldamber",
    name: "Golden Amber",
    note: "Golden Amber · Deep Indigo",
    swatch: ["#ffb246", "#2d1a47", "#7c3aed", "#f6f2ec"],
  },
  {
    id: "creative",
    name: "Creative Teal",
    note: "Pine Teal · Cream",
    swatch: ["#004643", "#0d9488", "#5f6f6b", "#f0ede5"],
  },
  {
    id: "midnightplum",
    name: "Midnight Plum",
    note: "Midnight Plum · Honey Dawn",
    swatch: ["#f0c986", "#3b153a", "#7c3a6e", "#f4eee6"],
  },
];

const STORAGE_KEY = "wp-palette";

function applyPalette(id: string) {
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

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
import { PALETTES, applyPalette } from "@/lib/palettes";
import { cn } from "@/lib/utils";

/**
 * Navbar colour-palette switcher. The full picker also lives in Settings →
 * Appearance; this is the quick-access version. Reads/writes the same
 * `wp-palette` mechanism (see lib/palettes), so the choice is shared.
 */
export function PaletteSwitcher() {
  const [active, setActive] = useState("meridian");

  // The inline head script already applied the palette pre-paint; this just
  // syncs the active checkmark after mount.
  useEffect(() => {
    try {
      setActive(window.localStorage.getItem("wp-palette") || "meridian");
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
        <Palette className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Colour palette
        </p>
        {PALETTES.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => choose(p.id)}
            className="gap-2.5"
          >
            <span className="flex shrink-0 -space-x-1">
              {p.swatch.map((c, i) => (
                <span
                  key={c + i}
                  className="size-4 rounded-sm border border-border/60"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {p.name}
            </span>
            <Check
              className={cn(
                "size-4 shrink-0 text-primary",
                active === p.id ? "opacity-100" : "opacity-0",
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

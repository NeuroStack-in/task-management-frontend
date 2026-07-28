"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markThemeChosen } from "@/lib/theme";
import {
  saveAppearance,
  type AppearanceTheme,
} from "@/modules/settings/services/appearance.service";

/**
 * The navbar theme toggle. Picking here is a **deliberate choice**, so it does what Settings →
 * Appearance does: applies instantly, records that the user chose (so `AppearanceSync` stops
 * forcing the light default in this browser), and persists to the account so it follows them to
 * other devices. Previously it only wrote next-themes' per-origin localStorage — which is shared by
 * every account signed in on that browser, and was why a single old `dark` click kept coming back.
 *
 * The save is best-effort: the theme already applied locally, so a failed write only means it didn't
 * persist — surfaced as a toast, never silently swallowed.
 */
export function ThemeSwitcher() {
  const { setTheme } = useTheme();

  const choose = (value: AppearanceTheme) => {
    setTheme(value); // instant, local
    markThemeChosen();
    saveAppearance({ theme: value }).catch(() =>
      toast.error("Theme applied here, but couldn't save it to your account."),
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Toggle theme" />}
      >
        <Sun className="size-5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-36">
        <DropdownMenuItem className="px-2 py-1.5" onClick={() => choose("light")}>
          <Sun className="size-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem className="px-2 py-1.5" onClick={() => choose("dark")}>
          <Moon className="size-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem className="px-2 py-1.5" onClick={() => choose("system")}>
          <Monitor className="size-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

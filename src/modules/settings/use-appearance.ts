"use client";

/**
 * Theme + palette, synced to the account so they follow the user across devices.
 *
 * How this coexists with the pre-paint script in `app/layout.tsx`: that script reads localStorage
 * and stamps `data-palette` before first paint, which is what stops the flash. localStorage stays
 * the *pre-paint cache*; the server is the *source of truth*. On mount we fetch the stored prefs and
 * apply them only when they differ from what's already showing — so the common case (same device,
 * unchanged prefs) repaints nothing, and a change made on another device lands one frame late
 * rather than not at all.
 *
 * A failed read is deliberately silent: appearance is cosmetic, and a toast on every cold start
 * with a flaky connection would be worse than quietly keeping the local choice.
 *
 * Font is **not** synced — there is no server field for it (see `appearance.service.ts`).
 */
import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { applyPalette, currentPalette } from "@/components/layout/palette-switcher";
import { getAppearance, putAppearance } from "./services/appearance.service";

/**
 * Pulls the account's stored appearance once and applies it. Mount this **once**, high in the
 * authenticated tree (it lives in `DashboardShell`) — not per page.
 */
export function useAppearanceSync(): void {
  const { setTheme } = useTheme();
  const ran = useRef(false);

  useEffect(() => {
    // React 18 StrictMode double-invokes effects in dev; the fetch is harmless but applying twice
    // is pointless churn.
    if (ran.current) return;
    ran.current = true;

    let live = true;
    (async () => {
      try {
        const prefs = await getAppearance();
        if (!live) return;
        if (prefs.theme && prefs.theme !== localStorage.getItem("theme")) {
          setTheme(prefs.theme);
        }
        // "default" is the server's untouched sentinel — it means "never saved", not a palette id.
        if (prefs.palette && prefs.palette !== "default" && prefs.palette !== currentPalette()) {
          applyPalette(prefs.palette);
        }
      } catch {
        /* cosmetic — keep whatever the pre-paint script applied */
      }
    })();

    return () => {
      live = false;
    };
  }, [setTheme]);
}

/**
 * Write-through for a single pref. Applies locally first so the UI is instant, then persists.
 * Returns whether the save landed, so a caller that wants to surface failure can.
 */
export function useSaveAppearance() {
  const { setTheme } = useTheme();

  const saveTheme = useCallback(
    async (theme: string): Promise<boolean> => {
      setTheme(theme);
      try {
        await putAppearance({ theme });
        return true;
      } catch {
        return false;
      }
    },
    [setTheme],
  );

  const savePalette = useCallback(async (palette: string): Promise<boolean> => {
    applyPalette(palette);
    try {
      await putAppearance({ palette });
      return true;
    } catch {
      return false;
    }
  }, []);

  return { saveTheme, savePalette };
}

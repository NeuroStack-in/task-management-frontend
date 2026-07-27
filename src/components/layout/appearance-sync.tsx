"use client";

/**
 * Applies the account's stored appearance (theme + palette) once per session, app-wide.
 *
 * **Why this exists.** The palette is applied pre-paint by the inline script in `app/layout.tsx`,
 * which reads `localStorage` — and `localStorage` is **per-origin**. So an account's saved palette
 * did not follow it to another browser, another machine, or from localhost to the deployed site:
 * the only code that read `/v1/me/appearance` was the Settings → Appearance page itself, so the
 * preference was "synced per account" but applied only if you happened to open that one screen.
 * This hydrates it wherever the app is used, which is what makes the server field meaningful.
 *
 * **One-shot, and the user always wins.** It runs once per mount of the authenticated shell and
 * never fights a later click: the pickers apply locally *and* PUT, so after the first sync the
 * server already agrees with what the user chose.
 *
 * **Silent and best-effort.** A failed read (offline, expired session, 5xx) leaves the pre-paint
 * local choice exactly as it was — appearance is never worth surfacing an error for. Renders nothing.
 */
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { applyPalette, coercePalette, currentPalette } from "@/lib/palette";
import { coerceTheme, getAppearance } from "@/modules/settings/services/appearance.service";

export function AppearanceSync() {
  const { theme, setTheme } = useTheme();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let live = true;

    getAppearance()
      .then((v) => {
        if (!live) return;
        // Palette: only touch the DOM when it actually differs, so we never cause a needless repaint.
        const palette = coercePalette(v.palette);
        if (palette !== currentPalette()) applyPalette(palette);
        // Theme: next-themes owns the class + its own storage; `theme` is undefined until it mounts,
        // in which case setting it is still correct (the server value is the account's choice).
        const stored = coerceTheme(v.theme);
        if (stored !== theme) setTheme(stored);
      })
      .catch(() => {
        /* keep whatever the pre-paint script applied */
      });

    return () => {
      live = false;
    };
  }, [theme, setTheme]);

  return null;
}

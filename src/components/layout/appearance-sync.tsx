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
import { explicitTheme, getAppearance } from "@/modules/settings/services/appearance.service";

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
        // An unset account ("default") coerces to meridian — slate & teal, the product default.
        const palette = coercePalette(v.palette);
        if (palette !== currentPalette()) applyPalette(palette);
        // Theme: adopt only an explicit light/dark choice. The server can't express "unset" (it
        // returns "system" for that too), and adopting "system" would drop an employee who never
        // opened Settings into their laptop's mode — overriding the product's light default. So
        // "unset" leaves next-themes exactly as it was.
        const chosen = explicitTheme(v.theme);
        if (chosen && chosen !== theme) setTheme(chosen);
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

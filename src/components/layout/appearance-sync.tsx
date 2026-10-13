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
import { hasChosenTheme } from "@/lib/theme";
import { explicitTheme, getAppearance } from "@/modules/settings/services/appearance.service";

export function AppearanceSync() {
  const { theme, setTheme } = useTheme();
  const ran = useRef(false);
  // Read through refs so the sync runs exactly once. With `[theme, setTheme]` as deps (next-themes
  // gives `setTheme` a new identity whenever the theme changes), any re-run — a theme flip while the
  // request was in flight, or StrictMode's double effect in dev — cancelled the first run's response
  // and the `ran` guard stopped the second from asking again, so nothing was applied for the session
  // (QA audit 2026-10-08, WP-515).
  const themeRef = useRef(theme);
  const setThemeRef = useRef(setTheme);
  useEffect(() => {
    themeRef.current = theme;
    setThemeRef.current = setTheme;
  });

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // What was showing when the request left. A pick made while it was in flight has already been
    // saved to the account, so it wins over this older answer.
    const themeAtStart = themeRef.current;
    const paletteAtStart = currentPalette();

    getAppearance()
      .then((v) => {
        // Palette: only touch the DOM when it actually differs, so we never cause a needless repaint.
        // An unset account ("default") coerces to the shipped default, `DEFAULT_PALETTE` (teal).
        const palette = coercePalette(v.palette);
        const shown = currentPalette();
        if (shown === paletteAtStart && palette !== shown) applyPalette(palette);
        if (themeRef.current !== themeAtStart) return;
        // Theme, in priority order (see lib/theme.ts):
        //   1. the account's stored light / dark / system — a real choice (the server serves
        //      `light` for an account that never chose), so it follows the user anywhere
        //   2. otherwise, a pick made in this browser    — respected
        //   3. otherwise                                 — LIGHT, the product default
        // Step 3 deliberately overrides whatever is sitting in next-themes' storage: that key is
        // per-origin, not per-account, so one stale `dark` was turning every sign-in on every account
        // dark. Only a recorded choice may keep it.
        const target = explicitTheme(v.theme) ?? (hasChosenTheme() ? null : "light");
        if (target && target !== themeRef.current) setThemeRef.current(target);
      })
      .catch(() => {
        /* keep whatever the pre-paint script applied */
      });
  }, []);

  return null;
}

"use client";

/**
 * The Settings → Appearance state: the account's stored theme + palette, and the writes that
 * persist a new choice.
 *
 * The reads/writes themselves live in `services/appearance.service.ts` (one path, shared with the
 * app-wide `AppearanceSync` in the shell). `next-themes` / the `data-palette` attribute still apply
 * a choice instantly client-side; these writes make it durable for the account rather than only in
 * this browser's localStorage.
 *
 * Writes are fire-and-forget from the UI's perspective — the choice already applied locally, so a
 * failed PUT only means it didn't persist to the account. That is surfaced (a toast), never
 * silently swallowed.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  coerceTheme,
  getAppearance,
  saveAppearance,
  type ApiAppearance,
  type AppearanceTheme,
} from "./services/appearance.service";

export type { AppearanceTheme };

export interface AppearanceState {
  /** The theme the server has stored for this account, once loaded. `null` until then. */
  serverTheme: AppearanceTheme | null;
  /** The palette the server has stored for this account, once loaded. `null` until then. */
  serverPalette: string | null;
  loading: boolean;
  error: string | null;
  /** Persist the chosen theme to the account. Rejects (caught by caller) on failure. */
  saveTheme: (theme: AppearanceTheme) => Promise<void>;
  /** Persist the chosen palette to the account. Rejects (caught by caller) on failure. */
  savePalette: (palette: string) => Promise<void>;
}

export function useAppearance(): AppearanceState {
  const [serverTheme, setServerTheme] = useState<AppearanceTheme | null>(null);
  const [serverPalette, setServerPalette] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getAppearance()
      .then((v) => {
        if (!live) return;
        setServerTheme(coerceTheme(v.theme));
        setServerPalette(v.palette || "default");
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const apply = (v: ApiAppearance) => {
    setServerTheme(coerceTheme(v.theme));
    setServerPalette(v.palette || "default");
  };

  const saveTheme = useCallback(async (theme: AppearanceTheme) => {
    apply(await saveAppearance({ theme }));
  }, []);

  const savePalette = useCallback(async (palette: string) => {
    apply(await saveAppearance({ palette }));
  }, []);

  return { serverTheme, serverPalette, loading, error, saveTheme, savePalette };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    return e.message;
  }
  return "Couldn't load your appearance settings.";
}

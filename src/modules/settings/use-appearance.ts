"use client";

/**
 * Per-user appearance prefs from the live backend (`GET/PUT /v1/me/appearance`, identity, LLD §17).
 *
 * The server stores `theme` (`light|dark|system`) + `palette` and a version. We hydrate the theme
 * from the server on mount so it follows the account across devices, then `save` it back when the
 * user picks a new one — `next-themes` still applies it instantly client-side; this makes the choice
 * durable server-side rather than only in this browser's localStorage.
 *
 * **Font is deliberately not synced** — there is no server field for it (LLD §17 tracks theme +
 * palette only), so the font stays a per-browser preference, honestly labelled as such in the UI.
 * The write is fire-and-forget from the UI's perspective: the theme already applied locally, so a
 * failed PUT only means it didn't persist to the account — surfaced, never silently swallowed.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";

export type AppearanceTheme = "light" | "dark" | "system";

interface AppearanceView {
  theme: string;
  palette: string;
  version: number;
}

export interface AppearanceState {
  /** The theme the server has stored for this account, once loaded. `null` until then. */
  serverTheme: AppearanceTheme | null;
  loading: boolean;
  error: string | null;
  /** Persist the chosen theme to the account. Resolves silently; rejects (caught by caller) on failure. */
  save: (theme: AppearanceTheme) => Promise<void>;
}

function coerceTheme(v: unknown): AppearanceTheme {
  return v === "light" || v === "dark" ? v : "system";
}

export function useAppearance(): AppearanceState {
  const [serverTheme, setServerTheme] = useState<AppearanceTheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Keep the last-known palette + version so a theme-only PUT doesn't drop them.
  const paletteRef = useRef<string>("default");

  useEffect(() => {
    let live = true;
    apiFetch<AppearanceView>("/v1/me/appearance")
      .then((v) => {
        if (!live) return;
        paletteRef.current = v.palette || "default";
        setServerTheme(coerceTheme(v.theme));
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

  const save = useCallback(async (theme: AppearanceTheme) => {
    const v = await apiFetch<AppearanceView>("/v1/me/appearance", {
      method: "PUT",
      body: JSON.stringify({ theme, palette: paletteRef.current }),
    });
    paletteRef.current = v.palette || paletteRef.current;
    setServerTheme(coerceTheme(v.theme));
  }, []);

  return { serverTheme, loading, error, save };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    return e.message;
  }
  return "Couldn't load your appearance settings.";
}

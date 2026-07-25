"use client";

/**
 * Per-user appearance prefs from the live backend (`GET/PUT /v1/me/appearance`, identity, LLD §17).
 *
 * The server stores `theme` (`light|dark|system`) + `palette` + a version. Both are hydrated from the
 * server on mount so they follow the account across devices, then saved back when the user picks a
 * new one — `next-themes` / the `data-palette` attribute still apply the choice instantly client-side;
 * these writes make it durable server-side rather than only in this browser's localStorage.
 *
 * **Font is deliberately not synced** — there is no server field for it, so the font stays a
 * per-browser preference, honestly labelled as such in the UI.
 *
 * The writes are fire-and-forget from the UI's perspective: the choice already applied locally, so a
 * failed PUT only means it didn't persist to the account — surfaced (a toast), never silently swallowed.
 */
import { useCallback, useEffect, useState } from "react";
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
  /** The palette the server has stored for this account, once loaded. `null` until then. */
  serverPalette: string | null;
  loading: boolean;
  error: string | null;
  /** Persist the chosen theme to the account. Rejects (caught by caller) on failure. */
  saveTheme: (theme: AppearanceTheme) => Promise<void>;
  /** Persist the chosen palette to the account. Rejects (caught by caller) on failure. */
  savePalette: (palette: string) => Promise<void>;
}

function coerceTheme(v: unknown): AppearanceTheme {
  return v === "light" || v === "dark" ? v : "system";
}

export function useAppearance(): AppearanceState {
  const [serverTheme, setServerTheme] = useState<AppearanceTheme | null>(null);
  const [serverPalette, setServerPalette] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    apiFetch<AppearanceView>("/v1/me/appearance")
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

  // The server's PUT merges (each field is `unwrap_or current`), so each save sends only the field it
  // changes — the other is preserved server-side.
  const apply = (v: AppearanceView) => {
    setServerTheme(coerceTheme(v.theme));
    setServerPalette(v.palette || "default");
  };

  const saveTheme = useCallback(async (theme: AppearanceTheme) => {
    apply(
      await apiFetch<AppearanceView>("/v1/me/appearance", {
        method: "PUT",
        body: JSON.stringify({ theme }),
      }),
    );
  }, []);

  const savePalette = useCallback(async (palette: string) => {
    apply(
      await apiFetch<AppearanceView>("/v1/me/appearance", {
        method: "PUT",
        body: JSON.stringify({ palette }),
      }),
    );
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

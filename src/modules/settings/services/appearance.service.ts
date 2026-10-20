/**
 * Per-user appearance preferences — `GET/PUT /v1/me/appearance` (identity, LLD §17).
 *
 * The server stores `theme` (`light|dark|system`) + `palette` + `font` + a `version`, so all three
 * follow the account across devices and origins (the font joined them for UX audit SET-17; an older
 * server without the field just leaves it per-browser).
 *
 * Two consumers, one path: `useAppearance` (the Settings → Appearance pickers) and
 * `components/layout/appearance-sync` (the app-wide one-shot hydration).
 */
import { apiFetch } from "@/lib/api";

export type AppearanceTheme = "light" | "dark" | "system";

/** Mirrors `identity::appearance`'s response DTO. */
export interface ApiAppearance {
  theme: string;
  palette: string;
  /** The interface font id; absent until the account has chosen one (or from an older server). */
  font?: string;
  version: number;
}

export function getAppearance(): Promise<ApiAppearance> {
  return apiFetch<ApiAppearance>("/v1/me/appearance");
}

/**
 * Persist a change. The server's PUT **merges** (each field is `unwrap_or current`), so send only
 * the field that changed and the other is preserved.
 */
export function saveAppearance(patch: {
  theme?: AppearanceTheme;
  palette?: string;
  font?: string;
}): Promise<ApiAppearance> {
  return apiFetch<ApiAppearance>("/v1/me/appearance", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

/** Anything that isn't an explicit `light`/`dark` means "follow the device". */
export function coerceTheme(v: unknown): AppearanceTheme {
  return v === "light" || v === "dark" ? v : "system";
}

/**
 * The theme the account has chosen, or `null` for a value this client doesn't know.
 *
 * **`"system"` is a choice.** The server serves `"light"` for an account that never chose
 * (`identity::appearance::DEFAULT_THEME`), so a stored `"system"` means someone picked it. This used
 * to treat `"system"` as unset — true only while the server defaulted to it — which discarded an
 * explicit "System" at every sign-in and on every other device (QA audit 2026-10-08, WP-334).
 */
export function explicitTheme(v: unknown): AppearanceTheme | null {
  return v === "light" || v === "dark" || v === "system" ? v : null;
}

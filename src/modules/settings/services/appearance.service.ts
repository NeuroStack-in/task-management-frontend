/**
 * Per-user appearance preferences — `GET/PUT /v1/me/appearance` (identity, LLD §17).
 *
 * The server stores `theme` (`light|dark|system`) + `palette` + a `version`, so both follow the
 * account across devices and origins. **Font is deliberately not synced** — there is no server field
 * for it, so it stays a per-browser preference (and the UI says so).
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
 * The theme the account has **actually chosen**, or `null` when it hasn't chosen one.
 *
 * The server returns `"system"` both when the user picked "System" *and* when no preference has ever
 * been stored (`appearance/data.rs` defaults the attribute and the whole item to `"system"`), so the
 * two are indistinguishable on the wire. We therefore treat `"system"` as **unset** and let the
 * product default stand — light, per `AppProviders`. Adopting it instead would put every employee
 * who never touched Settings into whatever their laptop happens to be, which is exactly the
 * behaviour `defaultTheme="light"` exists to prevent.
 *
 * The durable fix is server-side: default the stored theme to `"light"` so an explicit `"system"`
 * means something. Until that ships, this function is the boundary that keeps the product default
 * intact — and it stays correct afterwards, because an explicit `light`/`dark` is still adopted.
 */
export function explicitTheme(v: unknown): "light" | "dark" | null {
  return v === "light" || v === "dark" ? v : null;
}

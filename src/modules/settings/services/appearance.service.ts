/**
 * Appearance prefs — the real backend (`identity` context, LLD §17).
 *
 * `GET/PUT /v1/me/appearance` is self-scoped (no permission bit) and stores exactly two fields:
 * `theme` and `palette`. A PUT merges — an omitted key keeps its stored value — and bumps `version`.
 * Reading a user who has never saved returns the defaults `{theme:"system", palette:"default"}`
 * rather than 404.
 *
 * **Font is not part of this contract** and stays local to the browser. Don't invent a server field
 * for it here; the pref would silently vanish on the next PUT, which merges only what it knows.
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `identity::features::appearance::AppearanceView`. */
export interface ApiAppearance {
  theme: string;
  palette: string;
  version: number;
}

export function getAppearance(): Promise<ApiAppearance> {
  return apiFetch<ApiAppearance>("/v1/me/appearance");
}

export function putAppearance(body: {
  theme?: string;
  palette?: string;
}): Promise<ApiAppearance> {
  return apiFetch<ApiAppearance>("/v1/me/appearance", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

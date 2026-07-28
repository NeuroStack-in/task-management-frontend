/**
 * Selectable color palettes (Settings → Appearance → Color theme). The active palette is selected by
 * a `data-palette` attribute on `<html>`; every id below maps to a `[data-palette="<id>"]` block in
 * globals.css. `teal` is the shipped default (the layout's inline script applies it before paint),
 * and `indigo` is special — it is the base `:root`, so it carries **no** attribute.
 *
 * Only the brand tokens change per palette (`--primary`, `--ring`, `--feature`, `--chart-*`,
 * `--sidebar-primary`); the neutrals stay put — see globals.css. Persisted per browser, like the font.
 */

export interface PaletteDef {
  id: string;
  name: string;
  note: string;
  /** The palette's accent (`--primary`, light) — used for the swatch preview. */
  swatch: string;
}

export const PALETTES: PaletteDef[] = [
  { id: "teal", name: "Teal", note: "Default · bright teal", swatch: "#0f9b8e" },
  { id: "meridian", name: "Meridian", note: "Slate & teal", swatch: "#0e7490" },
  { id: "petrol", name: "Petrol", note: "Deep teal", swatch: "#1b6b77" },
  { id: "evergreen", name: "Evergreen", note: "Fresh green", swatch: "#059669" },
  { id: "indigo", name: "Indigo", note: "Graphite & indigo", swatch: "#4f46e5" },
  { id: "corporate", name: "Corporate", note: "Clean blue", swatch: "#2563eb" },
  { id: "cobalt", name: "Cobalt", note: "Classic blue", swatch: "#3e63b0" },
  { id: "sapphire", name: "Sapphire", note: "Bright blue", swatch: "#1d63c9" },
  { id: "navy", name: "Navy", note: "Deep blue", swatch: "#2c4e7c" },
  { id: "violet", name: "Violet", note: "Vivid purple", swatch: "#7c3aed" },
  { id: "dusk", name: "Dusk", note: "Muted purple", swatch: "#7e3bd4" },
  { id: "burgundy", name: "Burgundy", note: "Deep red", swatch: "#8c3f4d" },
  { id: "fireopal", name: "Fire Opal", note: "Warm coral", swatch: "#ef6448" },
  { id: "iron", name: "Iron", note: "Neutral slate", swatch: "#3f4855" },
];

const PALETTE_IDS = new Set(PALETTES.map((p) => p.id));
const STORAGE_KEY = "wp-palette";
/**
 * The shipped default — **keep in step with the inline pre-paint script in `app/layout.tsx`**, which
 * hard-codes the same id (it runs before any module loads, so it cannot import this).
 */
export const DEFAULT_PALETTE = "teal";

/** Coerce a stored/server value to a known palette id. The server's `"default"` (a fresh account)
 *  and any unrecognized value fall back to the shipped default. */
export function coercePalette(v: string | null | undefined): string {
  return v && PALETTE_IDS.has(v) ? v : DEFAULT_PALETTE;
}

/** Apply a palette to `<html>` and persist it. Unknown ids → default. */
export function applyPalette(id: string) {
  const safe = PALETTE_IDS.has(id) ? id : DEFAULT_PALETTE;
  const el = document.documentElement;
  // `indigo` is the base `:root` (no attribute); every other palette sets `data-palette`.
  if (safe === "indigo") el.removeAttribute("data-palette");
  else el.setAttribute("data-palette", safe);
  try {
    window.localStorage.setItem(STORAGE_KEY, safe);
  } catch {
    /* storage blocked — the runtime attribute still applies for the session */
  }
}

/** The persisted palette id (defaults to `teal`). Client-only. */
export function currentPalette(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}

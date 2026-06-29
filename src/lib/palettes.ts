/**
 * Single source of truth for the in-product colour palettes.
 *
 * Only TWO palettes ship as user-selectable (Settings → Appearance): Meridian
 * (the default) and Graphite & Indigo. The full historical set of 14 is
 * documented in Docs/DESIGN-color-guide.md; the rest were retired to keep the
 * product surface minimal. `indigo` is the CSS default (no data-palette attr);
 * every other id maps to a `[data-palette="<id>"]` block in globals.css.
 */

export interface PaletteDef {
  id: string;
  name: string;
  note: string;
  /** Representative swatch (accent, deep, dark, light). */
  swatch: string[];
}

export const PALETTES: PaletteDef[] = [
  {
    id: "meridian",
    name: "Meridian — Slate & Teal",
    note: "Default · enterprise",
    swatch: ["#0e7490", "#22a5b8", "#0f1729", "#f7f8fa"],
  },
  {
    id: "indigo",
    name: "Graphite & Indigo",
    note: "Classic · warm neutral",
    swatch: ["#4f46e5", "#6366f1", "#232427", "#f7f5f1"],
  },
];

const PALETTE_IDS = new Set(PALETTES.map((p) => p.id));
const STORAGE_KEY = "wp-palette";

/** Apply a palette to <html> and persist it. Unknown ids fall back to default. */
export function applyPalette(id: string) {
  const safe = PALETTE_IDS.has(id) ? id : "meridian";
  const el = document.documentElement;
  // `indigo` is the base :root theme — no attribute needed.
  if (safe === "indigo") el.removeAttribute("data-palette");
  else el.setAttribute("data-palette", safe);
  try {
    window.localStorage.setItem(STORAGE_KEY, safe);
  } catch {
    /* storage blocked — runtime attribute still applies for the session */
  }
}

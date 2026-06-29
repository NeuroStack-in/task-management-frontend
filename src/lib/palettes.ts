/**
 * Single source of truth for the in-product colour palettes.
 *
 * All 14 ship as user-selectable (navbar switcher + Settings → Appearance).
 * Meridian is the default; `indigo` is the CSS default (no data-palette attr);
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
  {
    id: "corporate",
    name: "Corporate Blue",
    note: "Refined · professional",
    swatch: ["#2563eb", "#60a5fa", "#1f2937", "#f5f7fa"],
  },
  {
    id: "evergreen",
    name: "Evergreen & Mint",
    note: "Calm · SaaS green",
    swatch: ["#059669", "#34d399", "#1d2a26", "#f5f8f6"],
  },
  {
    id: "fireopal",
    name: "Fire Opal",
    note: "Fire Opal · Raisin Black",
    swatch: ["#ef6448", "#2a2320", "#252320", "#f8f5f1"],
  },
  {
    id: "teal",
    name: "Slate & Teal",
    note: "Calm · HR-grade",
    swatch: ["#0f9b8e", "#16b8a6", "#232427", "#f7f5f1"],
  },
  {
    id: "violet",
    name: "Cloud & Violet",
    note: "Modern · people-ops",
    swatch: ["#7c3aed", "#a78bfa", "#232427", "#f7f5f1"],
  },
  {
    id: "sapphire",
    name: "Arctic & Sapphire",
    note: "Data-forward · analytics",
    swatch: ["#1d63c9", "#2563eb", "#232427", "#f7f5f1"],
  },
  {
    id: "dusk",
    name: "Dusk & Rose",
    note: "Editorial · executive",
    swatch: ["#7e3bd4", "#f43f5e", "#232427", "#f8f5f2"],
  },
  {
    id: "iron",
    name: "Iron & Crimson",
    note: "Security · compliance",
    swatch: ["#3f4855", "#6b7280", "#dc2626", "#f7f5f1"],
  },
  {
    id: "navy",
    name: "Midnight Navy",
    note: "Authoritative · corporate",
    swatch: ["#2c4e7c", "#4f74a8", "#232427", "#f5f7fa"],
  },
  {
    id: "cobalt",
    name: "Graphite Cobalt",
    note: "Data-driven · analytics",
    swatch: ["#3e63b0", "#6585c8", "#232427", "#f6f7f9"],
  },
  {
    id: "burgundy",
    name: "Burgundy Wine",
    note: "Premium · executive",
    swatch: ["#8c3f4d", "#a86472", "#262223", "#faf6f5"],
  },
  {
    id: "petrol",
    name: "Petrol Cyan",
    note: "Calm · technical",
    swatch: ["#1b6b77", "#3f8d97", "#222626", "#f4f8f8"],
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

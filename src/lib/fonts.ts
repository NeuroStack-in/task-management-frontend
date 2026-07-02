/**
 * Selectable font pairings (Settings → Appearance). `ibmplex` is the default
 * (no `data-font` attribute); every other id maps to a `[data-font="<id>"]`
 * block in globals.css. All families are loaded in app/layout.tsx.
 */

export interface FontDef {
  id: string;
  name: string;
  note: string;
  /** Human-readable pairing, e.g. "Space Grotesk · Inter · JetBrains Mono". */
  stack: string;
  /** CSS variables for a live preview (display headline + mono figures). */
  displayVar: string;
  bodyVar: string;
  monoVar: string;
}

export const FONTS: FontDef[] = [
  {
    id: "ibmplex",
    name: "IBM Plex",
    note: "Current · cohesive corporate",
    stack: "IBM Plex Sans · IBM Plex Mono",
    displayVar: "var(--font-ibm-plex-sans)",
    bodyVar: "var(--font-ibm-plex-sans)",
    monoVar: "var(--font-ibm-plex-mono)",
  },
  {
    id: "inter",
    name: "Inter + JetBrains Mono",
    note: "Clean · modern SaaS",
    stack: "Inter · JetBrains Mono",
    displayVar: "var(--font-inter)",
    bodyVar: "var(--font-inter)",
    monoVar: "var(--font-jetbrains-mono)",
  },
  {
    id: "geist",
    name: "Geist",
    note: "Sleek · contemporary",
    stack: "Geist · Geist Mono",
    displayVar: "var(--font-geist)",
    bodyVar: "var(--font-geist)",
    monoVar: "var(--font-geist-mono)",
  },
  {
    id: "manrope",
    name: "Manrope + Inter",
    note: "Dashboard-friendly",
    stack: "Manrope · Inter · JetBrains Mono",
    displayVar: "var(--font-manrope)",
    bodyVar: "var(--font-inter)",
    monoVar: "var(--font-jetbrains-mono)",
  },
  {
    id: "grotesk",
    name: "Space Grotesk + Inter",
    note: "Punchy numerals",
    stack: "Space Grotesk · Inter · JetBrains Mono",
    displayVar: "var(--font-space-grotesk)",
    bodyVar: "var(--font-inter)",
    monoVar: "var(--font-jetbrains-mono)",
  },
];

const FONT_IDS = new Set(FONTS.map((f) => f.id));
const STORAGE_KEY = "wp-font";

/** Apply a font pairing to <html> and persist it. Unknown ids → default. */
export function applyFont(id: string) {
  const safe = FONT_IDS.has(id) ? id : "ibmplex";
  const el = document.documentElement;
  // `ibmplex` is the base (no attribute needed).
  if (safe === "ibmplex") el.removeAttribute("data-font");
  else el.setAttribute("data-font", safe);
  try {
    window.localStorage.setItem(STORAGE_KEY, safe);
  } catch {
    /* storage blocked — runtime attribute still applies for the session */
  }
}

/** The persisted font id (defaults to "ibmplex"). Client-only. */
export function currentFont(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "ibmplex";
  } catch {
    return "ibmplex";
  }
}

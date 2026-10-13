/**
 * How text reaches a PDF page.
 *
 * jsPDF's built-in fonts (Helvetica and the rest) encode **WinAnsi** only: Latin-1 plus 27
 * typographic characters (€ – — ‘ ’ “ ” • … ™ and a few more). One character outside that set makes
 * jsPDF write the *whole string* as two bytes per character, which a single-byte font prints as
 * garbage — the employee report's "1 Jan 26 → 8 Oct 26" turned every page footer into a null byte
 * before each letter, and a Tamil, Hindi or Polish name does the same to its line in every export
 * (QA audit 2026-10-08, WP-225, WP-507).
 *
 * So every string a PDF export prints goes through a {@link PdfText} writer, which picks a route per
 * string ({@link textRoute}):
 *
 *   - **standard** — WinAnsi already: Helvetica, exactly as before. A report made only of these
 *     loads nothing and comes out as it always did.
 *   - **font** — Latin, Greek or Cyrillic beyond WinAnsi (Łukasz Żółć, Ελένη, Дмитрий, ₹): Noto Sans,
 *     fetched once from `/fonts/` and embedded. Still real text — selectable and searchable.
 *   - **raster** — scripts that need shaping (Devanagari, Tamil, Arabic, …), CJK, emoji, arrows.
 *     jsPDF has no shaping engine, so the browser draws the string and it is placed as an image on
 *     the same baseline (`pdf-fonts.ts`). Prints correctly; can't be selected or searched.
 *
 * {@link buildPdf} renders once with Helvetica, noting what it couldn't print; only then does it
 * load fonts and render again. Whatever can't load, the last resort is {@link pdfText}, the WinAnsi
 * sanitiser — the export always completes.
 */
import type { jsPDF } from "jspdf";
import {
  LATIN_FONT,
  loadFonts,
  scriptsIn,
  type FontNeeds,
  type LatinWeight,
  type LoadedFonts,
  type Raster,
  type TextFont,
} from "./pdf-fonts";

// ── what Helvetica can print ─────────────────────────────────────────────────────────────────

/** The 27 code points above U+00FF that WinAnsi (CP1252) carries in its 0x80–0x9F block. */
const WIN_ANSI_EXTRA = new Set(
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split("").map((c) => c.codePointAt(0)),
);

const printable = (code: number | undefined) =>
  code !== undefined && (code <= 0xff || WIN_ANSI_EXTRA.has(code));

/**
 * Characters with an exact WinAnsi stand-in: other spaces, invisible formatting marks, hyphens. A
 * string whose only foreign characters are these still prints in Helvetica and loses nothing — which
 * matters, because browsers' own time formatting puts U+202F before "AM" (en-US), and that alone
 * must not send every report off to fetch a font.
 */
const TYPOGRAPHIC = new Map<string, string>([
  ...Array.from("             　", (c): [string, string] => [c, " "]),
  ...Array.from("​‌‍‎‏‪‫‬‭‮⁠⁦⁧⁨⁩﻿", (c): [string, string] => [c, ""]),
  ["‐", "-"],
  ["‑", "-"],
  ["−", "-"],
  ["‒", "–"],
  ["―", "—"],
]);

/** Last-resort stand-ins for the sanitiser: letters with no Unicode decomposition, and arrows. */
const FOLD: Record<string, string> = {
  ł: "l",
  Ł: "L",
  đ: "d",
  Đ: "D",
  ħ: "h",
  Ħ: "H",
  ı: "i",
  ŋ: "n",
  Ŋ: "N",
  "→": "-",
  "←": "-",
  "↔": "-",
};

/**
 * `text` with every character a standard PDF font can't encode replaced on its own: the exact
 * stand-ins above, accents folded where Unicode can (ő → o), a few letters mapped (ł → l), anything
 * else "?". Used for every standard-route string, and as the fallback when a Unicode font can't be
 * had — then a Tamil name prints as question marks, but the rest of its line survives.
 */
export function pdfText(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    if (printable(ch.codePointAt(0))) {
      out += ch;
      continue;
    }
    const same = TYPOGRAPHIC.get(ch);
    if (same !== undefined) {
      out += same;
      continue;
    }
    if (FOLD[ch]) {
      out += FOLD[ch];
      continue;
    }
    // Decompose and drop the combining marks: ő → o + ̋ → o.
    const folded = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
    out += folded && [...folded].every((c) => printable(c.codePointAt(0))) ? folded : "?";
  }
  return out;
}

// ── which route a string takes ───────────────────────────────────────────────────────────────

/**
 * Scripts that need no shaping (one glyph per character, nothing to reorder or attach) and that
 * Noto Sans covers. Combining marks are left out on purpose: jsPDF can't position them, so a letter
 * and mark that NFC can't compose into one character goes to the canvas, which can.
 */
const SIMPLE: readonly (readonly [number, number])[] = [
  [0x0100, 0x02ff], // Latin Extended-A/B, IPA, spacing modifier letters
  [0x0370, 0x03ff], // Greek
  [0x0400, 0x052f], // Cyrillic, Cyrillic Supplement
  [0x1c80, 0x1c8f], // Cyrillic Extended-C
  [0x1e00, 0x1fff], // Latin Extended Additional (Vietnamese), Greek Extended
  [0x2000, 0x20cf], // punctuation, super/subscripts, currency (₹ ₽ ₴ …)
  [0x2100, 0x215f], // letterlike symbols (№ ™), common fractions
  [0x2c60, 0x2c7f], // Latin Extended-C
  [0xa640, 0xa69f], // Cyrillic Extended-B
  [0xa720, 0xa7ff], // Latin Extended-D
  [0xab30, 0xab6f], // Latin Extended-E
  [0xfb00, 0xfb06], // Latin ligatures
];

export type TextRoute = "standard" | "font" | "raster";

/** How `text` must be printed — see the file note. Decided on the NFC form, so "e" + U+0301 is é. */
export function textRoute(text: string): TextRoute {
  let route: TextRoute = "standard";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0) ?? 0;
    if (printable(code) || TYPOGRAPHIC.has(ch)) continue;
    if (!SIMPLE.some(([lo, hi]) => code >= lo && code <= hi)) return "raster";
    route = "font";
  }
  return route;
}

let segmenter: Intl.Segmenter | null | undefined;

/**
 * `text` split into user-perceived characters, so truncation never cuts a conjunct or strands a
 * vowel sign: "प्रिया" is two of these, not six code points.
 */
export function graphemes(text: string): string[] {
  if (segmenter === undefined) {
    segmenter =
      typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
        ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
        : null;
  }
  if (segmenter) return Array.from(segmenter.segment(text), (s) => s.segment);
  // No Segmenter (Firefox before 125): at least keep marks and joiners on their base character.
  const out: string[] = [];
  for (const ch of text) {
    if (out.length > 0 && /[\p{M}‌‍]/u.test(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

// ── the writer ───────────────────────────────────────────────────────────────────────────────

export interface TextOptions {
  align?: "left" | "center" | "right";
}

/** Every string a PDF export prints goes through one of these — never `doc.text` directly. */
export interface PdfText {
  /**
   * Like `doc.text`: baseline at `y`, in the document's current font, size and colour. An array is
   * one line per entry, spaced as jsPDF spaces them.
   */
  text(text: string | string[], x: number, y: number, options?: TextOptions): void;
  /** Width of `text` in document units, at the current font and size. */
  width(text: string): number;
  /** `text`, cut with an ellipsis if needed to fit `maxWidth` — measured on what will print. */
  fit(text: string, maxWidth: number): string;
  /** `text` word-wrapped into lines no wider than `maxWidth`. */
  wrap(text: string, maxWidth: number): string[];
}

/** Attaches a writer to a document; {@link buildPdf} hands one to the builder. */
export type PdfTextFor = (doc: jsPDF) => PdfText;

type Route = { kind: "standard" } | { kind: "font"; weight: LatinWeight } | { kind: "raster" };
const STANDARD: Route = { kind: "standard" };
const RASTER: Route = { kind: "raster" };

/** What the first pass couldn't print: each string, with the weights it was set in. */
type Seen = Map<string, Set<LatinWeight>>;

const weightOf = (fontStyle: string): LatinWeight => (fontStyle.includes("bold") ? "bold" : "normal");

class Writer implements PdfText {
  /** Noto Sans registered in this document, per weight: the code points it maps, or null if unusable. */
  private readonly latin = new Map<LatinWeight, Record<number, number> | null>();
  /** One image per distinct string, size, style and colour — repeated text reuses it by alias. */
  private readonly images = new Map<string, { raster: Raster; alias: string } | null>();

  /**
   * @param fonts null on the first pass: everything prints in Helvetica (through the sanitiser),
   *   and whatever needed more is noted in `seen`.
   */
  constructor(
    private readonly doc: jsPDF,
    private readonly fonts: LoadedFonts | null,
    private readonly seen: Seen | null,
  ) {}

  text(text: string | string[], x: number, y: number, options?: TextOptions): void {
    if (Array.isArray(text)) {
      if (text.every((line) => textRoute(line) === "standard")) {
        this.put(text.map(pdfText), x, y, options);
        return;
      }
      const step =
        (this.doc.getFontSize() * this.doc.getLineHeightFactor()) / this.doc.internal.scaleFactor;
      text.forEach((line, i) => this.text(line, x, y + i * step, options));
      return;
    }
    const s = text.normalize("NFC");
    const route = this.route(s);
    if (route.kind === "font") {
      this.withLatin(route.weight, () => this.put(s, x, y, options));
      return;
    }
    if (route.kind === "raster" && this.image(s, x, y, options?.align)) return;
    this.put(pdfText(s), x, y, options);
  }

  width(text: string): number {
    const s = text.normalize("NFC");
    return this.measure(this.route(s), s);
  }

  fit(text: string, maxWidth: number): string {
    const s = String(text ?? "").normalize("NFC");
    const route = this.route(s);
    // Helvetica's text: cut by character on the sanitised string, exactly as before.
    const parts = route.kind === "standard" ? [...pdfText(s)] : graphemes(s);
    const measure = (t: string) =>
      route.kind === "standard" ? this.doc.getTextWidth(t) : this.measure(route, t);
    const whole = parts.join("");
    if (measure(whole) <= maxWidth) return whole;
    let lo = 0;
    let hi = parts.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (measure(`${parts.slice(0, mid).join("")}…`) <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return `${parts.slice(0, lo).join("")}…`;
  }

  wrap(text: string, maxWidth: number): string[] {
    const s = text.normalize("NFC");
    const route = this.route(s);
    if (route.kind === "standard") return this.doc.splitTextToSize(pdfText(s), maxWidth) as string[];
    const fits = (t: string) => this.measure(route, t) <= maxWidth;
    const lines: string[] = [];
    let line = "";
    for (const word of s.split(/\s+/).filter(Boolean)) {
      if (fits(word)) {
        const next = line ? `${line} ${word}` : word;
        if (!line || fits(next)) line = next;
        else {
          lines.push(line);
          line = word;
        }
        continue;
      }
      // A word wider than the whole line is broken between graphemes.
      if (line) lines.push(line);
      line = "";
      for (const g of graphemes(word)) {
        if (line && !fits(line + g)) {
          lines.push(line);
          line = g;
        } else line += g;
      }
    }
    if (line) lines.push(line);
    return lines.length > 0 ? lines : [""];
  }

  /** The route `s` (already NFC) takes in the current font. Notes it on the first pass. */
  private route(s: string): Route {
    const route = textRoute(s);
    if (route === "standard") return STANDARD;
    const weight = weightOf(this.doc.getFont().fontStyle);
    if (this.seen) {
      const weights = this.seen.get(s) ?? new Set<LatinWeight>();
      weights.add(weight);
      this.seen.set(s, weights);
    }
    if (!this.fonts) return STANDARD;
    if (route === "font") {
      // Bold falls back to the regular weight if only that one could be had.
      for (const w of weight === "bold" ? (["bold", "normal"] as const) : (["normal"] as const)) {
        if (this.covers(w, s)) return { kind: "font", weight: w };
      }
    }
    return this.fonts.rasterizer() ? RASTER : STANDARD;
  }

  /** Whether Noto Sans in `weight` maps every character of `s` (registering it on first use). */
  private covers(weight: LatinWeight, s: string): boolean {
    if (!this.latin.has(weight)) this.latin.set(weight, this.register(weight));
    const map = this.latin.get(weight);
    if (!map) return false;
    // jsPDF looks glyphs up per UTF-16 unit and silently drops the rest of a string at the first
    // miss, so a string goes this way only if the font has every one of them.
    for (let i = 0; i < s.length; i++) if (!map[s.charCodeAt(i)]) return false;
    return true;
  }

  private register(weight: LatinWeight): Record<number, number> | null {
    const file = this.fonts?.latin[weight];
    if (!file) return null;
    const name = LATIN_FONT.files[weight];
    const prev = this.doc.getFont();
    try {
      this.doc.addFileToVFS(name, file);
      this.doc.addFont(name, LATIN_FONT.family, weight);
      this.doc.setFont(LATIN_FONT.family, weight);
      const map: Record<number, number> | undefined = this.doc.getFont().metadata?.cmap?.unicode?.codeMap;
      return map ?? null;
    } catch {
      return null;
    } finally {
      this.doc.setFont(prev.fontName, prev.fontStyle);
    }
  }

  private withLatin<T>(weight: LatinWeight, draw: () => T): T {
    const prev = this.doc.getFont();
    this.doc.setFont(LATIN_FONT.family, weight);
    try {
      return draw();
    } finally {
      this.doc.setFont(prev.fontName, prev.fontStyle);
    }
  }

  private measure(route: Route, s: string): number {
    if (route.kind === "font") return this.withLatin(route.weight, () => this.doc.getTextWidth(s));
    const rasterizer = route.kind === "raster" ? this.fonts?.rasterizer() : null;
    if (rasterizer) return rasterizer.measure(s, this.textFont()) / this.doc.internal.scaleFactor;
    return this.doc.getTextWidth(pdfText(s));
  }

  private textFont(): TextFont {
    const style = this.doc.getFont().fontStyle;
    return {
      sizePt: this.doc.getFontSize(),
      bold: style.includes("bold"),
      italic: /italic|oblique/.test(style),
    };
  }

  /** Draws `s` as an image on the baseline. False if no image could be made — the caller falls back. */
  private image(s: string, x: number, y: number, align: TextOptions["align"]): boolean {
    const rasterizer = this.fonts?.rasterizer();
    if (!rasterizer) return false;
    const font = this.textFont();
    const color = this.doc.getTextColor();
    const key = `${font.bold ? "b" : ""}${font.italic ? "i" : ""}|${font.sizePt}|${color}|${s}`;
    let entry = this.images.get(key);
    if (entry === undefined) {
      const raster = rasterizer.draw(s, font, color);
      entry = raster && { raster, alias: `wp-text-${this.images.size}` };
      this.images.set(key, entry);
    }
    if (!entry) return false;
    const { raster, alias } = entry;
    const k = this.doc.internal.scaleFactor;
    const advance = raster.advance / k;
    const start = align === "right" ? x - advance : align === "center" ? x - advance / 2 : x;
    this.doc.addImage(
      raster.png,
      "PNG",
      start - raster.left / k,
      y - raster.ascent / k,
      raster.width / k,
      raster.height / k,
      alias,
      "FAST",
    );
    return true;
  }

  private put(text: string | string[], x: number, y: number, options?: TextOptions) {
    if (options) this.doc.text(text, x, y, options);
    else this.doc.text(text, x, y);
  }
}

function needsOf(seen: Seen): FontNeeds {
  const needs: FontNeeds = { latin: new Set(), scripts: new Set() };
  for (const [s, weights] of seen) {
    if (textRoute(s) === "font") weights.forEach((w) => needs.latin.add(w));
    else scriptsIn(s).forEach((id) => needs.scripts.add(id));
  }
  return needs;
}

/**
 * Build a PDF, loading Unicode fonts only if its text needs them.
 *
 * `build` must create its document(s) and draw every string through the writer it attaches with
 * `text(doc)`, and must not save or show anything — it may run twice. The first run prints with
 * Helvetica alone; if every string fit WinAnsi, that document is the result (no fetch, no
 * re-render). Otherwise the fonts it noted are loaded and `build` runs again. If that second run
 * fails, the first run's document — the sanitised one — is returned: the export never fails here.
 */
export async function buildPdf<T>(build: (text: PdfTextFor) => T): Promise<T> {
  const seen: Seen = new Map();
  const plain = build(writers(null, seen));
  if (seen.size === 0) return plain;
  try {
    const fonts = await loadFonts(needsOf(seen));
    return build(writers(fonts, null));
  } catch (err) {
    console.warn("PDF export: Unicode text failed, printing with the standard font instead", err);
    return plain;
  }
}

/**
 * One writer per document, however often it's asked for: a writer owns its document's registered
 * fonts and image aliases, and a second one would register the font again and reuse the first one's
 * image names for different text.
 */
function writers(fonts: LoadedFonts | null, seen: Seen | null): PdfTextFor {
  const attached = new WeakMap<jsPDF, Writer>();
  return (doc) => {
    let writer = attached.get(doc);
    if (!writer) {
      writer = new Writer(doc, fonts, seen);
      attached.set(doc, writer);
    }
    return writer;
  };
}

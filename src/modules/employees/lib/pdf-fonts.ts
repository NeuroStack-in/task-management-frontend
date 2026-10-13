/**
 * Unicode fonts for PDF exports, loaded only when a report's text needs them (WP-225, WP-507).
 *
 * `pdf-text.ts` decides, string by string, what Helvetica can't print; this file supplies the rest:
 *
 *   - **Noto Sans** (Latin, Greek, Cyrillic) as TrueType, for jsPDF to embed as real, selectable
 *     text. jsPDF writes only the glyphs a document uses, so the file size of a PDF stays small.
 *   - **A canvas text renderer** for scripts jsPDF can't lay out. jsPDF maps one character to one
 *     glyph and has no shaping engine, so Devanagari conjuncts, Tamil vowel signs and joined,
 *     right-to-left Arabic print broken even with the right font embedded. The browser shapes them
 *     correctly; the string is drawn onto a canvas and placed in the PDF as an image. It uses a
 *     self-hosted Noto face for the script when we ship one (below), else the system's fonts — which
 *     is also how CJK prints: those fonts run to megabytes, so we don't ship them.
 *
 * Every file is self-hosted under `public/fonts/` (see the README there) — never a third-party CDN,
 * because an export must not tell anyone whose names are in it.
 *
 * Nothing here throws. A font that fails to load (offline, 404, a timeout) comes back `null`, a
 * failed load is forgotten so the next export retries it, and the caller falls back.
 */

/** Served from `public/fonts/`. */
const FONT_DIR = "/fonts/";
/** A font that hasn't arrived by then counts as unavailable; the export goes on without it. */
const LOAD_TIMEOUT_MS = 10_000;

export type LatinWeight = "normal" | "bold";

/** Noto Sans, registered in each jsPDF document that needs it under `family`. */
export const LATIN_FONT = {
  family: "WPNotoSans",
  files: { normal: "NotoSans-Regular.ttf", bold: "NotoSans-Bold.ttf" } as Record<LatinWeight, string>,
};

interface ScriptFace {
  id: string;
  file: string;
  /** Code points that mean "this string wants this face". */
  blocks: readonly (readonly [number, number])[];
  /**
   * What the face may draw — Google Fonts' `unicode-range` for the script's own subset, so the
   * Latin part of a mixed string keeps the Helvetica look of the rest of the page.
   */
  unicodeRange: string;
}

/**
 * The shaped scripts we self-host a face for. Anything else that needs shaping (Khmer, Myanmar, …)
 * and CJK still prints through the canvas, in whatever font the system has for it.
 */
const SCRIPT_FACES: readonly ScriptFace[] = [
  {
    id: "devanagari",
    file: "NotoSansDevanagari-Regular.woff2",
    blocks: [[0x0900, 0x097f], [0x1cd0, 0x1cff], [0xa8e0, 0xa8ff], [0x11b00, 0x11b5f]],
    unicodeRange:
      "U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A",
  },
  {
    id: "bengali",
    file: "NotoSansBengali-Regular.woff2",
    blocks: [[0x0980, 0x09ff]],
    unicodeRange:
      "U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0, U+1CD2, U+1CD5-1CD6, U+1CD8, U+1CE1, U+1CEA, U+1CED, U+1CF2, U+1CF5-1CF7, U+200C-200D, U+20B9, U+25CC, U+A8F1, U+11DF0-11DF1",
  },
  {
    id: "gurmukhi",
    file: "NotoSansGurmukhi-Regular.woff2",
    blocks: [[0x0a00, 0x0a7f]],
    unicodeRange: "U+0951-0952, U+0964-0965, U+0A01-0A76, U+200C-200D, U+20B9, U+25CC, U+262C, U+A830-A839",
  },
  {
    id: "gujarati",
    file: "NotoSansGujarati-Regular.woff2",
    blocks: [[0x0a80, 0x0aff]],
    unicodeRange: "U+0951-0952, U+0964-0965, U+0A80-0AFF, U+200C-200D, U+20B9, U+25CC, U+A830-A839",
  },
  {
    id: "oriya",
    file: "NotoSansOriya-Regular.woff2",
    blocks: [[0x0b00, 0x0b7f]],
    unicodeRange: "U+0951-0952, U+0964-0965, U+0B01-0B77, U+1CDA, U+1CF2, U+200C-200D, U+20B9, U+25CC",
  },
  {
    id: "tamil",
    file: "NotoSansTamil-Regular.woff2",
    blocks: [[0x0b80, 0x0bff], [0x11fc0, 0x11fff]],
    unicodeRange: "U+0964-0965, U+0B82-0BFA, U+200C-200D, U+20B9, U+25CC",
  },
  {
    id: "telugu",
    file: "NotoSansTelugu-Regular.woff2",
    blocks: [[0x0c00, 0x0c7f]],
    unicodeRange:
      "U+0951-0952, U+0964-0965, U+0B83, U+0C00-0C7F, U+1CD5-1CD6, U+1CD8, U+1CDA, U+1CF2, U+200C-200D, U+25CC",
  },
  {
    id: "kannada",
    file: "NotoSansKannada-Regular.woff2",
    blocks: [[0x0c80, 0x0cff]],
    unicodeRange:
      "U+0951-0952, U+0964-0965, U+0B83, U+0C80-0CF3, U+1CD0, U+1CD2-1CD3, U+1CDA, U+1CF2, U+1CF4, U+200C-200D, U+20B9, U+25CC, U+A830-A835",
  },
  {
    id: "malayalam",
    file: "NotoSansMalayalam-Regular.woff2",
    blocks: [[0x0d00, 0x0d7f]],
    unicodeRange:
      "U+0307, U+0323, U+0951-0952, U+0964-0965, U+0B83, U+0D00-0D7F, U+1CDA, U+1CF2, U+200C-200D, U+20B9, U+25CC, U+A830-A832",
  },
  {
    id: "sinhala",
    file: "NotoSansSinhala-Regular.woff2",
    blocks: [[0x0d80, 0x0dff], [0x111e0, 0x111ff]],
    unicodeRange: "U+0964-0965, U+0D81-0DF4, U+1CF2, U+200C-200D, U+25CC, U+111E1-111F4",
  },
  {
    id: "thai",
    file: "NotoSansThai-Regular.woff2",
    blocks: [[0x0e00, 0x0e7f]],
    unicodeRange: "U+02D7, U+0303, U+0331, U+0E01-0E5B, U+200C-200D, U+25CC",
  },
  {
    id: "hebrew",
    file: "NotoSansHebrew-Regular.woff2",
    blocks: [[0x0590, 0x05ff], [0xfb1d, 0xfb4f]],
    unicodeRange: "U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F",
  },
  {
    id: "arabic",
    file: "NotoSansArabic-Regular.woff2",
    blocks: [[0x0600, 0x06ff], [0x0750, 0x077f], [0x0870, 0x08ff], [0xfb50, 0xfdff], [0xfe70, 0xfeff]],
    unicodeRange:
      "U+0600-06FF, U+0750-077F, U+0870-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC",
  },
];

/** The self-hosted script faces `text` would draw with, by id (e.g. `["tamil"]`). */
export function scriptsIn(text: string): string[] {
  const codes = Array.from(text, (ch) => ch.codePointAt(0) ?? 0);
  return SCRIPT_FACES.filter((face) =>
    codes.some((c) => face.blocks.some(([lo, hi]) => c >= lo && c <= hi)),
  ).map((face) => face.id);
}

// ── loading ──────────────────────────────────────────────────────────────────────────────────

/** One fetch per font per session. A failed load is dropped from the cache, so the next export retries. */
const latinCache = new Map<LatinWeight, Promise<string | null>>();
const faceCache = new Map<string, Promise<string | null>>();

function cached<K>(
  cache: Map<K, Promise<string | null>>,
  key: K,
  load: () => Promise<string | null>,
): Promise<string | null> {
  let pending = cache.get(key);
  if (!pending) {
    pending = load()
      .catch(() => null)
      .then((value) => {
        if (value === null) cache.delete(key);
        return value;
      });
    cache.set(key, pending);
  }
  return pending;
}

async function fetchFont(file: string): Promise<ArrayBuffer | null> {
  if (typeof fetch !== "function") return null;
  const abort = typeof AbortController === "function" ? new AbortController() : undefined;
  const timer = setTimeout(() => abort?.abort(), LOAD_TIMEOUT_MS);
  try {
    const res = await fetch(FONT_DIR + file, { signal: abort?.signal });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Noto Sans as the binary string jsPDF's virtual file system takes, or null. */
function loadLatin(weight: LatinWeight): Promise<string | null> {
  return cached(latinCache, weight, async () => {
    const buffer = await fetchFont(LATIN_FONT.files[weight]);
    if (!buffer) return null;
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    // jsPDF recognises TrueType by this signature; anything else (an HTML error page served with a
    // 200, say) must not reach its parser.
    return binary.startsWith("\x00\x01\x00\x00") ? binary : null;
  });
}

/** Registers the script's face with the page's font set; resolves to its family name, or null. */
function loadFace(face: ScriptFace): Promise<string | null> {
  return cached(faceCache, face.id, async () => {
    if (typeof FontFace !== "function" || typeof document === "undefined" || !document.fonts) {
      return null;
    }
    const buffer = await fetchFont(face.file);
    if (!buffer) return null;
    const family = `WP Noto ${face.id}`;
    const font = new FontFace(family, buffer, { unicodeRange: face.unicodeRange });
    await font.load();
    document.fonts.add(font);
    return family;
  });
}

export interface FontNeeds {
  /** Noto Sans weights some Latin/Greek/Cyrillic string is set in. */
  latin: Set<LatinWeight>;
  /** Script faces (by id) the shaped strings want. */
  scripts: Set<string>;
}

export interface LoadedFonts {
  /** Noto Sans per weight, ready for `addFileToVFS`; a weight is absent if unneeded or unloadable. */
  latin: Partial<Record<LatinWeight, string>>;
  /** The canvas text renderer, created on first use; null where the browser can't provide one. */
  rasterizer(): Rasterizer | null;
}

/** Everything `needs` asks for, in parallel. Never rejects: what fails to load is simply absent. */
export async function loadFonts(needs: FontNeeds): Promise<LoadedFonts> {
  const weights = [...needs.latin];
  const faces = SCRIPT_FACES.filter((face) => needs.scripts.has(face.id));
  const [files, families] = await Promise.all([
    Promise.all(weights.map(loadLatin)),
    Promise.all(faces.map(loadFace)),
  ]);

  const latin: Partial<Record<LatinWeight, string>> = {};
  weights.forEach((weight, i) => {
    const file = files[i];
    if (file) latin[weight] = file;
  });
  const loaded = new Map<string, string>();
  faces.forEach((face, i) => {
    const family = families[i];
    if (family) loaded.set(face.id, family);
  });

  let rasterizer: Rasterizer | null | undefined;
  return {
    latin,
    rasterizer() {
      if (rasterizer === undefined) {
        try {
          rasterizer = createRasterizer(loaded);
        } catch {
          rasterizer = null;
        }
      }
      return rasterizer;
    },
  };
}

// ── drawing text the browser shapes ──────────────────────────────────────────────────────────

/** Canvas pixels per PDF point: 4 is ~288 dpi — sharp on paper and at 200% zoom. */
const PX_PER_PT = 4;
/** Browsers refuse larger canvases; a longer line is drawn at a lower resolution instead. */
const MAX_CANVAS_PX = 16_384;

export interface TextFont {
  sizePt: number;
  bold: boolean;
  italic: boolean;
}

/** A line of text as a PNG. Every length is in PDF points. */
export interface Raster {
  png: Uint8Array;
  width: number;
  height: number;
  /** Where the pen starts: `left` in from the image's left edge, on a baseline `ascent` below its top. */
  left: number;
  ascent: number;
  /** Advance width — what alignment and truncation measure. */
  advance: number;
}

export interface Rasterizer {
  /** Advance width of `text`, in points. */
  measure(text: string, font: TextFont): number;
  /** `text` drawn in `color` (`#rrggbb`), or null if the canvas couldn't produce it. */
  draw(text: string, font: TextFont, color: string): Raster | null;
}

const finite = (value: number | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Whether pixels can be read back. Anti-fingerprinting modes blank or randomise canvas reads; text
 * drawn that way would print as an empty box or noise, so such a browser gets no rasterizer and the
 * caller falls back to the WinAnsi sanitiser instead.
 */
function readsBack(ctx: CanvasRenderingContext2D): boolean {
  try {
    ctx.canvas.width = 4;
    ctx.canvas.height = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 2, 1);
    const px = ctx.getImageData(0, 0, 4, 1).data;
    return px[3] > 200 && px[15] < 50;
  } catch {
    return false;
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** Emoji keep the colours the browser draws them in; all other text is one colour. */
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

/**
 * The canvas as a PNG: its coverage (alpha) in the solid colour `rgb`, or — for `rgb` null, i.e.
 * emoji — with the colours it was drawn in.
 *
 * Not `canvas.toDataURL()`: a canvas stores premultiplied colour, so its transparent pixels read
 * back black and its edges as rounding noise — a colour channel as busy as the mask, which doubled
 * every image and left dark fringes on white text. Text is one colour; only the coverage varies.
 * The pixels go in uncompressed (stored deflate blocks) because jsPDF decodes the PNG and deflates
 * it again itself, where a constant colour costs almost nothing.
 */
function textPng(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  rgb: readonly number[] | null,
): Uint8Array {
  const row = 1 + width * 4;
  const raw = new Uint8Array(row * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = y * row + 1 + x * 4;
      const i = (y * width + x) * 4;
      raw[o] = rgb ? rgb[0] : rgba[i];
      raw[o + 1] = rgb ? rgb[1] : rgba[i + 1];
      raw[o + 2] = rgb ? rgb[2] : rgba[i + 2];
      raw[o + 3] = rgba[i + 3];
    }
  }
  const blocks = Math.max(1, Math.ceil(raw.length / 0xffff));
  const zlib = new Uint8Array(2 + blocks * 5 + raw.length + 4);
  zlib.set([0x78, 0x01]);
  let p = 2;
  for (let i = 0; i < blocks; i++) {
    const len = Math.min(0xffff, raw.length - i * 0xffff);
    zlib.set([i === blocks - 1 ? 1 : 0, len & 0xff, len >>> 8, ~len & 0xff, (~len >>> 8) & 0xff], p);
    zlib.set(raw.subarray(i * 0xffff, i * 0xffff + len), p + 5);
    p += 5 + len;
  }
  let a = 1;
  let b = 0;
  for (let i = 0; i < raw.length; i++) {
    a = (a + raw[i]) % 65521;
    b = (b + a) % 65521;
  }
  new DataView(zlib.buffer).setUint32(p, ((b << 16) | a) >>> 0);

  const ihdr = new Uint8Array(13);
  const header = new DataView(ihdr.buffer);
  header.setUint32(0, width);
  header.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA, deflate, adaptive filtering, no interlace
  const chunks: [string, Uint8Array][] = [["IHDR", ihdr], ["IDAT", zlib], ["IEND", new Uint8Array(0)]];
  const png = new Uint8Array(8 + chunks.reduce((n, [, data]) => n + 12 + data.length, 0));
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(png.buffer);
  let q = 8;
  for (const [type, data] of chunks) {
    view.setUint32(q, data.length);
    for (let i = 0; i < 4; i++) png[q + 4 + i] = type.charCodeAt(i);
    png.set(data, q + 8);
    let crc = 0xffffffff;
    for (let i = q + 4; i < q + 8 + data.length; i++) crc = CRC_TABLE[(crc ^ png[i]) & 0xff] ^ (crc >>> 8);
    view.setUint32(q + 8 + data.length, (crc ^ 0xffffffff) >>> 0);
    q += 12 + data.length;
  }
  return png;
}

/** `#rrggbb` (what jsPDF's `getTextColor` returns) as [r, g, b]; black if unparseable. */
function rgbOf(color: string): number[] {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** @param faces loaded self-hosted families by script id */
function createRasterizer(faces: Map<string, string>): Rasterizer | null {
  if (typeof document === "undefined") return null;
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe || !readsBack(probe)) return null;
  const ctx = probe;

  const cssFont = (text: string, font: TextFont, pxPerPt: number) => {
    const own = scriptsIn(text).flatMap((id) => {
      const family = faces.get(id);
      return family ? [`"${family}"`] : [];
    });
    // Helvetica, then its metric twin Arial, keeps the Latin part of a mixed string matching the
    // standard font around it; the generic family lets the browser find anything else (CJK, emoji).
    const families = [...own, "Helvetica", "Arial", "sans-serif"].join(", ");
    return `${font.italic ? "italic " : ""}${font.bold ? "bold " : ""}${font.sizePt * pxPerPt}px ${families}`;
  };

  const metrics = (text: string, font: TextFont, pxPerPt: number) => {
    ctx.font = cssFont(text, font, pxPerPt);
    // Left-to-right base, as the app's own (LTR) pages lay the same string out: Arabic and Hebrew
    // still run right to left within it, and a mixed "محمد (Sales)" reads as it does on screen.
    ctx.direction = "ltr";
    return ctx.measureText(text);
  };

  return {
    measure: (text, font) => metrics(text, font, PX_PER_PT).width / PX_PER_PT,

    draw(text, font, color) {
      let scale = PX_PER_PT;
      let m = metrics(text, font, scale);
      const span = m.width + 2 * font.sizePt * scale;
      if (span > MAX_CANVAS_PX) {
        scale *= MAX_CANVAS_PX / span;
        m = metrics(text, font, scale);
      }
      const em = font.sizePt * scale;
      const pad = Math.ceil(em / 8);
      // The ink box, padded for anti-aliasing: marks may overhang the advance box (a Devanagari
      // i-matra to the left, an italic to the right) and reach well above or below the baseline.
      const left = Math.ceil(Math.max(0, finite(m.actualBoundingBoxLeft, 0))) + pad;
      const right = Math.ceil(Math.max(m.width, finite(m.actualBoundingBoxRight, m.width))) + pad;
      const ascent = Math.ceil(Math.max(0, finite(m.actualBoundingBoxAscent, em))) + pad;
      const descent = Math.ceil(Math.max(0, finite(m.actualBoundingBoxDescent, em * 0.4))) + pad;

      try {
        const canvas = document.createElement("canvas");
        canvas.width = left + right;
        canvas.height = ascent + descent;
        const out = canvas.getContext("2d");
        if (!out) return null;
        out.font = ctx.font;
        out.direction = ctx.direction;
        out.textAlign = "left";
        out.textBaseline = "alphabetic";
        out.fillStyle = color;
        out.fillText(text, left, ascent);
        const { data } = out.getImageData(0, 0, canvas.width, canvas.height);
        const rgb = PICTOGRAPHIC.test(text) ? null : rgbOf(color);
        return {
          png: textPng(data, canvas.width, canvas.height, rgb),
          width: canvas.width / scale,
          height: canvas.height / scale,
          left: left / scale,
          ascent: ascent / scale,
          advance: m.width / scale,
        };
      } catch {
        // One string the canvas can't take (out of memory, say) falls back on its own; the rest of
        // the document keeps its fonts.
        return null;
      }
    },
  };
}

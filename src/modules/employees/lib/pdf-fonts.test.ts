import { readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { jsPDF } from "jspdf";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PdfText, PdfTextFor } from "./pdf-text";

/**
 * WP-225 / WP-507: PDF exports load a Unicode font only when their text needs one, and never fail
 * because of it. These run the real loader and writer against jsPDF; the fonts are the real files
 * in `public/fonts/`, served by a stubbed `fetch`. jsdom has no canvas, so the shaped-script path
 * runs against a small fake 2D context.
 */

let buildPdf: typeof import("./pdf-text").buildPdf;

beforeEach(async () => {
  // A fresh module per test: the font cache lives for the session.
  vi.resetModules();
  ({ buildPdf } = await import("./pdf-text"));
  // jsdom has no canvas; its stub logs an error on every call, so stand in for it quietly.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const PUBLIC = path.join(process.cwd(), "public");

/** `fetch` serving `/fonts/*` from `public/`, as Next.js does. */
function serveFonts() {
  const fetch = vi.fn(async (url: string) => new Response(new Uint8Array(readFileSync(path.join(PUBLIC, url)))));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

/** A builder printing each string on its own line, in the given font style. */
function lines(strings: string[], style = "normal", draw?: (t: PdfText, doc: jsPDF) => void) {
  return vi.fn((text: PdfTextFor) => {
    const doc = new jsPDF();
    const t = text(doc);
    doc.setFont("helvetica", style).setFontSize(10);
    strings.forEach((s, i) => t.text(s, 20, 30 + i * 10));
    draw?.(t, doc);
    return doc;
  });
}

/** ToUnicode entry for a code point: proof the text is real, extractable text in the embedded font. */
const mapsTo = (cp: number) => new RegExp(`<[0-9a-f]{4}><${cp.toString(16).padStart(4, "0")}>`);

describe("buildPdf — Latin, Greek, Cyrillic as embedded Noto Sans", () => {
  it("renders once and fetches nothing when Helvetica can print every string", async () => {
    const fetch = serveFonts();
    const build = lines(["Priya Nair", "Zoë Müller — 5 € “ok”", "9:30 AM"]);

    const doc = await buildPdf(build);

    expect(build).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(doc.output()).toContain("(9:30 AM)");
  });

  it("writes a Latin-only document byte for byte as plain jsPDF does", async () => {
    const draw = (put: (s: string, y: number, options?: { align: "right" }) => void) => {
      put("Priya Nair", 30);
      put("Zoë Müller — 5 € “ok” …", 40);
      put("Page 1 of 1", 280, { align: "right" });
    };
    const pinned = () =>
      new jsPDF().setCreationDate(new Date(0)).setFileId("00000000000000000000000000000000");

    const viaWriter = await buildPdf((text) => {
      const doc = pinned();
      const t = text(doc);
      draw((s, y, options) => t.text(s, 20, y, options));
      return doc;
    });
    const direct = pinned();
    draw((s, y, options) => (options ? direct.text(s, 20, y, options) : direct.text(s, 20, y)));

    expect(viaWriter.output()).toBe(direct.output());
  });

  it("gives a document one writer, however often it's attached", async () => {
    await buildPdf((text) => {
      const doc = new jsPDF();
      expect(text(doc)).toBe(text(doc));
      return doc;
    });
  });

  it("embeds Noto Sans for Polish, Greek and Cyrillic names — as real, selectable text", async () => {
    const fetch = serveFonts();
    const build = lines(["Łukasz Żółć", "Ελένη", "Дмитрий", "Priya Nair"]);

    const pdf = (await buildPdf(build)).output();

    expect(build).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/fonts/NotoSans-Regular.ttf", expect.anything());
    expect(pdf).toContain("/BaseFont /WPNotoSans");
    expect(pdf).toContain("/Encoding /Identity-H");
    for (const cp of [0x0141, 0x017b, 0x0395, 0x03ad, 0x0414]) expect(pdf).toMatch(mapsTo(cp)); // Ł Ż Ε έ Д
    // Not sanitised, and the Latin-1 name stays in Helvetica.
    expect(pdf).not.toContain("(Lukasz");
    expect(pdf).toContain("(Priya Nair)");
  });

  it("fetches the bold cut only for text set in bold", async () => {
    const fetch = serveFonts();
    await buildPdf(lines(["Łukasz Żółć"], "bold"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/fonts/NotoSans-Bold.ttf", expect.anything());
  });

  it("measures and truncates on the embedded font, and hands the document its own font back", async () => {
    serveFonts();
    let fitted = "";
    let after = { fontName: "", fontStyle: "" };
    await buildPdf(
      lines(["Łukasz Żółć"], "bold", (t, doc) => {
        fitted = t.fit("Łukasz Żółć-Wiśniewska", t.width("Łukasz Żółć"));
        after = doc.getFont();
      }),
    );
    expect(fitted).toMatch(/^Łukasz .+…$/);
    expect(fitted.length).toBeLessThan("Łukasz Żółć-Wiśniewska".length);
    expect(after).toMatchObject({ fontName: "helvetica", fontStyle: "bold" });
  });
});

describe("buildPdf — never fails the export", () => {
  it("falls back to the sanitiser when the font can't be fetched (offline)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const pdf = (await buildPdf(lines(["Łukasz Żółć", "Kavin முருகன்"]))).output();

    expect(pdf).toContain("(Lukasz Zólc)");
    expect(pdf).toContain("(Kavin ???????)");
    expect(pdf).not.toContain("WPNotoSans");
  });

  it("ignores a response that isn't a TrueType file (an error page served with 200)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!doctype html><title>Not found</title>")));
    const pdf = (await buildPdf(lines(["Дмитрий"]))).output();
    expect(pdf).toContain("(???????)");
    expect(pdf).not.toContain("WPNotoSans");
  });

  it("retries a font that failed, on the next export", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect((await buildPdf(lines(["Ελένη"]))).output()).not.toContain("WPNotoSans");

    serveFonts();
    expect((await buildPdf(lines(["Ελένη"]))).output()).toContain("/BaseFont /WPNotoSans");
  });

  it("returns the sanitised first pass if the second one throws", async () => {
    serveFonts();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = lines(["Łukasz Żółć"]);
    let calls = 0;
    const doc = await buildPdf((text) => {
      calls += 1;
      if (calls === 2) throw new Error("boom");
      return first(text);
    });
    expect(calls).toBe(2);
    expect(doc.output()).toContain("(Lukasz Zólc)");
  });
});

// ── shaped scripts ───────────────────────────────────────────────────────────────────────────

interface Drawn {
  text: string;
  font: string;
  x: number;
  y: number;
  fill: string;
}

/**
 * A fake 2D context: every UTF-16 unit is half an em wide, ink rises 0.8 em and falls 0.3 em, and
 * reading pixels back finds only the first one inked. `readable: false` mimics anti-fingerprinting,
 * which blanks pixel reads.
 */
function fakeCanvas({ readable = true } = {}) {
  const drawn: Drawn[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    const px = (font: string) => Number(/([\d.]+)px/.exec(font)?.[1] ?? 10);
    const ctx = {
      canvas: this,
      font: "10px sans-serif",
      direction: "inherit",
      textAlign: "start",
      textBaseline: "alphabetic",
      fillStyle: "#000000",
      fillRect() {},
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => (readable && i === 3 ? 255 : 0)),
      }),
      measureText(text: string) {
        const em = px(ctx.font);
        return {
          width: text.length * em * 0.5,
          actualBoundingBoxLeft: 0,
          actualBoundingBoxRight: text.length * em * 0.5,
          actualBoundingBoxAscent: em * 0.8,
          actualBoundingBoxDescent: em * 0.3,
        };
      },
      fillText(text: string, x: number, y: number) {
        drawn.push({ text, font: ctx.font, x, y, fill: ctx.fillStyle });
      },
    };
    return ctx as unknown as CanvasRenderingContext2D;
  } as unknown as HTMLCanvasElement["getContext"]);
  return drawn;
}

/** Every image placement in the content stream, in points: [width, height, x, y-from-bottom]. */
const placements = (pdf: string) =>
  [...pdf.matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\n\/I\d+ Do/g)].map((m) =>
    m.slice(1, 5).map(Number),
  );

const K = 72 / 25.4; // points per mm
const PAGE_H = 297 * K;

describe("buildPdf — scripts that need shaping, drawn by the browser", () => {
  it("draws the string on a canvas and places it on the text baseline", async () => {
    const drawn = fakeCanvas();
    const fetch = serveFonts();

    const pdf = (await buildPdf(lines(["प्रिया शर्मा"]))).output();

    // The browser drew the real string — shaping is its job — at 4 px per point.
    expect(drawn).toHaveLength(1);
    expect(drawn[0].text).toBe("प्रिया शर्मा");
    expect(drawn[0].font).toMatch(/^40px .*sans-serif$/);
    // jsdom has no FontFace, so no script face was fetched; the system font draws it.
    expect(fetch).not.toHaveBeenCalled();
    expect(pdf).not.toContain("(????");

    // 12 units × 20 px advance = 240 px; 5 px padding; ink 32 px up, 12 px down.
    const [[w, h, x, y]] = placements(pdf);
    expect(w).toBeCloseTo(250 / 4, 1);
    expect(h).toBeCloseTo(54 / 4, 1);
    expect(x).toBeCloseTo(20 * K - 5 / 4, 1);
    // The baseline (37 px below the image's top) sits exactly at y = 30 mm.
    expect(y).toBeCloseTo(PAGE_H - (30 * K - 37 / 4 + 54 / 4), 1);
  });

  it("right-aligns by the advance width, and embeds repeated text once", async () => {
    fakeCanvas();
    const pdf = (
      await buildPdf(
        lines([], "normal", (t) => {
          t.text("முருகன்", 190, 30, { align: "right" });
          t.text("முருகன்", 190, 40, { align: "right" });
        }),
      )
    ).output();

    const spots = placements(pdf);
    expect(spots).toHaveLength(2);
    // 7 units × 5 pt = 35 pt of advance, ending at x = 190 mm.
    expect(spots[0][2]).toBeCloseTo(190 * K - 35 - 5 / 4, 1);
    // One image (plus its soft mask), drawn twice.
    expect(pdf.match(/\/Subtype \/Image/g)).toHaveLength(2);
  });

  /** Draws `s` in indigo and returns the text colour and every pixel of the PNG handed to jsPDF. */
  async function rasterOf(s: string) {
    fakeCanvas();
    const api = jsPDF.API as unknown as { addImage: (...args: unknown[]) => unknown };
    const addImage = vi.spyOn(api, "addImage");
    let colour = "";
    await buildPdf(
      lines([], "normal", (t, doc) => {
        doc.setTextColor(79, 70, 229);
        colour = doc.getTextColor();
        t.text(s, 20, 30);
      }),
    );
    const png = addImage.mock.calls[0][0] as Uint8Array;
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const [width, height] = [view.getUint32(16), view.getUint32(20)];
    const raw = inflateSync(png.subarray(41, 41 + view.getUint32(33)));
    expect(raw.length).toBe(height * (1 + width * 4));
    const pixels = Array.from({ length: width * height }, (_, i) => {
      const o = Math.floor(i / width) * (1 + width * 4) + 1 + (i % width) * 4;
      return [raw[o], raw[o + 1], raw[o + 2], raw[o + 3]];
    });
    return { rgb: [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16)), pixels };
  }

  it("hands jsPDF a valid PNG: the text colour everywhere, the ink in its alpha", async () => {
    const { rgb, pixels } = await rasterOf("محمد");
    expect(pixels.every(([r, g, b]) => r === rgb[0] && g === rgb[1] && b === rgb[2])).toBe(true);
    // The fake canvas inks only its first pixel.
    expect(pixels[0][3]).toBe(255);
    expect(pixels.slice(1).every(([, , , a]) => a === 0)).toBe(true);
  });

  it("keeps an emoji's own colours instead of flattening it to the text colour", async () => {
    // The fake canvas reads back black where it inked; a colour emoji must keep what was drawn.
    const { pixels } = await rasterOf("🚀 Launch");
    expect(pixels[0]).toEqual([0, 0, 0, 255]);
  });

  it("truncates between graphemes, measured as the browser will draw it", async () => {
    fakeCanvas();
    let fitted = "";
    await buildPdf(
      lines(["प्रिया शर्मा"], "normal", (t) => {
        fitted = t.fit("प्रिया शर्मा", t.width("प्रिया…"));
      }),
    );
    expect(fitted).toBe("प्रिया…");
  });

  it("falls back to the sanitiser when the canvas can't be read back", async () => {
    fakeCanvas({ readable: false });
    const pdf = (await buildPdf(lines(["محمد"]))).output();
    expect(placements(pdf)).toHaveLength(0);
    expect(pdf).toContain("(????)");
  });
});

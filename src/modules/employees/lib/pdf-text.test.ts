import { describe, expect, it } from "vitest";
import { graphemes, pdfText, textRoute } from "./pdf-text";
import { scriptsIn } from "./pdf-fonts";

/**
 * WP-225 (QA audit 2026-10-08): one character outside WinAnsi made jsPDF write the whole string as
 * two bytes per character, which the standard fonts print as garbage.
 */
describe("pdfText", () => {
  it("keeps what WinAnsi carries, including its typographic extras", () => {
    expect(pdfText("Priya Nair — 5 · 3 … 10 € “ok” – ü")).toBe("Priya Nair — 5 · 3 … 10 € “ok” – ü");
  });

  it("replaces only the characters it can't encode", () => {
    expect(pdfText("2026-01-01 → 2026-10-08")).toBe("2026-01-01 - 2026-10-08");
    // Ł/ł have no decomposition (mapped), Ż/ć fold to their base letter, ó is Latin-1 and stays.
    expect(pdfText("Łukasz Żółć")).toBe("Lukasz Zólc");
    expect(pdfText("Kavin தமிழ்")).toBe("Kavin ?????");
  });

  it("swaps exact stand-ins without losing anything", () => {
    // Browsers put U+202F before AM/PM; a zero-width space and a non-breaking hyphen look the same.
    expect(pdfText("9:30 AM")).toBe("9:30 AM");
    expect(pdfText("co​op")).toBe("coop");
    expect(pdfText("e‑mail − 5")).toBe("e-mail - 5");
  });

  it("composes first: e + a combining acute is é, not e?", () => {
    expect(pdfText("Renée")).toBe("Renée");
  });
});

describe("textRoute — which path a string takes onto the page", () => {
  it("keeps WinAnsi text (and its exact stand-ins) on the built-in Helvetica", () => {
    for (const s of ["Priya Nair", "Zoë Müller — 5 € “ok” …", "9:30 AM", "Renée", ""]) {
      expect(textRoute(s), s).toBe("standard");
    }
  });

  it("sends Latin, Greek and Cyrillic beyond WinAnsi to the embedded Noto Sans", () => {
    for (const s of ["Łukasz Żółć", "Ελένη", "Дмитрий", "Nguyễn Văn Thảo", "₹1,200", "№ 5"]) {
      expect(textRoute(s), s).toBe("font");
    }
  });

  it("sends scripts that need shaping — and CJK, emoji, arrows — to the canvas", () => {
    for (const s of [
      "प्रिया शर्मा",
      "முருகன்",
      "సాయి",
      "محمد",
      "שרה",
      "สมชาย",
      "李小龍",
      "Kavin தமிழ்",
      "🚀 Launch",
      "Login → Dashboard",
      // A mark NFC can't compose onto its letter: jsPDF can't position it, the browser can.
      "x̂",
    ]) {
      expect(textRoute(s), s).toBe("raster");
    }
  });
});

describe("scriptsIn — which self-hosted face a shaped string loads", () => {
  it("names the face for each script present", () => {
    expect(scriptsIn("प्रिया शर्मा")).toEqual(["devanagari"]);
    expect(scriptsIn("முருகன்")).toEqual(["tamil"]);
    expect(scriptsIn("సాయి")).toEqual(["telugu"]);
    expect(scriptsIn("محمد")).toEqual(["arabic"]);
    expect(scriptsIn("Kavin தமிழ் / ಕನ್ನಡ")).toEqual(["tamil", "kannada"]);
  });

  it("names none for CJK (system fonts) or Latin (Noto Sans or Helvetica)", () => {
    expect(scriptsIn("李小龍")).toEqual([]);
    expect(scriptsIn("Łukasz")).toEqual([]);
  });
});

describe("graphemes", () => {
  it("never splits a conjunct or strands a vowel sign", () => {
    const parts = graphemes("प्रिया शर्मा");
    expect(parts.join("")).toBe("प्रिया शर्मा");
    for (const p of parts) expect(p).not.toMatch(/^\p{M}/u);
    expect(parts.length).toBeLessThan([..."प्रिया शर्मा"].length);
  });

  it("keeps an emoji sequence whole", () => {
    expect(graphemes("👩‍💻 ok")).toEqual(["👩‍💻", " ", "o", "k"]);
  });
});

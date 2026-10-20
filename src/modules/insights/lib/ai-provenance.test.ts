import { describe, expect, it } from "vitest";
import {
  dailyReportProvenance,
  deptSummaryProvenance,
  formatGeneratedAt,
  provenanceLine,
  screenshotSummaryProvenance,
} from "./ai-provenance";

const OCT_16 = new Date(2026, 9, 16, 14, 5).getTime();

/**
 * MON-08 / XC-08: AI branding only on text a model wrote; a template fallback says it isn't AI;
 * where the payload can't tell, the card claims neither.
 */
describe("dailyReportProvenance", () => {
  it("calls the fixed line for an unscored day what it is — not AI", () => {
    const p = dailyReportProvenance({
      narrative: "No activity reported yet today — no productivity score to show.",
      generated_at: OCT_16,
      metrics: { scored_people: 0 },
    });
    expect(p.kind).toBe("computed");
  });

  it("brands a scored day's narrative as AI, with when it was written", () => {
    const p = dailyReportProvenance({
      narrative: "The team averaged 72…",
      generated_at: OCT_16,
      metrics: { scored_people: 4 },
    });
    expect(p).toEqual({ kind: "ai", generatedAt: OCT_16 });
  });

  it("treats an empty narrative with a reason as nothing generated", () => {
    expect(dailyReportProvenance({ narrative: "", reason: "no dailies yet" }).kind).toBe("computed");
  });
});

describe("dept / screenshot summaries", () => {
  it("know the template when nobody was scored or nothing was analysed", () => {
    expect(deptSummaryProvenance({ generated_at: OCT_16, metrics: { scored_people: 0 } }).kind).toBe(
      "computed",
    );
    expect(screenshotSummaryProvenance({ generated_at: OCT_16, metrics: { frames: 0 } }).kind).toBe(
      "computed",
    );
  });

  it("otherwise claim neither — the payload can't tell model from fallback", () => {
    expect(deptSummaryProvenance({ generated_at: OCT_16, metrics: { scored_people: 3 } }).kind).toBe(
      "unknown",
    );
    expect(screenshotSummaryProvenance({ generated_at: OCT_16, metrics: { frames: 12 } }).kind).toBe(
      "unknown",
    );
  });
});

describe("provenanceLine", () => {
  it("says AI-generated, when, and that it may be wrong", () => {
    const line = provenanceLine({ kind: "ai", generatedAt: OCT_16 });
    expect(line).toMatch(/^AI-generated · .+ · may be wrong$/);
    expect(line).toContain("16");
  });

  it("names the model only when the payload does", () => {
    expect(provenanceLine({ kind: "ai", generatedAt: null, model: "m-1" })).toBe(
      "AI-generated · m-1 · may be wrong",
    );
    expect(provenanceLine({ kind: "ai", generatedAt: null })).toBe("AI-generated · may be wrong");
  });

  it("never brands a template as AI", () => {
    expect(provenanceLine({ kind: "computed" })).toBe("Summary of the figures · not written by AI");
  });

  it("is honest about not knowing", () => {
    expect(provenanceLine({ kind: "unknown", generatedAt: null })).toBe(
      "Usually written by AI, which can be wrong",
    );
  });

  it("has nothing to say before there is text", () => {
    expect(provenanceLine({ kind: "none" })).toBe("");
  });
});

describe("formatGeneratedAt", () => {
  it("reads epoch milliseconds and drops the 0 the DTOs send for 'absent'", () => {
    expect(formatGeneratedAt(OCT_16)).not.toBeNull();
    expect(formatGeneratedAt(0)).toBeNull();
    expect(formatGeneratedAt(null)).toBeNull();
    expect(formatGeneratedAt(Number.NaN)).toBeNull();
  });
});

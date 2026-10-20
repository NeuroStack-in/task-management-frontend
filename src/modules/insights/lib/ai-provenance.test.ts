import { describe, expect, it } from "vitest";
import {
  dailyReportProvenance,
  deptSummaryProvenance,
  formatGeneratedAt,
  fromServer,
  locationSummaryProvenance,
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

/** The server's own `ai_generated` / `model` (2026-10-20) — preferred over any inference. */
describe("fromServer", () => {
  it("names the model and the time on text a model wrote", () => {
    const p = fromServer({ ai_generated: true, model: "openai/gpt-oss-20b", generated_at: OCT_16 });
    expect(p).toEqual({ kind: "ai", generatedAt: OCT_16, model: "openai/gpt-oss-20b" });
    expect(provenanceLine(p!)).toMatch(/^AI-generated · openai\/gpt-oss-20b · .+ · may be wrong$/);
  });

  it("calls the server's own line what it is", () => {
    expect(fromServer({ ai_generated: false, model: null })).toEqual({ kind: "computed" });
  });

  it("is AI without a model name when a cached narrative predates the id", () => {
    expect(fromServer({ ai_generated: true, model: null, generated_at: null })).toEqual({
      kind: "ai",
      generatedAt: null,
    });
  });

  it("says nothing for a payload without the fields", () => {
    expect(fromServer({})).toBeNull();
    expect(fromServer({ ai_generated: null })).toBeNull();
  });
});

describe("the server's flag wins over the old inference", () => {
  it("a scored day's fallback (provider down) is not branded AI", () => {
    const p = dailyReportProvenance({
      narrative: "3 of 4 people scored, averaging 71.",
      generated_at: OCT_16,
      metrics: { scored_people: 3 },
      ai_generated: false,
      model: null,
    });
    expect(p.kind).toBe("computed");
  });

  it("a department summary the model wrote is AI, not 'usually AI'", () => {
    const p = deptSummaryProvenance({
      generated_at: OCT_16,
      metrics: { scored_people: 3 },
      ai_generated: true,
      model: "m-1",
    });
    expect(p).toEqual({ kind: "ai", generatedAt: OCT_16, model: "m-1" });
  });

  it("a screenshot summary's fallback over analysed frames is not AI", () => {
    expect(
      screenshotSummaryProvenance({ generated_at: OCT_16, metrics: { frames: 12 }, ai_generated: false })
        .kind,
    ).toBe("computed");
  });

  it("an empty narrative is never attributed, whatever the flags say", () => {
    expect(
      dailyReportProvenance({ narrative: "", reason: "nothing yet", ai_generated: true, model: "m" }).kind,
    ).toBe("computed");
  });

  it("the location summary follows the same rules", () => {
    expect(locationSummaryProvenance({ generated_at: OCT_16, metrics: { located: 0 } }).kind).toBe(
      "computed",
    );
    expect(locationSummaryProvenance({ generated_at: OCT_16, metrics: { located: 4 } }).kind).toBe(
      "unknown",
    );
    expect(
      locationSummaryProvenance({ generated_at: OCT_16, metrics: { located: 4 }, ai_generated: true })
        .kind,
    ).toBe("ai");
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

  it("without the server's flag, otherwise claim neither — model and fallback look alike", () => {
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

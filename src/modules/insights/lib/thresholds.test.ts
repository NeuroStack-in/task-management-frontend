import { describe, expect, it } from "vitest";

import { HEALTH_BANDS, HEALTHY_FROM, LOW_SCORE_BELOW, healthBand, isLowScore } from "./thresholds";
import { LOW_SCORE_BELOW as ATTENTION_LINE } from "./attention";

describe("score thresholds (UX audit MON-18)", () => {
  it("is the server's 60 line, and the attention module reads the same constant", () => {
    expect(LOW_SCORE_BELOW).toBe(60);
    expect(ATTENTION_LINE).toBe(LOW_SCORE_BELOW);
  });

  it("puts the health bands on the same line as Needs attention", () => {
    expect(healthBand(LOW_SCORE_BELOW - 1).key).toBe("at-risk");
    expect(healthBand(LOW_SCORE_BELOW).key).toBe("stable");
    expect(healthBand(HEALTHY_FROM - 1).key).toBe("stable");
    expect(healthBand(HEALTHY_FROM).key).toBe("healthy");
    expect(healthBand(0).key).toBe("at-risk");
    expect(healthBand(100).key).toBe("healthy");
  });

  it("never pairs red with green in the bands", () => {
    expect(HEALTH_BANDS.map((b) => b.color)).not.toContain("var(--destructive)");
  });

  it("names each band's range for the legend", () => {
    expect(HEALTH_BANDS.map((b) => `${b.label} ${b.range}`)).toEqual([
      "Healthy 80+",
      "Stable 60–79",
      "At risk under 60",
    ]);
  });

  it("calls a score low only under the line", () => {
    expect(isLowScore(59)).toBe(true);
    expect(isLowScore(60)).toBe(false);
  });
});

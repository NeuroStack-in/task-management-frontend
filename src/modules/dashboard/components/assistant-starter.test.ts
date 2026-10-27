import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/insights/services/insights.service", () => ({
  getDeptSummary: vi.fn(),
  regenerateDeptSummary: vi.fn(),
}));

import { assistantStarter } from "./real-widgets";

/** AI-36: "Ask the assistant" starts neutrally — no "flag any burnout risks". */
describe("assistantStarter", () => {
  it("asks about hours, attendance and what needs attention, for the dashboard's window", () => {
    expect(assistantStarter("today")).toBe(
      "Summarize today for the team: hours, attendance and anything that needs my attention.",
    );
    expect(assistantStarter("last 7 days")).toBe(
      "Summarize the last 7 days for the team: hours, attendance and anything that needs my attention.",
    );
    expect(assistantStarter("Oct 1 – Oct 7", "Engineering")).toBe(
      "Summarize Oct 1 – Oct 7 for the Engineering department: hours, attendance and anything that needs my attention.",
    );
  });

  it("never asks for a judgement about anyone's health", () => {
    for (const r of [undefined, "today", "last 7 days", "this month", "selected range"]) {
      expect(assistantStarter(r)).not.toMatch(/burnout|health|stress|risk/i);
    }
  });
});

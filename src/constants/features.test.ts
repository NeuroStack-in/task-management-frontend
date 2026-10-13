import { describe, expect, it } from "vitest";
import { featureForPath } from "./features";

/**
 * WP-082 (QA audit 2026-10-08): the report library is `reports.basic` — in every plan — but its only
 * route was gated on the Enterprise-only AI-PDF key, so Free and Starter orgs could never open it.
 * The AI briefing on the same page locks itself with its own notice.
 */
describe("featureForPath", () => {
  it("opens the reports page to every plan that has basic reports", () => {
    expect(featureForPath("/insights/ai-reports")).toBe("reports.basic");
    expect(featureForPath("/insights/reports")).toBe("reports.basic");
  });

  it("still gates the capture surfaces on their own keys", () => {
    expect(featureForPath("/insights/screenshots")).toBe("monitoring.screenshots");
    expect(featureForPath("/insights/activity")).toBe("monitoring.activity");
  });
});

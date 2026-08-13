import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the HTTP boundary so these are pure contract tests: assert the exact route/query each
// service builds. A drift here would mean the frontend calls a path the backend doesn't serve.
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import {
  getAiReport,
  getUnclassifiedApps,
  getAttention,
  getDailySummary,
  getOrgActivity,
  getOversightLocations,
  getReportsCatalog,
  getScreenshots,
  getSelfActivity,
} from "./insights.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("insights.service route contract", () => {
  it("daily summary is date-scoped and self", async () => {
    await getDailySummary("2026-07-17");
    expect(mock).toHaveBeenCalledWith("/v1/me/insights/summary?date=2026-07-17");
  });

  it("attention is the org day route", async () => {
    await getAttention("2026-07-17");
    expect(mock).toHaveBeenCalledWith("/v1/insights/attention?date=2026-07-17");
  });

  it("org activity rollup", async () => {
    await getOrgActivity("2026-07-17");
    expect(mock).toHaveBeenCalledWith("/v1/insights/activity?date=2026-07-17");
  });

  it("oversight locations is the org day route", async () => {
    await getOversightLocations("2026-07-17");
    expect(mock).toHaveBeenCalledWith("/v1/insights/locations?date=2026-07-17");
  });

  it("self activity carries the from/to range", async () => {
    await getSelfActivity("2026-07-01", "2026-07-17");
    expect(mock).toHaveBeenCalledWith(
      "/v1/me/insights/activity?from=2026-07-01&to=2026-07-17",
    );
  });

  it("screenshots pass date + optional user/limit filters in order", async () => {
    await getScreenshots("2026-07-17", { userId: "u1", limit: 60 });
    expect(mock).toHaveBeenCalledWith(
      "/v1/insights/screenshots?date=2026-07-17&user_id=u1&limit=60",
    );
  });

  it("screenshots omit absent filters", async () => {
    await getScreenshots("2026-07-17");
    expect(mock).toHaveBeenCalledWith("/v1/insights/screenshots?date=2026-07-17");
  });

  it("reports catalog + entitlement-gated ai report", async () => {
    await getReportsCatalog();
    expect(mock).toHaveBeenCalledWith("/v1/insights/reports");
    await getAiReport("2026-07-17");
    expect(mock).toHaveBeenCalledWith("/v1/insights/reports/ai?date=2026-07-17");
  });
});

describe("unclassified apps — the rules worklist", () => {
  it("GETs the plain list without asking for suggestions", async () => {
    mock.mockResolvedValueOnce({ apps: [], total_seen: 0, no_rules_configured: false });
    await getUnclassifiedApps();
    // Suggestions are the only paid, slow part of the call — they must be opt-in.
    expect(mock).toHaveBeenCalledWith("/v1/insights/apps/unclassified");
  });

  it("asks for suggestions only when told to", async () => {
    mock.mockResolvedValueOnce({ apps: [], total_seen: 0, no_rules_configured: false });
    await getUnclassifiedApps(true);
    expect(mock).toHaveBeenCalledWith("/v1/insights/apps/unclassified?suggest=true");
  });
});

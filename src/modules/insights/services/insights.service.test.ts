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
  getUserRecap,
  regenerateUserRecap,
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

/**
 * The per-employee recaps. Each period has its own route *and* its own query parameter name, so a
 * mix-up here is a 400 or a silently wrong period rather than a compile error.
 */
describe("per-employee recaps", () => {
  const U = "user-1";

  it("maps each period to its route and its parameter name", async () => {
    const cases: [Parameters<typeof getUserRecap>[1], string, string][] = [
      ["daily", "2026-08-12", "/v1/insights/user/user-1/summary?date=2026-08-12"],
      ["weekly", "2026-W33", "/v1/insights/user/user-1/weekly?week=2026-W33"],
      ["monthly", "2026-08", "/v1/insights/user/user-1/monthly?month=2026-08"],
    ];
    for (const [period, param, expected] of cases) {
      mock.mockResolvedValueOnce({});
      await getUserRecap(U, period, param);
      expect(mock).toHaveBeenLastCalledWith(expected);
    }
  });

  it("overall omits the parameter entirely when none is given", async () => {
    // The server then defaults to 'through now', which is what makes a bare GET mean 'as of today'.
    mock.mockResolvedValueOnce({});
    await getUserRecap(U, "overall");
    expect(mock).toHaveBeenLastCalledWith("/v1/insights/user/user-1/overall");
  });

  it("encodes the user id so an id with a slash cannot escape the path", async () => {
    mock.mockResolvedValueOnce({});
    await getUserRecap("a/b", "overall");
    expect(mock).toHaveBeenLastCalledWith("/v1/insights/user/a%2Fb/overall");
  });

  it("regenerate POSTs the twin of each read", async () => {
    mock.mockResolvedValueOnce({});
    await regenerateUserRecap(U, "weekly", "2026-W33");
    expect(mock).toHaveBeenLastCalledWith(
      "/v1/insights/user/user-1/weekly/regenerate?week=2026-W33",
      { method: "POST" },
    );
  });
});

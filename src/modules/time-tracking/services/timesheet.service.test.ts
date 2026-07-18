import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the HTTP boundary so these are pure contract tests: assert the exact route/query each
// service builds. A drift here would mean the frontend calls a path the backend doesn't serve.
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import { getRange, getToday } from "./timesheet.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("timesheet.service route contract", () => {
  it("today is date-scoped and self", async () => {
    await getToday("2026-07-17");
    expect(mock).toHaveBeenCalledWith("/v1/me/timesheet/today?date=2026-07-17");
  });

  it("range carries from/to in URLSearchParams order", async () => {
    await getRange("2026-07-01", "2026-07-17");
    expect(mock).toHaveBeenCalledWith(
      "/v1/me/timesheet?from=2026-07-01&to=2026-07-17",
    );
  });
});

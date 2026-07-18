import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the HTTP boundary so these are pure contract tests: assert the exact route/query each
// service builds. A drift here would mean the frontend calls a path the backend doesn't serve.
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import { getDayOversight, getMyAttendance } from "./attendance.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("attendance.service route contract", () => {
  it("my attendance carries from/to in URLSearchParams order", async () => {
    await getMyAttendance("2026-07-01", "2026-07-17");
    expect(mock).toHaveBeenCalledWith(
      "/v1/me/attendance?from=2026-07-01&to=2026-07-17",
    );
  });

  it("day oversight is the org single-day route", async () => {
    await getDayOversight("2026-07-17");
    expect(mock).toHaveBeenCalledWith("/v1/attendance/day?date=2026-07-17");
  });
});

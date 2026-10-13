import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the HTTP boundary so these are pure contract tests: assert the exact route/query each
// service builds. A drift here would mean the frontend calls a path the backend doesn't serve.
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import {
  getDayOversight,
  getMyAttendance,
  overrideDay,
  recomputeAttendance,
} from "./attendance.service";

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

  // WP-159: the server works in bounded slices and says where it stopped; the service keeps going
  // from there and reports the whole window's total.
  it("recompute resumes from the server's resume point until done", async () => {
    mock
      .mockResolvedValueOnce({ from: "2026-08-01", to: "2026-09-14", recomputed: 40, done: false, resume_to: "2026-08-20" })
      .mockResolvedValueOnce({ from: "2026-08-01", to: "2026-08-20", recomputed: 25, done: true });
    const res = await recomputeAttendance("2026-08-01", "2026-09-14");
    expect(mock).toHaveBeenNthCalledWith(1, "/v1/attendance/recompute?from=2026-08-01&to=2026-09-14", { method: "POST" });
    expect(mock).toHaveBeenNthCalledWith(2, "/v1/attendance/recompute?from=2026-08-01&to=2026-08-20", { method: "POST" });
    expect(res).toEqual({ from: "2026-08-01", to: "2026-09-14", recomputed: 65, done: true });
  });

  // WP-380: the admin day-override — user and date in the path, status (+ optional note) in the body.
  it("day override PUTs the status to the user/day route, note only when given", async () => {
    await overrideDay("u 1", "2026-09-15", "excused", "Doctor's appointment");
    expect(mock).toHaveBeenCalledWith("/v1/attendance/user/u%201/day/2026-09-15/override", {
      method: "PUT",
      body: JSON.stringify({ status: "excused", note: "Doctor's appointment" }),
    });
    await overrideDay("u1", "2026-09-15", "leave");
    expect(mock).toHaveBeenLastCalledWith("/v1/attendance/user/u1/day/2026-09-15/override", {
      method: "PUT",
      body: JSON.stringify({ status: "leave" }),
    });
  });
});

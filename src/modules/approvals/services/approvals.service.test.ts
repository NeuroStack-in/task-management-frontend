import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the HTTP boundary so these are pure contract tests: assert the exact route/method/body each
// service builds. A drift here would mean the frontend calls a path the backend doesn't serve.
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import { bulkDecide, decide, getQueue } from "./approvals.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("approvals.service route contract", () => {
  it("getQueue GETs the status-scoped queue via URLSearchParams", async () => {
    // the service unwraps `.approvals`; give it something to unwrap.
    mock.mockResolvedValueOnce({ approvals: [] });
    await getQueue("pending");
    expect(mock).toHaveBeenCalledWith("/v1/approvals?status=pending");
  });

  it("decide POSTs the whole decision input verbatim", async () => {
    const input = {
      user_id: "u1",
      request_id: "r1",
      decision: "approve" as const,
      reason: "ok",
    };
    await decide(input);
    expect(mock).toHaveBeenCalledWith("/v1/approvals/decide", {
      method: "POST",
      body: JSON.stringify(input),
    });
  });

  it("bulkDecide POSTs the decisions array wrapped under `decisions`", async () => {
    mock.mockResolvedValueOnce({ results: [] });
    const decisions = [
      { user_id: "u1", request_id: "r1", decision: "approve" as const },
      { user_id: "u2", request_id: "r2", decision: "reject" as const, reason: "no" },
    ];
    await bulkDecide(decisions);
    expect(mock).toHaveBeenCalledWith("/v1/approvals/bulk-decide", {
      method: "POST",
      body: JSON.stringify({ decisions }),
    });
  });
});

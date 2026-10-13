import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the HTTP boundary so these are pure contract tests: assert the exact route/method/body each
// service builds. A drift here would mean the frontend calls a path the backend doesn't serve.
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import { decide, getQueue } from "./approvals.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("approvals.service route contract", () => {
  it("getQueue GETs the status-scoped queue via URLSearchParams", async () => {
    // the service unwraps `.approvals`; give it something to unwrap.
    mock.mockResolvedValueOnce({ approvals: [] });
    await getQueue("pending");
    expect(mock).toHaveBeenCalledWith("/v1/approvals?status=pending&limit=100");
  });

  /** WP-073: the cursor was dropped, so a status never showed more than its 50 oldest rows. */
  it("getQueue follows the cursor to the end of the queue", async () => {
    const row = (id: string) => ({ request_id: id }) as never;
    mock
      .mockResolvedValueOnce({ approvals: [row("a"), row("b")], cursor: "c1" })
      .mockResolvedValueOnce({ approvals: [row("c")], cursor: "c2" })
      .mockResolvedValueOnce({ approvals: [row("d")] });
    const rows = await getQueue("approved");
    expect(rows.map((r) => r.request_id)).toEqual(["a", "b", "c", "d"]);
    expect(mock).toHaveBeenNthCalledWith(2, "/v1/approvals?status=approved&limit=100&cursor=c1");
    expect(mock).toHaveBeenNthCalledWith(3, "/v1/approvals?status=approved&limit=100&cursor=c2");
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
});

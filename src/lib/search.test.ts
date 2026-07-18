import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({ employees: [], projects: [], tasks: [] })),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import { searchAll } from "./search";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("searchAll route contract", () => {
  it("hits /v1/search with the url-encoded, trimmed query", async () => {
    await searchAll("  ann marie  ");
    expect(mock).toHaveBeenCalledWith("/v1/search?q=ann%20marie");
  });

  it("never calls the network for a blank query", async () => {
    const r = await searchAll("   ");
    expect(mock).not.toHaveBeenCalled();
    expect(r).toEqual({ employees: [], projects: [], tasks: [] });
  });

  it("degrades to empty buckets on error rather than throwing", async () => {
    mock.mockRejectedValueOnce(new Error("boom"));
    const r = await searchAll("x");
    expect(r).toEqual({ employees: [], projects: [], tasks: [] });
  });
});

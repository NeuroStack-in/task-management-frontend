import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import { listAudit } from "./audit.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("audit.service route contract", () => {
  it("listAudit defaults to limit=200 and omits category", async () => {
    await listAudit();
    expect(mock).toHaveBeenCalledWith("/v1/audit?limit=200");
  });

  it("listAudit passes a real category + custom limit", async () => {
    await listAudit("auth", 50);
    expect(mock).toHaveBeenCalledWith("/v1/audit?category=auth&limit=50");
  });

  it("listAudit treats 'all' as no category filter", async () => {
    await listAudit("all", 25);
    expect(mock).toHaveBeenCalledWith("/v1/audit?limit=25");
  });
});

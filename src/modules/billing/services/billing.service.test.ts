import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the HTTP boundary so these are pure contract tests: assert the exact route each service
// builds. A drift here would mean the frontend calls a path the backend doesn't serve.
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import { changePlan, getBillingOverview } from "./billing.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("billing.service route contract", () => {
  it("getBillingOverview GETs the org billing overview", async () => {
    await getBillingOverview();
    expect(mock).toHaveBeenCalledWith("/v1/billing");
  });

  it("changePlan POSTs the plan id to /v1/billing/change-plan", async () => {
    await changePlan({ plan: "starter" });
    expect(mock).toHaveBeenCalledWith("/v1/billing/change-plan", {
      method: "POST",
      body: JSON.stringify({ plan: "starter" }),
    });
  });
});

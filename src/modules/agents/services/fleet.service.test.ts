import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import {
  getDevice,
  getTrackingPolicy,
  listFleet,
  updateTrackingPolicy,
} from "./fleet.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("fleet.service route contract", () => {
  it("listFleet GETs /v1/fleet", async () => {
    await listFleet();
    expect(mock).toHaveBeenCalledWith("/v1/fleet");
  });

  it("getDevice GETs the encoded agent path", async () => {
    await getDevice("d1");
    expect(mock).toHaveBeenCalledWith("/v1/fleet/d1");
  });

  it("getTrackingPolicy GETs /v1/agent/config", async () => {
    await getTrackingPolicy();
    expect(mock).toHaveBeenCalledWith("/v1/agent/config");
  });

  it("updateTrackingPolicy PUTs the policy body to /v1/fleet/update-policy", async () => {
    const body = {
      cadence: "min5" as const,
      blur_level: 2,
      retention_days: 30,
      silent: false,
      auto_update: true,
      expected_version: 4,
    };
    await updateTrackingPolicy(body);
    expect(mock).toHaveBeenCalledWith("/v1/fleet/update-policy", {
      method: "PUT",
      body: JSON.stringify(body),
    });
  });
});

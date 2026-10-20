import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return { apiFetch: vi.fn(), ApiError };
});

import { apiFetch, ApiError } from "@/lib/api";
import { getMyDevices } from "./my-devices.service";

const mock = vi.mocked(apiFetch);
// Each test installs its own implementation. Braces matter: a hook that returns a function has it run
// as teardown, and `mockClear()` returns the mock — which would call `apiFetch` once more.
beforeEach(() => {
  mock.mockClear();
});

/** Resolve or reject, as a settled outcome — so a rejection is asserted on, never left in flight. */
async function outcome(): Promise<{ ok: unknown } | { err: unknown }> {
  try {
    return { ok: await getMyDevices() };
  } catch (err) {
    return { err };
  }
}

describe("my-devices.service", () => {
  it("GETs /v1/me/devices and unwraps `devices`", async () => {
    mock.mockResolvedValue({ devices: [{ agent_id: "a1" }] });
    expect(await outcome()).toEqual({ ok: [{ agent_id: "a1" }] });
    expect(mock).toHaveBeenCalledWith("/v1/me/devices");
  });

  it("reads a server without the route (404) as unknown, not as no devices", async () => {
    const E = ApiError as unknown as new (m: string, s: number) => Error;
    mock.mockImplementation(() => Promise.reject(new E("not found", 404)));
    expect(await outcome()).toEqual({ ok: null });
  });

  it("still throws on any other failure", async () => {
    const E = ApiError as unknown as new (m: string, s: number) => Error;
    mock.mockImplementation(() => Promise.reject(new E("boom", 500)));
    const r = await outcome();
    expect("err" in r).toBe(true);
  });

  it("treats a malformed body as no devices", async () => {
    mock.mockResolvedValue({});
    expect(await outcome()).toEqual({ ok: [] });
  });
});

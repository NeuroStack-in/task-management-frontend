import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getEntitlements: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getEntitlements: api.getEntitlements,
}));

import { ApiError } from "@/lib/api";
import { useEntitlementsStore } from "@/stores/entitlements.store";
import { isEntitlementGated, refreshEntitlements, useEntitlementsSync } from "./use-features";

const ENT = { plan: "enterprise", allowed: ["leave"], enabled: { leave: true }, version: 1 };
const state = () => useEntitlementsStore.getState();

beforeEach(() => {
  useEntitlementsStore.setState({ loaded: false, failed: false, allowed: [], enabled: {} });
  api.getEntitlements.mockReset();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

/**
 * One failed read used to leave every hidden page and mode-hidden section open for the whole
 * session — it was never retried (QA audit 2026-10-08, WP-317).
 */
describe("useEntitlementsSync", () => {
  it("retries a failed read", async () => {
    api.getEntitlements.mockRejectedValueOnce(new ApiError("down", 500)).mockResolvedValue(ENT);
    renderHook(() => useEntitlementsSync(true));
    await vi.advanceTimersByTimeAsync(0);
    expect(state().loaded).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(state().loaded).toBe(true);
    expect(state().failed).toBe(false);
  });

  it("settles fail-open once the quick retries are spent, then still heals", async () => {
    api.getEntitlements.mockRejectedValue(new ApiError("busy", 503));
    renderHook(() => useEntitlementsSync(true));
    await vi.advanceTimersByTimeAsync(1_000 + 3_000 + 8_000);
    expect(state().failed).toBe(true);
    expect(state().loaded).toBe(false);

    api.getEntitlements.mockResolvedValue(ENT);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state().loaded).toBe(true);
    expect(state().failed).toBe(false);
  });

  it("stops asking on a refusal no retry will change", async () => {
    api.getEntitlements.mockRejectedValue(new ApiError("no", 403));
    renderHook(() => useEntitlementsSync(true));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(state().failed).toBe(true);
    expect(api.getEntitlements).toHaveBeenCalledTimes(1);
  });
});

describe("isEntitlementGated", () => {
  it.each(["/payroll", "/projects/abc", "/insights", "/settings/integrations"])(
    "%s can be closed by an entitlement",
    (path) => expect(isEntitlementGated(path)).toBe(true),
  );
  it.each(["/dashboard", "/settings/roles", "/settings"])("%s cannot", (path) =>
    expect(isEntitlementGated(path)).toBe(false),
  );
});

/** A plan change reaches the entitlements item asynchronously, so the refresh waits for it (WP-335). */
describe("refreshEntitlements", () => {
  it("keeps reading until the server reports the new plan", async () => {
    api.getEntitlements.mockResolvedValueOnce({ ...ENT, plan: "free" }).mockResolvedValue(ENT);
    const done = refreshEntitlements("enterprise");
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(done).resolves.toBe(true);
    expect(api.getEntitlements).toHaveBeenCalledTimes(2);
    expect(state().allowed).toEqual(["leave"]);
  });
});

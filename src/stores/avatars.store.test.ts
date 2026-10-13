import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getEmployeeAvatarUrls = vi.hoisted(() =>
  vi.fn(async (ids: string[]) => Object.fromEntries(ids.map((id) => [id, `https://s3/${id}`]))),
);
vi.mock("@/modules/employees/services/employees.service", () => ({ getEmployeeAvatarUrls }));

import { useAvatarStore } from "./avatars.store";

beforeEach(() => {
  vi.useFakeTimers();
  getEmployeeAvatarUrls.mockClear();
});
afterEach(() => vi.useRealTimers());

/**
 * WP-065 (QA audit 2026-10-08): each `<UserAvatar>` calls `ensure` with one id, so the store must
 * coalesce a render's worth of calls into one request — it used to send one per avatar.
 */
describe("avatar store", () => {
  it("batches the ids asked for within one window into a single request", async () => {
    const { ensure } = useAvatarStore.getState();
    ensure(["a"]);
    ensure(["b"]);
    ensure(["a", "c"]);
    expect(getEmployeeAvatarUrls).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(getEmployeeAvatarUrls).toHaveBeenCalledTimes(1);
    expect(getEmployeeAvatarUrls.mock.calls[0][0].sort()).toEqual(["a", "b", "c"]);
    expect(useAvatarStore.getState().urls.b).toBe("https://s3/b");
  });

  it("never asks about the same id twice", async () => {
    const { ensure } = useAvatarStore.getState();
    ensure(["z1"]);
    await vi.runAllTimersAsync();
    ensure(["z1"]);
    await vi.runAllTimersAsync();
    expect(getEmployeeAvatarUrls).toHaveBeenCalledTimes(1);
  });

  /** WP-231: the URLs are 15-minute presigns, so an old answer is asked for again. */
  it("asks again once an answer is old enough for its URL to expire", async () => {
    const { ensure } = useAvatarStore.getState();
    ensure(["ttl-1"]);
    await vi.runAllTimersAsync();
    vi.advanceTimersByTime(13 * 60_000);
    ensure(["ttl-1"]);
    await vi.runAllTimersAsync();
    expect(getEmployeeAvatarUrls).toHaveBeenCalledTimes(2);
  });

  it("splits a large burst at the server's 50-id cap", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `big-${i}`);
    useAvatarStore.getState().ensure(ids);
    await vi.runAllTimersAsync();
    expect(getEmployeeAvatarUrls).toHaveBeenCalledTimes(3);
  });
});

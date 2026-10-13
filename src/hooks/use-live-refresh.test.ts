/**
 * The poll half of `useLiveRefresh`, and the `isBusy` guard added for the dashboard (QA audit
 * 2026-10-08, WP-193): a tick that lands while the consumer's load is still running must not start
 * another one — a load slower than the interval was otherwise superseded by every tick and never
 * landed. Explicit asks (`reload`) are never skipped.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLiveRefresh } from "./use-live-refresh";

describe("useLiveRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls quietly on the interval, and reading the flag clears it", () => {
    const { result } = renderHook(() => useLiveRefresh(1000));
    expect(result.current.nonce).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.nonce).toBe(1);
    expect(result.current.isBackground()).toBe(true);
    expect(result.current.isBackground()).toBe(false);
  });

  it("skips ticks while the consumer's load is in flight, and resumes after", () => {
    let busy = true;
    const { result } = renderHook(() => useLiveRefresh(1000, { isBusy: () => busy }));

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.nonce).toBe(0);

    busy = false;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.nonce).toBe(1);
  });

  it("never skips an explicit reload, which is a foreground run", () => {
    const { result } = renderHook(() => useLiveRefresh(1000, { isBusy: () => true }));

    act(() => result.current.reload());
    expect(result.current.nonce).toBe(1);
    expect(result.current.isBackground()).toBe(false);
  });

  it("does not poll at all with a null interval", () => {
    const { result } = renderHook(() => useLiveRefresh(null));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.nonce).toBe(0);
  });
});

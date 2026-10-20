import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useUnsavedStore } from "@/stores/unsaved.store";
import { SectionDirtyContext, useCardGuard, withOwner } from "./card-guard";

afterEach(() => useUnsavedStore.getState().clear());

describe("withOwner", () => {
  it("adds and drops a card, and keeps the same list when nothing changes", () => {
    const one = withOwner([], "a", true);
    expect(one).toEqual(["a"]);
    expect(withOwner(one, "a", true)).toBe(one);
    expect(withOwner(one, "a", false)).toEqual([]);
  });
});

describe("useCardGuard (UX audit XC-11 / SET-14)", () => {
  it("guards leaving the page and marks the card's section while it holds edits", () => {
    const report = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SectionDirtyContext.Provider value={report}>{children}</SectionDirtyContext.Provider>
    );
    const card = renderHook(({ dirty }) => useCardGuard(dirty), {
      wrapper,
      initialProps: { dirty: true },
    });
    expect(useUnsavedStore.getState().dirty).toBe(true);
    expect(report).toHaveBeenLastCalledWith(expect.any(String), true);

    card.rerender({ dirty: false });
    expect(useUnsavedStore.getState().dirty).toBe(false);
    expect(report).toHaveBeenLastCalledWith(expect.any(String), false);
  });

  it("still marks a kept draft on its tab, though leaving doesn't ask", () => {
    const report = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SectionDirtyContext.Provider value={report}>{children}</SectionDirtyContext.Provider>
    );
    renderHook(() => useCardGuard(true, { keptOnLeave: true }), { wrapper });
    expect(useUnsavedStore.getState().dirty).toBe(false);
    expect(report).toHaveBeenLastCalledWith(expect.any(String), true);
  });

  it("clears its mark when the card unmounts", () => {
    const report = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <SectionDirtyContext.Provider value={report}>{children}</SectionDirtyContext.Provider>
    );
    const card = renderHook(() => useCardGuard(true), { wrapper });
    card.unmount();
    expect(report).toHaveBeenLastCalledWith(expect.any(String), false);
  });

  it("is just the leave guard outside a section", () => {
    renderHook(() => useCardGuard(true));
    expect(useUnsavedStore.getState().dirty).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";

import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useUnsavedStore } from "./unsaved.store";

const state = () => useUnsavedStore.getState();

describe("unsaved-changes store", () => {
  beforeEach(() => state().clear());
  afterEach(() => window.history.replaceState(null, "", "/"));

  /**
   * WP-347. One shared boolean that every caller overwrote: a clean editor mounting beside a dirty
   * form wrote `false` over the form's `true`, and leaving then discarded the form's draft unasked.
   */
  it("stays dirty while any guard is dirty", () => {
    const form = renderHook(({ dirty }) => useUnsavedGuard(dirty), {
      initialProps: { dirty: true },
    });
    const editor = renderHook(({ dirty }) => useUnsavedGuard(dirty), {
      initialProps: { dirty: false },
    });
    expect(state().dirty).toBe(true);

    editor.rerender({ dirty: true });
    form.rerender({ dirty: false });
    expect(state().dirty).toBe(true);

    editor.unmount();
    expect(state().dirty).toBe(false);
    form.unmount();
  });

  it("a guard for a draft that survives navigation never asks on an in-app leave", () => {
    const g = renderHook(() => useUnsavedGuard(true, { keptOnLeave: true }));
    expect(state().dirty).toBe(false);
    expect(state().requestLeave("/dashboard")).toBe(true);
    g.unmount();
  });

  it("requestLeave lets a clean page go, and holds a dirty one for confirmation", () => {
    window.history.replaceState(null, "", "/settings/organization");
    expect(state().requestLeave("/dashboard")).toBe(true);
    expect(state().pendingHref).toBeNull();

    state().setDirty("a", true);
    expect(state().requestLeave("/dashboard")).toBe(false);
    expect(state().pendingHref).toBe("/dashboard");

    state().cancelLeave();
    expect(state().pendingHref).toBeNull();
    expect(state().dirty).toBe(true);
  });

  it("another spot on the same page discards nothing", () => {
    window.history.replaceState(null, "", "/settings/organization");
    state().setDirty("a", true);
    expect(state().requestLeave("/settings/organization#teams")).toBe(true);
    expect(state().pendingHref).toBeNull();
  });

  it("drops a pending request once nothing is unsaved", () => {
    window.history.replaceState(null, "", "/settings/organization");
    state().setDirty("a", true);
    state().requestLeave("/dashboard");
    state().setDirty("a", false);
    expect(state().pendingHref).toBeNull();
  });

  it("clear forgets every draft and the pending request", () => {
    state().setDirty("a", true);
    state().setDirty("b", true);
    state().requestLeave("/dashboard");
    state().clear();
    expect(state()).toMatchObject({ dirty: false, owners: [], pendingHref: null });
  });
});

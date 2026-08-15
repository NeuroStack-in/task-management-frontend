import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  MAX_PAGE_FACTS,
  useAssistantPageContext,
  usePageContextStore,
} from "./page-context.store";

const read = () => usePageContextStore.getState();

describe("page context published to the assistant", () => {
  beforeEach(() => usePageContextStore.getState().clear());

  /**
   * **The bug.** The panel sent the page's identity but not its state, so every date-keyed tool
   * fell back to today (UTC). A user on Analytics with Aug 14 selected asked which screenshot
   * needed review and got answered for Aug 15 — "no screenshots were captured today".
   */
  it("publishes the day the page is showing", () => {
    renderHook(() => useAssistantPageContext({ date: "2026-08-14", facts: [] }));
    expect(read().date).toBe("2026-08-14");
  });

  /** The hero figures live only in the browser tab, so the assistant could not reconcile them. */
  it("publishes the figures already on screen", () => {
    renderHook(() =>
      useAssistantPageContext({
        date: "2026-08-14",
        facts: [
          { label: "Needs review", value: "1" },
          { label: "Screenshots", value: "156" },
        ],
      }),
    );
    expect(read().facts).toEqual([
      { label: "Needs review", value: "1" },
      { label: "Screenshots", value: "156" },
    ]);
  });

  /**
   * Leaving a page must drop its state. A date left behind would silently attach itself to a
   * question asked somewhere else — the same wrong-day failure, just harder to see.
   */
  it("clears on unmount so a stale date cannot follow the user", () => {
    const { unmount } = renderHook(() =>
      useAssistantPageContext({ date: "2026-08-14", facts: [{ label: "Tab", value: "Screenshots" }] }),
    );
    expect(read().date).toBe("2026-08-14");
    unmount();
    expect(read().date).toBeNull();
    expect(read().facts).toEqual([]);
  });

  /** Bounded like every client string that reaches a prompt — a page cannot crowd out the chat. */
  it("caps how many facts a page may publish", () => {
    const many = Array.from({ length: MAX_PAGE_FACTS + 10 }, (_, i) => ({
      label: `l${i}`,
      value: `v${i}`,
    }));
    renderHook(() => useAssistantPageContext({ facts: many }));
    expect(read().facts).toHaveLength(MAX_PAGE_FACTS);
  });

  /** Empty labels/values are dropped rather than sent as ": " noise. */
  it("drops blank facts", () => {
    renderHook(() =>
      useAssistantPageContext({
        facts: [
          { label: "", value: "1" },
          { label: "Real", value: "2" },
          { label: "Blank", value: "  " },
        ],
      }),
    );
    expect(read().facts).toEqual([{ label: "Real", value: "2" }]);
  });
});

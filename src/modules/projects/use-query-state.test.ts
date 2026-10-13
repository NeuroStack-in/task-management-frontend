import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useQueryState } from "./use-query-state";

const VIEWS = ["projects", "tasks"] as const;
type View = (typeof VIEWS)[number];

/**
 * The Projects view settings survive Back, a refresh and a shared link only because they are read
 * from — and written to — the query string (WP-502).
 */
describe("useQueryState", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("starts from the value in the URL", () => {
    window.history.replaceState(null, "", "/projects?view=tasks");
    const { result } = renderHook(() => useQueryState<View>("view", "projects", VIEWS));
    expect(result.current[0]).toBe("tasks");
  });

  it("ignores a value the page doesn't know, rather than rendering it", () => {
    window.history.replaceState(null, "", "/projects?view=bogus");
    const { result } = renderHook(() => useQueryState<View>("view", "projects", VIEWS));
    expect(result.current[0]).toBe("projects");
  });

  it("writes changes to the URL, and drops the parameter at its default", () => {
    window.history.replaceState(null, "", "/projects?q=atlas");
    const { result } = renderHook(() => useQueryState<View>("view", "projects", VIEWS));

    act(() => result.current[1]("tasks"));
    expect(window.location.search).toBe("?q=atlas&view=tasks");

    act(() => result.current[1]("projects"));
    expect(window.location.search).toBe("?q=atlas");
  });
});

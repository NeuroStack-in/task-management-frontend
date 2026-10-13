"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * One view setting — a tab, a layout, a filter, a search — kept in the page's query string, so Back,
 * a refresh and a shared link all land on the same view. These lived in `useState` alone, and every
 * one of them reset on the way back from a project (QA audit 2026-10-08, WP-502).
 *
 * Read from `window.location` after mount rather than through `useSearchParams`: the server render
 * and the client's first render must agree, and `useSearchParams` would also need a Suspense boundary
 * at the route. Written with `history.replaceState`, which Next.js keeps its router in step with — a
 * filter change is not a navigation, so it must not add a Back entry of its own.
 *
 * `allowed` guards against a stale or hand-edited link: an unknown value falls back to `fallback`
 * rather than reaching a `META[value]` lookup. Pass a module-level constant — it is an effect
 * dependency.
 */
export function useQueryState<T extends string>(
  key: string,
  fallback: T,
  allowed?: readonly T[],
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get(key);
    if (raw !== null && (!allowed || allowed.includes(raw as T))) setValue(raw as T);
  }, [key, allowed]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      const params = new URLSearchParams(window.location.search);
      if (next === fallback) params.delete(key);
      else params.set(key, next);
      const qs = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    },
    [key, fallback],
  );

  return [value, update];
}

"use client";

/**
 * Debounced global search against `GET /v1/search?q=` (see {@link search}).
 *
 * Three behaviours the palette depends on:
 * - **No request for an empty query.** The server short-circuits an empty `q` anyway; not firing at
 *   all keeps the dropdown instant when the user clears the field.
 * - **Debounced** (~250ms) so a burst of keystrokes costs one round trip.
 * - **Stale responses are ignored.** Each run owns a `live` flag *and* an `AbortController`, so a
 *   slow response for "jo" can never overwrite the results for "john".
 *
 * Results are permission-filtered server-side, so an empty list is a legitimate answer (the caller
 * may simply lack `employees:read`) — not an error.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  search,
  type ApiSearchResults,
} from "@/modules/search/services/search.service";

const DEBOUNCE_MS = 250;

const EMPTY: ApiSearchResults = { employees: [], projects: [], tasks: [] };

export interface GlobalSearchState {
  /** `null` until the first query resolves; `EMPTY` shape once it has. */
  data: ApiSearchResults | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useGlobalSearch(query: string): GlobalSearchState {
  const [data, setData] = useState<ApiSearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const q = query.trim();

  useEffect(() => {
    // Empty query: clear without touching the network.
    if (!q) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let live = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      (async () => {
        try {
          const res = await search(q, controller.signal);
          if (live) setData(res);
        } catch (e) {
          // An abort is this hook superseding itself — not a failure worth showing.
          if (live && !isAbort(e)) {
            setData(EMPTY);
            setError(messageOf(e));
          }
        } finally {
          if (live) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    return e.message;
  }
  return "Couldn't reach search.";
}

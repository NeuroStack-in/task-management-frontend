"use client";

/**
 * Layer 1 of the feature gate: **what the org's plan allows** (`GET /v1/org/entitlements`).
 *
 * LLD §1 defines gating as two layers, with the invariant `enabled ⊆ allowed`:
 *
 *     effective(key) = key ∈ allowed (the plan)  AND  enabled[key] === true (the owner)
 *
 * `lib/api.ts::getEntitlements` had no importers, so neither layer was ever fetched. This closes it.
 *
 * ## Both layers come from the server
 *
 * The endpoint returns `allowed` **and** `enabled`, so the owner's toggles live server-side too, and
 * `effective()` reads both from the response. (A persisted local copy with its own defaults, which
 * disagreed with the server, used to sit in `stores/features.store.ts`; only the `FeatureKey` type
 * is left there.)
 *
 * **This is UX, not enforcement.** The server's `FeatureGate` is the real boundary and decides
 * regardless of what this returns; the point is to stop offering a toggle the plan will refuse.
 */
import { useCallback, useEffect, useState } from "react";
import { getEntitlements, type Entitlements } from "@/lib/api";
import { type FeatureKey } from "@/stores/features.store";

type DisabledBy = NonNullable<Entitlements["disabled_by"]>;

export interface EntitlementsState {
  /** The whole response, for hydrating the shared store from this fresh read. `null` until loaded. */
  raw: Entitlements | null;
  /** The org's plan id (`free` | `starter` | `enterprise` — `wp_contracts::plans::Plan`). */
  plan: string | null;
  /** Keys the plan permits — the ceiling. Empty until loaded. */
  allowed: Set<string>;
  /** Layer 2 alone — the owner's per-key activation flags, straight from the server. */
  enabled: Record<string, boolean>;
  /**
   * Page visibility and the "turned off by" provenance, from **this** read — not the session-old
   * shared store, which a colleague's change since sign-in leaves stale (QA audit 2026-10-08, WP-338).
   */
  pages: Record<string, boolean>;
  disabledBy: DisabledBy;
  pagesDisabledBy: DisabledBy;
  loading: boolean;
  error: string | null;
  /**
   * `key ∈ allowed && enabled[key]` — the whole gate, both layers.
   *
   * **Fails closed while loading and on error.** An unknown ceiling must not read as an unlimited
   * one: briefly hiding a feature the plan does allow is recoverable, but offering one it doesn't
   * teaches the user the toggle works and then lets the server reject it.
   */
  effective: (key: FeatureKey) => boolean;
  /** Layer 1 alone — for explaining *why* something is unavailable ("upgrade" vs "switch it on"). */
  isAllowed: (key: FeatureKey) => boolean;
  reload: () => void;
}

/** One shared empty map, so an unloaded field keeps a stable identity across renders. */
const EMPTY = Object.freeze({}) as Record<string, never>;

export function useEntitlements(): EntitlementsState {
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getEntitlements()
      .then((e) => {
        if (live) setEnt(e);
      })
      .catch(() => {
        if (live) setError("Couldn't load your plan's entitlements.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [nonce]);

  const allowed = new Set(ent?.allowed ?? []);

  const isAllowed = useCallback(
    (key: FeatureKey) => (ent ? ent.allowed.includes(key) : false),
    [ent],
  );

  const effective = useCallback(
    (key: FeatureKey) =>
      ent ? ent.allowed.includes(key) && ent.enabled[key] === true : false,
    [ent],
  );

  return {
    raw: ent,
    plan: ent?.plan ?? null,
    allowed,
    enabled: ent?.enabled ?? EMPTY,
    pages: ent?.pages ?? EMPTY,
    disabledBy: ent?.disabled_by ?? EMPTY,
    pagesDisabledBy: ent?.pages_disabled_by ?? EMPTY,
    loading,
    error,
    effective,
    isAllowed,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  };
}

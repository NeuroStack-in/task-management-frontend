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
 * ## Both layers come from the server — `features.store` is not the source of truth
 *
 * The endpoint returns `allowed` **and** `enabled`, so the owner's toggles live server-side too.
 * `stores/features.store.ts` keeps a *separate* `persist`ed copy with its own `DEFAULTS`, and the
 * two already disagree on the live dev org: the server has `anomalies` and
 * `insights.reports.ai_pdf` **on**, the local defaults have both **off**.
 *
 * So `effective()` reads both layers from the response and never consults the store. Preferring
 * localStorage over the org's real entitlements would mean one browser's stale toggle silently
 * overriding what the org actually bought — and the server would then refuse the call anyway.
 *
 * **This is UX, not enforcement.** The server's `FeatureGate` is the real boundary and decides
 * regardless of what this returns; the point is to stop offering a toggle the plan will refuse.
 */
import { useCallback, useEffect, useState } from "react";
import { getEntitlements, type Entitlements } from "@/lib/api";
import { type FeatureKey } from "@/stores/features.store";

export interface EntitlementsState {
  /** The org's plan id (`free` | `starter` | `enterprise` — `wp_contracts::plans::Plan`). */
  plan: string | null;
  /** Keys the plan permits — the ceiling. Empty until loaded. */
  allowed: Set<string>;
  /** Layer 2 alone — the owner's per-key activation flags, straight from the server. */
  enabled: Record<string, boolean>;
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
    plan: ent?.plan ?? null,
    allowed,
    enabled: ent?.enabled ?? {},
    loading,
    error,
    effective,
    isAllowed,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  };
}

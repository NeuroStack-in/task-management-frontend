"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useCallback, useEffect } from "react";
import { getEntitlements } from "@/lib/api";
import { effectiveFromState, useEntitlementsStore } from "@/stores/entitlements.store";
import type { FeatureKey } from "@/stores/features.store";

/**
 * `(key) => boolean` for the org's effective features, re-computed when entitlements land.
 *
 * Subscribes to the shared store, so the nav re-filters itself the moment the fetch resolves (and
 * again if an owner toggles a feature and the store is re-hydrated).
 */
export function useIsFeatureOn(): (key: FeatureKey) => boolean {
  const loaded = useEntitlementsStore((s) => s.loaded);
  const allowed = useEntitlementsStore((s) => s.allowed);
  const enabled = useEntitlementsStore((s) => s.enabled);
  const isOwner = useAuthStore((s) => s.user?.isOwner === true);

  return useCallback(
    (key: FeatureKey) =>
      // The Owner is exempt from the `enabled` toggle they own, never from the plan ceiling —
      // mirroring `wp_platform::entitlements::effective_for_owner`. If these two ever disagree the
      // sidebar shows a page the API refuses, so they are written to match deliberately.
      isOwner
        ? loaded
          ? allowed.includes(key)
          : true
        : effectiveFromState({ loaded, allowed, enabled }, key),
    [loaded, allowed, enabled, isOwner],
  );
}

/**
 * Is this feature switched off for everyone *except* the Owner looking at it?
 *
 * Drives the "Off for others" markers. Returns false for non-owners by construction: they cannot
 * see a disabled feature at all, so there is nothing to annotate.
 */
export function useIsFeatureOffForOthers(): (
  key: FeatureKey | null | undefined,
) => boolean {
  const loaded = useEntitlementsStore((s) => s.loaded);
  const allowed = useEntitlementsStore((s) => s.allowed);
  const enabled = useEntitlementsStore((s) => s.enabled);
  const isOwner = useAuthStore((s) => s.user?.isOwner === true);

  return useCallback(
    (key: FeatureKey | null | undefined) =>
      key != null && isOwner && loaded && allowed.includes(key) && enabled[key] !== true,
    [loaded, allowed, enabled, isOwner],
  );
}

/**
 * Load the org's entitlements once, as soon as there is a session to load them for.
 *
 * Mounted by `AuthGuard`, which is the first thing inside the authenticated tree — the nav and the
 * route guard both read the result. A failure is swallowed: entitlements are a UX gate, so an
 * unreachable endpoint must degrade to "show everything" rather than lock the user out of their
 * own app. The server still refuses anything the org isn't entitled to.
 */
export function useEntitlementsSync(active: boolean): void {
  const hydrate = useEntitlementsStore((s) => s.hydrate);

  useEffect(() => {
    if (!active) return;
    let live = true;
    getEntitlements()
      .then((e) => {
        if (live) hydrate({ allowed: e.allowed, enabled: e.enabled });
      })
      .catch(() => {
        /* Stay fail-open — see the doc comment. */
      });
    return () => {
      live = false;
    };
  }, [active, hydrate]);
}

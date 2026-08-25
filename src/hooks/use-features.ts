"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useCallback, useEffect } from "react";
import { getEntitlements } from "@/lib/api";
import { effectiveFromState, useEntitlementsStore } from "@/stores/entitlements.store";
import type { FeatureKey } from "@/stores/features.store";
import { MODE_HIDDEN_FEATURES } from "@/constants/features";
import type { TrackingMode } from "@/lib/tracking-mode";

/**
 * `(key) => boolean` for the org's effective features, re-computed when entitlements land.
 *
 * Subscribes to the shared store, so the nav re-filters itself the moment the fetch resolves (and
 * again if an owner toggles a feature and the store is re-hydrated).
 */
/**
 * Is the signed-in user the organization Owner?
 *
 * Two sources, because the `User` object is **persisted** in `wp-auth`. `isOwner` is only written by
 * `toUser()` at sign-in, so every session that existed before that field did carries `undefined` —
 * and an `=== true` check silently reads the Owner as an ordinary user until they happen to log out
 * and back in. That is not an acceptable upgrade path for a gate that decides what they can see.
 *
 * `roleId === "role-owner"` is the fallback for those sessions: `toUser` assigns exactly that id
 * when the token says `is_owner` and carries no custom role. It is a *fallback*, not the primary —
 * an Owner who also holds a custom role gets that id instead, which is why the explicit flag exists
 * and wins once the session is refreshed.
 */
export function isOwnerOf(s: {
  user?: { isOwner?: boolean; roleId?: string } | null;
}): boolean {
  return s.user?.isOwner === true || s.user?.roleId === "role-owner";
}

export function useIsFeatureOn(): (key: FeatureKey) => boolean {
  const loaded = useEntitlementsStore((s) => s.loaded);
  const allowed = useEntitlementsStore((s) => s.allowed);
  const enabled = useEntitlementsStore((s) => s.enabled);
  const isOwner = useAuthStore(isOwnerOf);

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

/** The org's tracking mode (MANAGED-AGENT.md §4). Defaults `project` until entitlements load. */
export function useTrackingMode(): TrackingMode {
  return useEntitlementsStore((s) => s.trackingMode);
}

/**
 * `(key) => boolean` — the plan/owner gate **and** the org's tracking mode (layer 3).
 *
 * Use this for anything a **user can see**. `useIsFeatureOn` remains the plan/owner layer alone (for
 * the Features tab's "Off for others" markers, which must not be hidden by the mode).
 *
 * ⚠️ **The Owner exemption does NOT extend to the mode.** `useIsFeatureOn` exempts the Owner from
 * layer 2 so they can reach the switch they turned off. There is no equivalent switch inside a
 * mode-hidden surface — the control lives on `/settings/organization` — and an Owner seeing a
 * Projects rail item that literally nobody else in the org has reads as a bug, not a courtesy
 * (MANAGED-AGENT.md §8).
 */
export function useIsSurfaceOn(): (key: FeatureKey) => boolean {
  const isFeatureOn = useIsFeatureOn();
  const mode = useTrackingMode();
  return useCallback(
    (key: FeatureKey) =>
      isFeatureOn(key) && !MODE_HIDDEN_FEATURES[mode].includes(key),
    [isFeatureOn, mode],
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
  const isOwner = useAuthStore(isOwnerOf);

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
        if (live)
          hydrate({
            allowed: e.allowed,
            enabled: e.enabled,
            tracking_mode: e.tracking_mode,
          });
      })
      .catch(() => {
        /* Stay fail-open — see the doc comment. */
      });
    return () => {
      live = false;
    };
  }, [active, hydrate]);
}

/**
 * Is this page visible for the caller? Layer 3 — org preference, on top of plan and permission.
 *
 * **Absent key means visible.** A page nobody has toggled needs no stored entry, and a renamed
 * route fails OPEN rather than silently disappearing — the safe direction for a visibility rule
 * layered over gates that already deny properly.
 *
 * **Owners are exempt**, exactly as they are from feature toggles: an org that hid a page must
 * always have someone who can still reach it to un-hide it. `/settings/*` is additionally never
 * toggleable server-side, so nobody can hide the page holding the switches.
 */
export function useIsPageOn(): (href: string) => boolean {
  const pages = useEntitlementsStore((s) => s.pages);
  const isOwner = useAuthStore(isOwnerOf);
  return useCallback(
    (href: string) => {
      if (isOwner) return true;
      // Longest-prefix match, so hiding `/insights` hides its tabs without listing each one, while
      // a tab may still be hidden on its own.
      let hidden = false;
      let best = -1;
      for (const [key, on] of Object.entries(pages)) {
        if ((href === key || href.startsWith(`${key}/`)) && key.length > best) {
          best = key.length;
          hidden = !on;
        }
      }
      return !hidden;
    },
    [pages, isOwner],
  );
}

"use client";

import { useAuthStore } from "@/stores/auth.store";
import { useCallback, useEffect } from "react";
import { ApiError, getEntitlements } from "@/lib/api";
import { effectiveFromState, useEntitlementsStore } from "@/stores/entitlements.store";
import type { FeatureKey } from "@/stores/features.store";
import { MODE_HIDDEN_FEATURES, featureForPath } from "@/constants/features";
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

/**
 * `(key) => boolean` — is the feature in the org's **plan** at all (layer 1, the ceiling)?
 *
 * Distinct from {@link useIsFeatureOn}, which also folds in the on/off toggle. This answers *why* a
 * feature is unavailable: `false` here means the **plan** doesn't include it (→ "Upgrade"), whereas
 * `useIsFeatureOn` false with this `true` means the org **toggled it off** (→ "enable in Settings").
 * Returns `true` while entitlements load, so a gate never flashes "upgrade" before the plan is known.
 */
export function useIsFeatureAllowed(): (key: FeatureKey) => boolean {
  const loaded = useEntitlementsStore((s) => s.loaded);
  const allowed = useEntitlementsStore((s) => s.allowed);
  return useCallback(
    (key: FeatureKey) => !loaded || allowed.includes(key),
    [loaded, allowed],
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
 * Quick retries for a failed entitlements read, then a slow heal-loop. A single failed read used to
 * leave every hidden page and mode-hidden section open for the rest of the session — it was never
 * retried (QA audit 2026-10-08, WP-317).
 */
const QUICK_RETRY_MS = [1_000, 3_000, 8_000];
const SLOW_RETRY_MS = 60_000;

/** A refusal no retry will change (bar a timeout or a throttle) — stop asking. */
function isPermanent(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    e.status >= 400 &&
    e.status < 500 &&
    e.status !== 408 &&
    e.status !== 429
  );
}

/**
 * Load the org's entitlements as soon as there is a session to load them for.
 *
 * Mounted by `AuthGuard`, which is the first thing inside the authenticated tree — the nav and the
 * route guard both read the result. Every field is hydrated, not a hand-picked subset: anything
 * omitted is simply absent for every surface outside Settings (omitting `pages` once meant page
 * toggles took effect nowhere else).
 *
 * A failed read is retried, quickly at first. Once the quick retries are spent the store is marked
 * `failed`: the gates run **fail-open** — entitlements are a UX gate, so an unreachable endpoint must
 * not lock someone out of their own app, and the server still refuses any feature the org isn't
 * entitled to — while a slow retry keeps trying, so a transient fault no longer lasts the session.
 */
export function useEntitlementsSync(active: boolean): void {
  const hydrate = useEntitlementsStore((s) => s.hydrate);
  const markFailed = useEntitlementsStore((s) => s.markFailed);

  useEffect(() => {
    if (!active) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = (n: number) => {
      getEntitlements()
        .then((e) => {
          if (live) hydrate(e);
        })
        .catch((e) => {
          if (!live) return;
          const permanent = isPermanent(e);
          if (permanent || n >= QUICK_RETRY_MS.length) markFailed();
          if (!permanent) {
            timer = setTimeout(() => attempt(n + 1), QUICK_RETRY_MS[n] ?? SLOW_RETRY_MS);
          }
        });
    };
    attempt(0);
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [active, hydrate, markFailed]);
}

/**
 * Has the entitlements gate settled — loaded, or given up and running fail-open?
 *
 * Until it has, `AuthGuard` holds back any page a feature, mode or page toggle could close, rather
 * than mounting it: a gated page used to mount, fire its requests and paint real data before being
 * swapped for "This page is turned off" (QA audit 2026-10-08, WP-317).
 */
export function useEntitlementsSettled(): boolean {
  return useEntitlementsStore((s) => s.loaded || s.failed);
}

/**
 * Could the org's entitlements close this path — a plan feature, the tracking mode, or a page toggle?
 * Everything outside {@link ALWAYS_VISIBLE} can be hidden by a page toggle; under it, only a route
 * with its own feature key (e.g. `/settings/integrations`).
 */
export function isEntitlementGated(pathname: string): boolean {
  if (featureForPath(pathname)) return true;
  return !ALWAYS_VISIBLE.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Re-read the org's entitlements into the shared store — after a write that changes them, so the
 * sidebar, route guard and upgrade walls follow at once instead of at the next full page load.
 *
 * With `untilPlan`, keeps asking until the server reports that plan: a plan change reaches the
 * entitlements item asynchronously (`billing.plan_changed` → identity), so the first read can still
 * carry the old one. Resolves whether the store now reflects it.
 */
export async function refreshEntitlements(untilPlan?: string): Promise<boolean> {
  const waits = untilPlan ? [0, 1_000, 2_000, 4_000, 8_000] : [0];
  for (const wait of waits) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      const e = await getEntitlements();
      useEntitlementsStore.getState().hydrate(e);
      if (!untilPlan || e.plan === untilPlan) return true;
    } catch {
      // Keep the copy we have; a later attempt (or the next page load) catches up.
    }
  }
  return false;
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
/**
 * Routes no toggle can hide.
 *
 * `/dashboard` is the app's home: every "back to safety" affordance in the UI — including the
 * button on the "this page is turned off" screen itself — lands there, so hiding it would strand a
 * user in a loop with nowhere to go. `/settings` holds the switches, so hiding it would make the
 * hiding irreversible.
 *
 * The server refuses to store either (identity::toggle_feature). This is the client half of the
 * same rule, which is what covers an org that hid one *before* the guard existed.
 */
const ALWAYS_VISIBLE = ["/dashboard", "/settings"] as const;

export function useIsPageOn(): (href: string) => boolean {
  const pages = useEntitlementsStore((s) => s.pages);
  const isOwner = useAuthStore(isOwnerOf);
  return useCallback(
    (href: string) => {
      if (isOwner) return true;
      if (ALWAYS_VISIBLE.some((p) => href === p || href.startsWith(`${p}/`))) {
        return true;
      }
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

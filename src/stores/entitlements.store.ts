import { create } from "zustand";
import { trackingModeOf, type TrackingMode } from "@/lib/tracking-mode";

/**
 * The org's live entitlements, fetched **once** per session and read everywhere.
 *
 * `modules/settings/use-entitlements` fetches per-mount, which is right for the Features page but
 * wrong for the nav and the route guard — those would each re-fetch on every render pass. This
 * store is the shared, already-resolved copy they read.
 *
 * Not persisted, on purpose: entitlements are org state that an owner can change at any moment, and
 * a stale localStorage copy would keep showing a section the org has since switched off.
 */
interface EntitlementsState {
  /** False until the first successful fetch — see `isFeatureOn` for why that matters. */
  loaded: boolean;
  /** Keys the plan permits (layer 1). */
  allowed: string[];
  /** The owner's per-key activation flags (layer 2). */
  enabled: Record<string, boolean>;
  /** The org's tracking mode (layer 3 — MANAGED-AGENT.md §4). Defaults `project` until loaded. */
  trackingMode: TrackingMode;
  hydrate: (e: {
    allowed: string[];
    enabled: Record<string, boolean>;
    tracking_mode?: string;
  }) => void;
  clear: () => void;
}

export const useEntitlementsStore = create<EntitlementsState>()((set) => ({
  loaded: false,
  allowed: [],
  enabled: {},
  trackingMode: "project",
  hydrate: (e) =>
    set({
      loaded: true,
      allowed: e.allowed,
      enabled: e.enabled,
      trackingMode: trackingModeOf(e.tracking_mode),
    }),
  clear: () =>
    set({ loaded: false, allowed: [], enabled: {}, trackingMode: "project" }),
}));

/**
 * `effective(key) = key ∈ allowed && enabled[key]` — both layers (LLD §1).
 *
 * **Fails OPEN before the first fetch resolves**, which is the opposite of the Features page's
 * `effective()`. That page fails closed so it never offers a toggle the plan would refuse; here the
 * cost is reversed. Failing closed would blank half the sidebar on every page load and then pop the
 * items back in — a visible flicker on every navigation, for a gate that is only ever cosmetic. The
 * server rejects a disabled feature regardless of what this returns.
 */
export function effectiveFromState(
  state: Pick<EntitlementsState, "loaded" | "allowed" | "enabled">,
  key: string,
): boolean {
  if (!state.loaded) return true;
  return state.allowed.includes(key) && state.enabled[key] === true;
}

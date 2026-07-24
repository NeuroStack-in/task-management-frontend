import { create } from "zustand";

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
  hydrate: (e: { allowed: string[]; enabled: Record<string, boolean> }) => void;
  clear: () => void;
}

export const useEntitlementsStore = create<EntitlementsState>()((set) => ({
  loaded: false,
  allowed: [],
  enabled: {},
  hydrate: (e) =>
    set({ loaded: true, allowed: e.allowed, enabled: e.enabled }),
  clear: () => set({ loaded: false, allowed: [], enabled: {} }),
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

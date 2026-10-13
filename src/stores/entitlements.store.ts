import { create } from "zustand";
import { trackingModeOf, type TrackingMode } from "@/lib/tracking-mode";

/**
 * The org's live entitlements, fetched once per session (and again after a write that changes them —
 * a feature toggle, a plan change) and read everywhere.
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
  /**
   * The first read failed and its quick retries are spent, so the gates run fail-open while a slow
   * retry keeps trying (`useEntitlementsSync`). Together with `loaded` it says the gate has
   * *settled* — until then the route guard holds gated pages back rather than mounting them.
   */
  failed: boolean;
  /** Keys the plan permits (layer 1). */
  allowed: string[];
  /** The owner's per-key activation flags (layer 2). */
  enabled: Record<string, boolean>;
  /**
   * Page-level visibility, keyed by href. Layer 3: org preference, NOT plan-gated — a page can be
   * hidden regardless of plan, and hiding one never touches billing. Absent key ⇒ visible, so a
   * route nobody has ever toggled needs no entry and a renamed route fails OPEN rather than
   * vanishing.
   */
  pages: Record<string, boolean>;
  /** Who hid each page, and whether this caller may show it again. Same shape as features. */
  pagesDisabledBy: Record<
    string,
    { by_user?: string; by_owner: boolean; at?: number; locked: boolean }
  >;
  /** Who disabled each off feature, and whether this caller may re-enable it. */
  disabledBy: Record<
    string,
    { by_user?: string; by_owner: boolean; at?: number; locked: boolean }
  >;
  /** The org's tracking mode (layer 3 — MANAGED-AGENT.md §4). Defaults `project` until loaded. */
  trackingMode: TrackingMode;
  hydrate: (e: {
    allowed: string[];
    enabled: Record<string, boolean>;
    disabled_by?: Record<
      string,
      { by_user?: string; by_owner: boolean; at?: number; locked: boolean }
    >;
    pages?: Record<string, boolean>;
    pages_disabled_by?: Record<
      string,
      { by_user?: string; by_owner: boolean; at?: number; locked: boolean }
    >;
    tracking_mode?: string;
  }) => void;
  markFailed: () => void;
}

export const useEntitlementsStore = create<EntitlementsState>()((set) => ({
  loaded: false,
  failed: false,
  allowed: [],
  enabled: {},
  disabledBy: {},
  pages: {},
  pagesDisabledBy: {},
  trackingMode: "project",
  hydrate: (e) =>
    set({
      loaded: true,
      failed: false,
      allowed: e.allowed,
      disabledBy: e.disabled_by ?? {},
      pages: e.pages ?? {},
      pagesDisabledBy: e.pages_disabled_by ?? {},
      enabled: e.enabled,
      trackingMode: trackingModeOf(e.tracking_mode),
    }),
  // No `clear()`: it had no caller (QA audit 2026-10-08, WP-528). The next sign-in re-runs
  // `useEntitlementsSync`, and `hydrate` replaces every field.
  markFailed: () => set({ failed: true }),
}));

/**
 * `effective(key) = key ∈ allowed && enabled[key]` — both layers (LLD §1).
 *
 * **Fails OPEN before the first fetch resolves**, which is the opposite of the Features page's
 * `effective()`. That page fails closed so it never offers a toggle the plan would refuse; here the
 * cost is reversed. Failing closed would blank half the sidebar on every page load and then pop the
 * items back in — a visible flicker on every navigation, for a gate that is only ever cosmetic. The
 * server rejects a disabled feature regardless of what this returns. Pages are a different matter:
 * `AuthGuard` holds any page an entitlement could close behind a loader until the read settles
 * (`useEntitlementsSettled`), so fail-open here shapes only the sidebar in that moment.
 */
export function effectiveFromState(
  state: Pick<EntitlementsState, "loaded" | "allowed" | "enabled">,
  key: string,
): boolean {
  if (!state.loaded) return true;
  return state.allowed.includes(key) && state.enabled[key] === true;
}

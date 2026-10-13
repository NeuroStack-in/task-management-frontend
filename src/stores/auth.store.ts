import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSession, User } from "@/types/user";
import { onSessionExpired } from "@/lib/api";
import { onFreshSession, sessionStatus } from "@/lib/cognito";
import { ephemeralSessionEnded, markSessionPersistence } from "@/lib/session-persistence";
import {
  authorityOf,
  clearWorkPulseState,
  completeSso as completeSsoService,
  completeTotpChallenge,
  login as loginService,
  logout as logoutService,
  reestablishSession,
  toSession,
} from "@/modules/auth/services/auth.service";

interface AuthState {
  session: AuthSession | null;
  user: User | null;
  isAuthenticated: boolean;
  /** Hydration flag — true once the persisted store has loaded on the client. */
  hydrated: boolean;
  /** `remember` is the login form's "Keep me signed in on this device" (default true). */
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  /** Finish a TOTP-challenged sign-in (login threw `TotpChallengeError` → /mfa page). */
  completeMfa: (code: string) => Promise<void>;
  /** Finish a federated (SSO) sign-in on the /callback route (PKCE exchange → session). */
  completeSso: () => Promise<void>;
  logout: () => void;
  /** Patch the signed-in user (self-service profile edits). Persisted. */
  updateUser: (patch: Partial<User>) => void;
  /** Force-refresh the token and re-project its claims — after self-service org provisioning, so the
   *  new tenant/owner claims take effect without a full sign-out/in. Resolves whether it did: a
   *  refresh that fails resolves `false` rather than leaving the caller waiting forever. */
  refreshClaims: () => Promise<boolean>;
  setHydrated: () => void;
}

/**
 * Set when a sign-in on this page replaced a *different* user who was still signed in here — an
 * invite opened in an owner's browser, a Google sign-in over someone else's session. Clearing the
 * `wp-*` keys is not enough on its own: every store this page already loaded still holds the
 * previous user's state in memory, and a persisted one writes it straight back on its next update.
 * Only a full page load drops it, so {@link landAfterSignIn} turns the next navigation into one
 * (QA audit 2026-10-08, WP-387).
 */
let replacedAnotherUser = false;

function replaceUser(): void {
  // The "keep me signed in" choice was recorded for *this* sign-in a moment ago — keep it.
  clearWorkPulseState(["wp-ephemeral"]);
  replacedAnotherUser = true;
}

/**
 * Navigate into the app after a sign-in completed on this page: a client-side navigation, or a full
 * page load when that sign-in replaced another user (see `replacedAnotherUser`). Anything a stale
 * store wrote back since the sign-in is cleared first; the new session's `wp-auth` stays.
 */
export function landAfterSignIn(router: { replace: (href: string) => void }, href: string): void {
  if (!replacedAnotherUser || typeof window === "undefined") {
    router.replace(href);
    return;
  }
  clearWorkPulseState(["wp-auth", "wp-ephemeral"]);
  window.location.replace(href);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      isAuthenticated: false,
      hydrated: false,

      login: async (email, password, remember = true) => {
        // Before the attempt: a TOTP challenge finishes on another page, which can't see the box.
        markSessionPersistence(remember);
        const prevUserId = get().user?.id;
        const { session, user } = await loginService(email, password);
        // Signing in as a *different* user without a prior logout (e.g. an expired session, or a
        // shared machine) must not inherit the previous user's cached org state.
        if (prevUserId && prevUserId !== user.id) replaceUser();
        set({ session, user, isAuthenticated: true });
      },

      completeMfa: async (code) => {
        const prevUserId = get().user?.id;
        const { session, user } = await completeTotpChallenge(code);
        if (prevUserId && prevUserId !== user.id) replaceUser();
        set({ session, user, isAuthenticated: true });
      },

      completeSso: async () => {
        // Google sign-in has no "keep me signed in" box: it is remembered, as before.
        markSessionPersistence(true);
        const prevUserId = get().user?.id;
        const { session, user } = await completeSsoService();
        if (prevUserId && prevUserId !== user.id) replaceUser();
        set({ session, user, isAuthenticated: true });
      },

      logout: () => {
        // Clear the Cognito session (its tokens live in localStorage) as well as our own state.
        logoutService();
        set({ session: null, user: null, isAuthenticated: false });
      },

      updateUser: (patch) =>
        set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),

      refreshClaims: async () => {
        const r = await reestablishSession();
        if (r) set({ session: r.session, user: r.user, isAuthenticated: true });
        return Boolean(r);
      },

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "wp-auth",
      // Not `session`: it is a second copy of the id token that nothing reads — every API call takes
      // a fresh token from Cognito's own store (`lib/cognito.getIdToken`). Not the avatar URL either:
      // it is a presign that expires, and `AvatarSync` fetches a fresh one on every load — which is
      // what its comment always said, while `updateUser` was quietly persisting it (WP-394).
      partialize: (s) => ({
        user: s.user ? { ...s.user, avatarUrl: undefined } : null,
        isAuthenticated: s.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // `wp-auth` unreadable (corrupt JSON): persist reports no state and never reaches its success
        // path, so `hydrated` stayed false and every guarded page showed its loader forever (QA audit
        // 2026-10-08, WP-129). Nothing to restore — start signed out. Deferred: this runs while the
        // store is still being created.
        if (!state) {
          queueMicrotask(() => useAuthStore.getState().setHydrated());
          return;
        }
        if (!state.isAuthenticated) return state.setHydrated();
        // A sign-in that asked not to be remembered, found again in a new browser session (WP-123).
        if (ephemeralSessionEnded()) {
          state.logout();
          return state.setHydrated();
        }
        // The persisted flag only remembers that someone signed in once. Check the Cognito session
        // is still there before the app trusts it: a refresh token that expired, a disabled user or
        // a sign-out in another tab used to leave the shell rendering with every request failing,
        // and /login bounced straight back to it (QA audit 2026-10-08, WP-011). "Offline" is no
        // verdict, so it keeps the session.
        void sessionStatus().then((s) => {
          if (s === "gone") state.logout();
          state.setHydrated();
        });
      },
    },
  ),
);

// Site data blocked (a hardened browser profile): `persist` found no storage, so it never hydrated
// and never called back — the same endless loader (WP-129). Nothing was persisted, so there is
// nothing to restore; sign-in still works, as the Cognito SDK falls back to memory.
if (typeof window !== "undefined" && !useAuthStore.persist) {
  useAuthStore.setState({ hydrated: true });
}

/**
 * A newer id token is in use (a silent refresh, or the first token after a reload): re-apply the
 * role, permissions, owner flag and organization it carries, so a role change reaches the sidebar,
 * the route guard and every `can()` within one token lifetime instead of at the next sign-in
 * (QA audit 2026-10-08, WP-093). A token for someone else is the cross-tab listener's business.
 */
onFreshSession((session) => {
  const { isAuthenticated, user } = useAuthStore.getState();
  if (!isAuthenticated || !user) return;
  const authority = authorityOf(session);
  if (authority.id !== user.id) return;
  const changed =
    authority.roleId !== user.roleId ||
    authority.isOwner !== user.isOwner ||
    authority.organizationId !== user.organizationId ||
    authority.perm !== user.perm;
  if (!changed) return;
  useAuthStore.setState({ user: { ...user, ...authority }, session: toSession(session) });
});

/** The API refused a request because the session behind it is gone: sign out here as well. */
onSessionExpired(() => {
  if (useAuthStore.getState().isAuthenticated) useAuthStore.getState().logout();
});

// Signed out — or signed in as someone else — in another tab: `wp-auth` changed there. Reload rather
// than waiting for this tab's next request to fail. A reload, not `logout()`: the Cognito tokens and
// `wp-auth` are shared by every tab, so writing them here could undo a sign-in the other tab is in
// the middle of. Reloading only drops this tab's memory and re-reads what the other tab left.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== "wp-auth" && e.key !== null) return;
    const here = useAuthStore.getState();
    if (!here.isAuthenticated) return;
    let there: { isAuthenticated?: boolean; user?: { id?: string } } | undefined;
    try {
      there = e.newValue ? JSON.parse(e.newValue)?.state : undefined;
    } catch {
      return;
    }
    if (!there?.isAuthenticated || there.user?.id !== here.user?.id) {
      window.location.reload();
    }
  });
}

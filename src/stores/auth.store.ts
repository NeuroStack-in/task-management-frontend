import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSession, User } from "@/types/user";
import {
  clearWorkPulseState,
  completeSso as completeSsoService,
  completeTotpChallenge,
  login as loginService,
  logout as logoutService,
} from "@/modules/auth/services/auth.service";

interface AuthState {
  session: AuthSession | null;
  user: User | null;
  isAuthenticated: boolean;
  /** Hydration flag — true once the persisted store has loaded on the client. */
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Finish a TOTP-challenged sign-in (login threw `TotpChallengeError` → /mfa page). */
  completeMfa: (code: string) => Promise<void>;
  /** Finish a federated (SSO) sign-in on the /callback route (PKCE exchange → session). */
  completeSso: () => Promise<void>;
  logout: () => void;
  /** Patch the signed-in user (self-service profile edits). Persisted. */
  updateUser: (patch: Partial<User>) => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      isAuthenticated: false,
      hydrated: false,

      login: async (email, password) => {
        const prevUserId = get().user?.id;
        const { session, user } = await loginService(email, password);
        // Signing in as a *different* user without a prior logout (e.g. an expired session, or a
        // shared machine) must not inherit the previous user's cached org state.
        if (prevUserId && prevUserId !== user.id) clearWorkPulseState();
        set({ session, user, isAuthenticated: true });
      },

      completeMfa: async (code) => {
        const prevUserId = get().user?.id;
        const { session, user } = await completeTotpChallenge(code);
        if (prevUserId && prevUserId !== user.id) clearWorkPulseState();
        set({ session, user, isAuthenticated: true });
      },

      completeSso: async () => {
        const prevUserId = get().user?.id;
        const { session, user } = await completeSsoService();
        if (prevUserId && prevUserId !== user.id) clearWorkPulseState();
        set({ session, user, isAuthenticated: true });
      },

      logout: () => {
        // Clear the Cognito session (its tokens live in localStorage) as well as our own state.
        logoutService();
        set({ session: null, user: null, isAuthenticated: false });
      },

      updateUser: (patch) =>
        set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),

      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "wp-auth",
      partialize: (s) => ({
        session: s.session,
        user: s.user,
        isAuthenticated: s.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

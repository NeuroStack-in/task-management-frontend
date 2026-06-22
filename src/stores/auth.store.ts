import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSession, User } from "@/types/user";
import { login as loginService } from "@/modules/auth/services/auth.service";

interface AuthState {
  session: AuthSession | null;
  user: User | null;
  isAuthenticated: boolean;
  /** Hydration flag — true once the persisted store has loaded on the client. */
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      isAuthenticated: false,
      hydrated: false,

      login: async (email, password) => {
        const { session, user } = await loginService(email, password);
        set({ session, user, isAuthenticated: true });
      },

      logout: () => set({ session: null, user: null, isAuthenticated: false }),

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

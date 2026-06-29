import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AccountSecurityState {
  /** Whether the signed-in user has two-factor auth enabled (per-device demo). */
  twoFactorEnabled: boolean;
  setTwoFactor: (on: boolean) => void;
}

export const useAccountSecurityStore = create<AccountSecurityState>()(
  persist(
    (set) => ({
      twoFactorEnabled: false,
      setTwoFactor: (on) => set({ twoFactorEnabled: on }),
    }),
    { name: "wp-account-security" },
  ),
);

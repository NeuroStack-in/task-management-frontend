import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  /** Desktop sidebar collapsed to the icon-only rail. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  /**
   * Monotonic counter bumped to ask the inline sidebar search to focus itself.
   * Used when the collapsed rail's search button expands the sidebar — the
   * SidebarSearch input watches this and grabs focus on change. Not persisted.
   */
  searchFocusNonce: number;
  requestSearchFocus: () => void;
  /**
   * The agent release the user has already been shown, e.g. `"0.1.7"`. Empty until they acknowledge
   * one.
   *
   * Stored as the **version**, not a boolean, so the notice returns by itself on every future
   * release: bumping `AGENT_RELEASE_VERSION` makes the stored value stale and the dot comes back
   * exactly once. A boolean would have to be hand-reset each time, and would be forgotten.
   */
  agentReleaseSeen: string;
  markAgentReleaseSeen: (version: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      searchFocusNonce: 0,
      requestSearchFocus: () =>
        set((s) => ({ searchFocusNonce: s.searchFocusNonce + 1 })),
      agentReleaseSeen: "",
      markAgentReleaseSeen: (version) => set({ agentReleaseSeen: version }),
    }),
    {
      name: "wp-ui",
      // The sidebar preference and the acknowledged agent release persist.
      //
      // `wp-ui` specifically, and not a store of its own: it is the one key `clearWorkPulseState()`
      // spares on logout. Anywhere else the dot would come back every time the user signed out and
      // in again, which is the opposite of "don't show it again".
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        agentReleaseSeen: s.agentReleaseSeen,
      }),
    },
  ),
);

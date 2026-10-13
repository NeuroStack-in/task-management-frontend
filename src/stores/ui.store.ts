import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  /**
   * The user's own choice: desktop sidebar collapsed to the icon-only rail. Persisted, and what every
   * page outside Settings uses — read it through {@link isSidebarCollapsed}.
   */
  sidebarCollapsed: boolean;
  /**
   * On a Settings route. Settings has its own section rail, so the sidebar *starts* collapsed there —
   * as a default for the visit, not a write over the user's choice. The shell used to set
   * `sidebarCollapsed` from the pathname on every navigation, so a manual collapse never survived a
   * click or a reload (QA audit 2026-10-08, WP-358). Not persisted.
   */
  inSettings: boolean;
  /** The user expanded the sidebar during this Settings visit. Not persisted. */
  settingsExpanded: boolean;
  setInSettings: (inSettings: boolean) => void;
  /** Toggle / set what's on screen — the visit override in Settings, the preference elsewhere. */
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
   * release: a new version in the release manifest makes the stored value stale and the dot comes
   * back exactly once. A boolean would have to be hand-reset each time, and would be forgotten.
   */
  agentReleaseSeen: string;
  markAgentReleaseSeen: (version: string) => void;
}

/** Whether the sidebar is collapsed right now — the Settings visit default, or the user's choice. */
export const isSidebarCollapsed = (s: UiState): boolean =>
  s.inSettings ? !s.settingsExpanded : s.sidebarCollapsed;

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      inSettings: false,
      settingsExpanded: false,
      // Entering or leaving Settings drops the visit's override, so each visit starts collapsed.
      setInSettings: (inSettings) =>
        set((s) => (s.inSettings === inSettings ? s : { inSettings, settingsExpanded: false })),
      toggleSidebar: () =>
        set((s) =>
          s.inSettings
            ? { settingsExpanded: !s.settingsExpanded }
            : { sidebarCollapsed: !s.sidebarCollapsed },
        ),
      setSidebarCollapsed: (collapsed) =>
        set((s) => (s.inSettings ? { settingsExpanded: !collapsed } : { sidebarCollapsed: collapsed })),
      searchFocusNonce: 0,
      requestSearchFocus: () =>
        set((s) => ({ searchFocusNonce: s.searchFocusNonce + 1 })),
      agentReleaseSeen: "",
      markAgentReleaseSeen: (version) => set({ agentReleaseSeen: version }),
    }),
    {
      name: "wp-ui",
      // The sidebar preference and the acknowledged agent release persist (never the Settings
      // visit state, which is per route).
      //
      // `wp-ui` specifically, and not a store of its own: it is one of the device-only keys
      // `clearWorkPulseState()` spares on logout. Anywhere else the dot would come back every time
      // the user signed out and in again, which is the opposite of "don't show it again".
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        agentReleaseSeen: s.agentReleaseSeen,
      }),
    },
  ),
);

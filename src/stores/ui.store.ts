import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  /** Desktop sidebar collapsed to the icon-only rail. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Global ⌘K command palette open state (not persisted). */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  /**
   * Monotonic counter bumped to ask the inline sidebar search to focus itself.
   * Used when the collapsed rail's search button expands the sidebar — the
   * SidebarSearch input watches this and grabs focus on change. Not persisted.
   */
  searchFocusNonce: number;
  requestSearchFocus: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      commandOpen: false,
      setCommandOpen: (open) => set({ commandOpen: open }),
      toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),
      searchFocusNonce: 0,
      requestSearchFocus: () =>
        set((s) => ({ searchFocusNonce: s.searchFocusNonce + 1 })),
    }),
    {
      name: "wp-ui",
      // Only the sidebar preference persists; the palette always starts closed.
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);

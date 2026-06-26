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
    }),
    {
      name: "wp-ui",
      // Only the sidebar preference persists; the palette always starts closed.
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);

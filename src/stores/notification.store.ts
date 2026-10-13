import { create } from "zustand";
import type { AppNotification } from "@/types";

/**
 * The notification feed the bell and the Notification Center share — seeded only from the server
 * (`modules/notifications/use-notifications`), never invented client-side.
 */
interface NotificationState {
  notifications: AppNotification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  seed: (items: AppNotification[]) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  remove: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  seed: (items) => set({ notifications: items }),
}));

import { create } from "zustand";
import type { AppNotification } from "@/types";

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: () => number;
  add: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  seed: (items: AppNotification[]) => void;
}

let notifCounter = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  unreadCount: () => get().notifications.filter((n) => !n.read).length,

  add: (n) =>
    set((s) => ({
      notifications: [
        {
          ...n,
          id: `notif-${(notifCounter += 1)}`,
          createdAt: Date.now(),
          read: false,
        },
        ...s.notifications,
      ],
    })),

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

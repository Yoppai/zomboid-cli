import { createStore } from 'zustand/vanilla';

// ── Types ──

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  readonly id: string;
  readonly type: NotificationType;
  readonly message: string;
  readonly timestamp: number;
}

export interface NotificationState {
  notifications: Notification[];
  add: (type: NotificationType, message: string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export type NotificationStore = ReturnType<typeof createNotificationStore>;

// ── Factory ──

export function createNotificationStore() {
  return createStore<NotificationState>((set) => ({
    notifications: [],

    add: (type, message) => {
      const id = crypto.randomUUID();
      const notification: Notification = {
        id,
        type,
        message,
        timestamp: Date.now(),
      };
      set((state) => ({
        notifications: [...state.notifications, notification],
      }));
      return id;
    },

    dismiss: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),

    clear: () => set({ notifications: [] }),
  }));
}

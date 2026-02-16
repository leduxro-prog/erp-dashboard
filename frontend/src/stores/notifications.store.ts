/**
 * Notifications Store (Zustand)
 */

import { create } from 'zustand';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

interface NotificationsState {
  unreadCount: number;
  recentNotifications: Notification[];
  allNotifications: Notification[];

  // Actions
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setNotifications: (notifications: Notification[]) => void;
  setUnreadCount: (count: number) => void;
  getUnreadCount: () => number;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  unreadCount: 0,
  recentNotifications: [],
  allNotifications: [],

  addNotification: (notification: Notification) => {
    set((state) => {
      const updated = [notification, ...state.recentNotifications];
      return {
        recentNotifications: updated.slice(0, 10),
        allNotifications: [notification, ...state.allNotifications],
        unreadCount: !notification.isRead ? state.unreadCount + 1 : state.unreadCount,
      };
    });
  },

  markAsRead: (id: string) => {
    set((state) => {
      const notification = state.allNotifications.find((n) => n.id === id);
      if (notification && !notification.isRead) {
        return {
          allNotifications: state.allNotifications.map((n) =>
            n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
          ),
          recentNotifications: state.recentNotifications.map((n) =>
            n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
          ),
          unreadCount: state.unreadCount - 1,
        };
      }
      return state;
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      allNotifications: state.allNotifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: new Date().toISOString(),
      })),
      recentNotifications: state.recentNotifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: new Date().toISOString(),
      })),
      unreadCount: 0,
    }));
  },

  removeNotification: (id: string) => {
    set((state) => {
      const notification = state.allNotifications.find((n) => n.id === id);
      const wasUnread = notification && !notification.isRead;
      return {
        allNotifications: state.allNotifications.filter((n) => n.id !== id),
        recentNotifications: state.recentNotifications.filter((n) => n.id !== id),
        unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
      };
    });
  },

  clearAll: () => {
    set({
      allNotifications: [],
      recentNotifications: [],
      unreadCount: 0,
    });
  },

  setNotifications: (notifications: Notification[]) => {
    const unreadCount = notifications.filter((n) => !n.isRead).length;
    set({
      allNotifications: notifications,
      recentNotifications: notifications.slice(0, 10),
      unreadCount,
    });
  },

  setUnreadCount: (count: number) => {
    set({ unreadCount: count });
  },

  getUnreadCount: () => {
    return get().unreadCount;
  },
}));

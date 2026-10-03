import { create } from 'zustand';
import { AppNotification, notificationsApi, TaskAssignment, tasksApi } from '@/lib/api';
import { playNotificationSound } from '@/lib/notification-sounds';

const REFRESH_MS = 30_000;

interface InboxState {
  notifications: AppNotification[];
  unreadCount: number;
  myTasks: TaskAssignment[];
  loaded: boolean;
  refresh: () => Promise<void>;
  markRead: (ids?: string[]) => Promise<void>;
  /** Starts refreshing every 30 s and when the window regains focus; returns the stop function. */
  startPolling: () => () => void;
}

/**
 * One inbox for the whole app: the bell, the sidebar counter and My tasks read
 * from here, and the sound plays here whenever the unread count goes up.
 */
export const useInboxStore = create<InboxState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  myTasks: [],
  loaded: false,

  refresh: async () => {
    try {
      const [inbox, myTasks] = await Promise.all([notificationsApi.list(), tasksApi.mine()]);
      const { loaded, unreadCount } = get();
      if (loaded && inbox.unread_count > unreadCount) playNotificationSound();
      set({ notifications: inbox.items, unreadCount: inbox.unread_count, myTasks, loaded: true });
    } catch {
      // Offline or signed out: keep what is shown; the next refresh retries.
    }
  },

  markRead: async (ids) => {
    const now = new Date().toISOString();
    set((s) => ({ notifications: s.notifications.map((n) => (!ids || ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)) }));
    const { unread_count } = await notificationsApi.markRead(ids);
    set({ unreadCount: unread_count });
  },

  startPolling: () => {
    // A new session starts from an empty inbox, so the first load never plays the sound.
    set({ notifications: [], unreadCount: 0, myTasks: [], loaded: false });
    const refresh = () => void get().refresh();
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  },
}));

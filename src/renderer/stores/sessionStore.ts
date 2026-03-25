import { create } from 'zustand';
import { ipc } from '../lib/ipc';
import type { Session, SessionStats, Activity, TopApp } from '../../shared/types';

interface TrackingStatus {
  isTracking: boolean;
  isPaused: boolean;
  currentActivity: Activity | null;
}

interface SessionStore {
  // State
  session: Session | null;
  stats: SessionStats | null;
  activities: Activity[];
  topApps: TopApp[];
  trackingStatus: TrackingStatus;
  isLoading: boolean;

  // Actions
  fetchSession: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchActivities: () => Promise<void>;
  fetchTopApps: () => Promise<void>;
  fetchTrackingStatus: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  stats: null,
  activities: [],
  topApps: [],
  trackingStatus: { isTracking: false, isPaused: false, currentActivity: null },
  isLoading: true,

  fetchSession: async () => {
    const session = await ipc<Session | null>('session:current');
    set({ session });
  },

  fetchStats: async () => {
    const stats = await ipc<SessionStats | null>('session:stats');
    set({ stats });
  },

  fetchActivities: async () => {
    const session = get().session;
    if (!session) return;
    const activities = await ipc<Activity[]>('activities:list', session.id);
    set({ activities: activities ?? [] });
  },

  fetchTopApps: async () => {
    const session = get().session;
    if (!session) return;
    const topApps = await ipc<TopApp[]>('activities:top-apps', session.id, 8);
    set({ topApps: topApps ?? [] });
  },

  fetchTrackingStatus: async () => {
    const status = await ipc<TrackingStatus>('tracking:status');
    if (status) set({ trackingStatus: status });
  },

  refreshAll: async () => {
    set({ isLoading: true });

    // Fetch session first — other calls depend on session.id being set
    const session = await ipc<Session | null>('session:current');
    set({ session });

    // Now fetch everything else in parallel using the session we just set
    const [stats, activities, topApps, status] = await Promise.all([
      ipc<SessionStats | null>('session:stats'),
      session ? ipc<Activity[]>('activities:list', session.id) : Promise.resolve([]),
      session ? ipc<TopApp[]>('activities:top-apps', session.id, 8) : Promise.resolve([]),
      ipc<TrackingStatus>('tracking:status'),
    ]);

    set({
      stats,
      activities: activities ?? [],
      topApps: topApps ?? [],
      trackingStatus: status ?? { isTracking: false, isPaused: false, currentActivity: null },
      isLoading: false,
    });
  },
}));

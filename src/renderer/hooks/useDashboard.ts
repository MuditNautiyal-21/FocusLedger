import { useEffect, useRef } from 'react';
import { useSessionStore } from '../stores/sessionStore';

const STATS_POLL_MS = 5_000;
const LIVE_POLL_MS = 1_000;

/**
 * Custom hook that drives the dashboard data lifecycle.
 * - On mount: full refresh
 * - Every 5s: refresh stats + top apps + activities
 * - Every 1s: refresh tracking status (live activity)
 */
export function useDashboard() {
  const store = useSessionStore();
  const statsRef = useRef<ReturnType<typeof setInterval>>();
  const liveRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    // Initial full load
    store.refreshAll();

    // 5-second stats polling
    statsRef.current = setInterval(() => {
      store.fetchStats();
      store.fetchTopApps();
      store.fetchActivities();
    }, STATS_POLL_MS);

    // 1-second live activity polling
    liveRef.current = setInterval(() => {
      store.fetchTrackingStatus();
    }, LIVE_POLL_MS);

    return () => {
      clearInterval(statsRef.current);
      clearInterval(liveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return store;
}

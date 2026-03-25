import { useMemo } from 'react';
import { useSessionStore } from '../../stores/sessionStore';

function formatStreak(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function FocusStreak() {
  const activities = useSessionStore((s) => s.activities);
  const trackingStatus = useSessionStore((s) => s.trackingStatus);

  const { currentStreak, bestStreak } = useMemo(() => {
    let current = 0;
    let best = 0;
    let streak = 0;

    // Walk activities from newest to oldest to find current streak
    const sorted = [...activities].sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    );

    // Current streak: consecutive productive from the end
    let foundNonProductive = false;
    for (const act of sorted) {
      if (!foundNonProductive && act.classification === 'productive') {
        current += act.duration_seconds;
      } else {
        foundNonProductive = true;
      }
    }

    // If the live activity is productive, add time since its start
    if (
      trackingStatus.currentActivity?.classification === 'productive' &&
      !foundNonProductive
    ) {
      const startMs = new Date(trackingStatus.currentActivity.started_at).getTime();
      current += Math.floor((Date.now() - startMs) / 1000);
    }

    // Best streak: longest consecutive productive run
    const chronological = [...activities].sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
    );
    for (const act of chronological) {
      if (act.classification === 'productive') {
        streak += act.duration_seconds;
        if (streak > best) best = streak;
      } else {
        streak = 0;
      }
    }

    if (current > best) best = current;

    return { currentStreak: current, bestStreak: best };
  }, [activities, trackingStatus.currentActivity]);

  const isActive = currentStreak > 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">&#128293;</span>
        <span className="text-xs font-medium text-txt-secondary uppercase tracking-wider">
          Focus Streak
        </span>
      </div>

      <div className="relative">
        <span
          className={`font-mono text-3xl font-semibold ${
            isActive ? 'text-productive' : 'text-txt-muted'
          }`}
        >
          {formatStreak(currentStreak)}
        </span>

        {/* Pulsing glow when active */}
        {isActive && (
          <div
            className="absolute -inset-3 rounded-lg opacity-20 animate-pulse-slow pointer-events-none"
            style={{ background: 'var(--productive-glow)' }}
          />
        )}
      </div>

      <p className="text-xs text-txt-muted mt-2">
        {isActive ? 'current focus' : 'no active streak'}
      </p>
      <p className="text-xs text-txt-muted">
        best today: {formatStreak(bestStreak)}
      </p>
    </div>
  );
}

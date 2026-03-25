import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSessionStore } from '../../stores/sessionStore';
import type { Classification } from '../../../../shared/types';

const dotColors: Record<Classification, string> = {
  productive: 'bg-productive',
  'non-productive': 'bg-wasted',
  neutral: 'bg-neutral',
  unclassified: 'bg-txt-muted',
};

const labelColors: Record<Classification, string> = {
  productive: 'text-productive',
  'non-productive': 'text-wasted',
  neutral: 'text-neutral',
  unclassified: 'text-txt-muted',
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function LiveActivity() {
  const { currentActivity } = useSessionStore((s) => s.trackingStatus);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!currentActivity) {
      setElapsed(0);
      return;
    }

    const update = () => {
      const startMs = new Date(currentActivity.started_at).getTime();
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [currentActivity?.id, currentActivity?.started_at]);

  const cls = currentActivity?.classification ?? 'unclassified';
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative">
          <div className={`w-2.5 h-2.5 rounded-full ${dotColors[cls]}`} />
          {cls === 'productive' && (
            <div className={`absolute inset-0 rounded-full ${dotColors[cls]} animate-ping opacity-40`} />
          )}
        </div>
        <span className="text-xs font-medium text-txt-secondary uppercase tracking-wider">
          Live Activity
        </span>
      </div>

      <AnimatePresence mode="wait">
        {currentActivity ? (
          <motion.div
            key={currentActivity.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between"
          >
            {/* Left: app info */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-txt-primary truncate">
                {currentActivity.app_name}
                {currentActivity.window_title && (
                  <span className="text-txt-muted font-normal">
                    {' — "'}
                    {currentActivity.window_title.length > 50
                      ? currentActivity.window_title.substring(0, 47) + '...'
                      : currentActivity.window_title}
                    {'"'}
                  </span>
                )}
              </p>

              <div className="flex items-center gap-2 mt-1">
                {/* Classification badge */}
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${labelColors[cls]}`}
                  style={{
                    backgroundColor:
                      cls === 'productive'
                        ? 'var(--productive-glow)'
                        : cls === 'non-productive'
                          ? 'var(--wasted-glow)'
                          : 'rgba(107,114,128,0.15)',
                  }}
                >
                  {cls === 'productive' ? '✅ Productive' : cls === 'non-productive' ? '❌ Wasted' : cls === 'neutral' ? '⚪ Neutral' : '⬜ Unclassified'}
                </span>

                {currentActivity.category && (
                  <span className="text-xs text-txt-muted">
                    · {currentActivity.category}
                  </span>
                )}
              </div>
            </div>

            {/* Right: live timer */}
            <div className="ml-4 shrink-0 text-right">
              <span className="font-mono text-lg text-txt-secondary">
                {pad(h)}:{pad(m)}:{pad(s)}
              </span>
              <p className="text-[10px] text-txt-muted">(live)</p>
            </div>
          </motion.div>
        ) : (
          <motion.p
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-txt-muted"
          >
            No active window detected
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

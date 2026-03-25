import { motion } from 'framer-motion';
import { useSessionStore } from '../../stores/sessionStore';
import type { Classification } from '../../../../shared/types';

const classColors: Record<Classification, string> = {
  productive: 'var(--productive)',
  'non-productive': 'var(--wasted)',
  neutral: 'var(--neutral)',
  unclassified: '#334155',
};

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function TopApps() {
  const topApps = useSessionStore((s) => s.topApps);
  const maxDuration = topApps.length > 0 ? topApps[0].total_duration : 1;

  return (
    <div>
      <h3 className="text-xs font-medium text-txt-secondary uppercase tracking-wider mb-4">
        Top Apps
      </h3>

      {topApps.length === 0 ? (
        <p className="text-xs text-txt-muted">No activity yet</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {topApps.map((app, i) => {
            const pct = (app.total_duration / maxDuration) * 100;
            const color = classColors[app.classification] ?? classColors.unclassified;

            return (
              <motion.div
                key={app.app_name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.25 }}
                className="flex items-center gap-3"
              >
                {/* Rank */}
                <span className="w-4 text-right text-xs font-mono text-txt-muted">
                  {i + 1}
                </span>

                {/* App info + bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-txt-primary truncate">
                      {app.app_name}
                    </span>
                    <span className="text-xs font-mono text-txt-secondary ml-2 shrink-0">
                      {formatDuration(app.total_duration)}
                    </span>
                  </div>

                  {/* Proportion bar */}
                  <div className="h-1.5 bg-void/50 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.06 + 0.15, duration: 0.4, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

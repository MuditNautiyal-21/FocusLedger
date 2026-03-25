import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSessionStore } from '../../stores/sessionStore';
import type { Activity, Classification } from '../../../../shared/types';

const classColors: Record<Classification, string> = {
  productive: 'var(--productive)',
  'non-productive': 'var(--wasted)',
  neutral: 'var(--neutral)',
  unclassified: '#334155',
};

function formatHour(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ${secs % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

interface BlockData {
  activity: Activity;
  leftPct: number;
  widthPct: number;
}

export default function TimelineBar() {
  const activities = useSessionStore((s) => s.activities);
  const session = useSessionStore((s) => s.session);
  const [tooltip, setTooltip] = useState<{ x: number; block: BlockData } | null>(null);

  const { blocks, startTime, endTime } = useMemo(() => {
    if (!session || activities.length === 0) {
      return { blocks: [], startTime: null, endTime: null };
    }

    const sessionStart = new Date(session.started_at).getTime();
    const now = Date.now();
    const span = now - sessionStart;
    if (span <= 0) return { blocks: [], startTime: null, endTime: null };

    const blocks: BlockData[] = activities.map((act) => {
      const actStart = new Date(act.started_at).getTime();
      const dur = (act.duration_seconds || 1) * 1000;
      const leftPct = Math.max(0, ((actStart - sessionStart) / span) * 100);
      const widthPct = Math.max(0.3, (dur / span) * 100);
      return { activity: act, leftPct, widthPct };
    });

    return {
      blocks,
      startTime: new Date(sessionStart),
      endTime: new Date(now),
    };
  }, [activities, session]);

  const midTime = startTime && endTime
    ? new Date((startTime.getTime() + endTime.getTime()) / 2)
    : null;

  return (
    <div>
      <h3 className="text-xs font-medium text-txt-secondary uppercase tracking-wider mb-4">
        Today's Timeline
      </h3>

      {/* Timeline track */}
      <div
        className="relative h-8 bg-void/50 rounded-lg overflow-hidden"
        onMouseLeave={() => setTooltip(null)}
      >
        {blocks.map((block, i) => (
          <motion.div
            key={block.activity.id}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: i * 0.03, duration: 0.3, ease: 'easeOut' }}
            className="absolute top-0 h-full rounded-sm cursor-pointer origin-left"
            style={{
              left: `${block.leftPct}%`,
              width: `${block.widthPct}%`,
              backgroundColor: classColors[block.activity.classification],
              minWidth: 2,
            }}
            onMouseEnter={(e) =>
              setTooltip({ x: e.clientX, block })
            }
          />
        ))}

        {/* Hover tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 px-3 py-2 rounded-lg bg-elevated border border-border-subtle shadow-lg text-xs pointer-events-none"
            style={{ left: tooltip.x - 80, top: 'auto', bottom: '100%', marginBottom: 8 }}
          >
            <p className="font-medium text-txt-primary">{tooltip.block.activity.app_name}</p>
            <p className="text-txt-muted truncate max-w-[200px]">
              {tooltip.block.activity.window_title ?? ''}
            </p>
            <p className="text-txt-secondary mt-1">
              {formatDuration(tooltip.block.activity.duration_seconds)} ·{' '}
              <span style={{ color: classColors[tooltip.block.activity.classification] }}>
                {tooltip.block.activity.classification}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-1.5 text-[10px] font-mono text-txt-muted">
        <span>{startTime ? formatHour(startTime) : '--'}</span>
        <span>{midTime ? formatHour(midTime) : ''}</span>
        <span>{endTime ? formatHour(endTime) : 'now'}</span>
      </div>
    </div>
  );
}

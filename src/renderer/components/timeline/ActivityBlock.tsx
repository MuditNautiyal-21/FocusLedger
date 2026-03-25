import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ipc } from '../../lib/ipc';
import type { Activity, Classification } from '../../../../shared/types';

const borderColors: Record<Classification, string> = {
  productive: 'var(--productive)',
  'non-productive': 'var(--wasted)',
  neutral: 'var(--neutral)',
  unclassified: '#334155',
};

const glowColors: Record<Classification, string> = {
  productive: 'var(--productive-glow)',
  'non-productive': 'var(--wasted-glow)',
  neutral: 'rgba(107,114,128,0.1)',
  unclassified: 'transparent',
};

const badgeStyles: Record<Classification, { bg: string; text: string; label: string }> = {
  productive: { bg: 'rgba(16,185,129,0.15)', text: 'text-productive', label: '✅ Productive' },
  'non-productive': { bg: 'rgba(239,68,68,0.15)', text: 'text-wasted', label: '❌ Wasted' },
  neutral: { bg: 'rgba(107,114,128,0.15)', text: 'text-neutral', label: '⚪ Neutral' },
  unclassified: { bg: 'rgba(51,65,85,0.3)', text: 'text-txt-muted', label: '⬜ Unclassified' },
};

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m ${secs % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

interface Props {
  activity: Activity;
  onReclassify?: (id: string, cls: Classification, cat: string | null) => void;
}

export default function ActivityBlock({ activity, onReclassify }: Props) {
  const [expanded, setExpanded] = useState(false);
  const cls = activity.classification;
  const badge = badgeStyles[cls];

  const handleReclassify = async (newCls: Classification) => {
    await ipc('activities:reclassify', activity.id, newCls, activity.category);
    onReclassify?.(activity.id, newCls, activity.category);
  };

  return (
    <motion.div
      layout
      className="glass rounded-xl border border-border-subtle hover:border-border-active transition-[border-color] duration-200 overflow-hidden"
      style={{ boxShadow: `inset 4px 0 0 ${borderColors[cls]}, 0 0 20px ${glowColors[cls]}` }}
    >
      {/* Main row */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-txt-primary truncate">
              {activity.app_name}
            </span>
            {activity.window_title && (
              <span className="text-sm text-txt-muted truncate hidden sm:inline">
                — "{activity.window_title.length > 55
                  ? activity.window_title.substring(0, 52) + '...'
                  : activity.window_title}"
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded ${badge.text}`}
              style={{ backgroundColor: badge.bg }}
            >
              {badge.label}
            </span>
            {activity.category && (
              <span className="text-xs text-txt-muted">· {activity.category}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 ml-3 shrink-0">
          <span className="font-mono text-sm text-txt-secondary">
            {formatDuration(activity.duration_seconds)}
          </span>
          {expanded ? (
            <ChevronUp size={14} className="text-txt-muted" />
          ) : (
            <ChevronDown size={14} className="text-txt-muted" />
          )}
        </div>
      </div>

      {/* Expandable details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-border-subtle space-y-2">
              {/* Time range */}
              <div className="flex gap-4 text-xs text-txt-muted">
                <span>Started: {formatTime(activity.started_at)}</span>
                {activity.ended_at && (
                  <span>Ended: {formatTime(activity.ended_at)}</span>
                )}
              </div>

              {/* URL / Domain */}
              {activity.domain && (
                <p className="text-xs text-txt-secondary">
                  Domain: <span className="font-mono">{activity.domain}</span>
                </p>
              )}
              {activity.url && (
                <p className="text-xs text-txt-muted truncate">
                  URL: {activity.url}
                </p>
              )}

              {/* Rule info */}
              {activity.rule_matched_id && (
                <p className="text-xs text-txt-muted">
                  Matched rule: <span className="font-mono text-accent">{activity.rule_matched_id.substring(0, 8)}...</span>
                </p>
              )}
              {activity.was_prompted && (
                <p className="text-xs text-txt-muted">Classified via prompt</p>
              )}

              {/* Reclassify buttons */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-txt-muted mr-1">Reclassify:</span>
                {(['productive', 'non-productive', 'neutral'] as Classification[]).map((c) => (
                  <button
                    key={c}
                    onClick={(e) => { e.stopPropagation(); handleReclassify(c); }}
                    disabled={cls === c}
                    className={`text-xs px-2 py-1 rounded border transition-colors cursor-pointer
                      ${cls === c
                        ? 'border-border-active bg-white/5 text-txt-primary'
                        : 'border-border-subtle text-txt-muted hover:text-txt-secondary hover:border-border-active'
                      }`}
                  >
                    {c === 'productive' ? '✅' : c === 'non-productive' ? '❌' : '⚪'} {c}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

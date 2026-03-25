import { motion } from 'framer-motion';
import { useSessionStore } from '../../stores/sessionStore';

function getColor(pct: number): string {
  if (pct >= 70) return 'var(--productive)';
  if (pct >= 40) return '#F59E0B'; // amber
  return 'var(--wasted)';
}

function getLabel(pct: number): string {
  if (pct >= 70) return 'Great';
  if (pct >= 40) return 'Fair';
  return 'Low';
}

export default function ProductivityGauge() {
  const stats = useSessionStore((s) => s.stats);
  const pct = stats?.productivity_score ?? 0;
  const color = getColor(pct);
  const label = getLabel(pct);

  // SVG arc parameters
  const size = 88;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">&#128202;</span>
        <span className="text-xs font-medium text-txt-secondary uppercase tracking-wider">
          Productivity
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Circular gauge */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth={stroke}
            />
            {/* Progress arc */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="font-mono text-lg font-semibold"
              style={{ color }}
            >
              {Math.round(pct)}%
            </span>
          </div>
        </div>

        {/* Side labels */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium" style={{ color }}>{label}</span>
          <div className="flex flex-col gap-0.5 text-xs text-txt-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-productive inline-block" />
              {formatDuration(stats?.productive_seconds ?? 0)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-wasted inline-block" />
              {formatDuration(stats?.wasted_seconds ?? 0)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neutral inline-block" />
              {formatDuration(stats?.neutral_seconds ?? 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

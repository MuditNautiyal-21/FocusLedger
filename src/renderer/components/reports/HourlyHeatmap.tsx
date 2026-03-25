import { useMemo, useState } from 'react';
import type { HourlyProductivity } from '../../../../shared/types';

interface Props {
  data: HourlyProductivity[];
}

function getCellColor(prod: number, wasted: number, total: number): string {
  if (total === 0) return 'var(--border-subtle)';
  const prodRatio = prod / total;
  const wasteRatio = wasted / total;
  if (prodRatio > 0.6) return 'var(--productive)';
  if (wasteRatio > 0.6) return 'var(--wasted)';
  if (prodRatio > 0.3) return 'rgba(16,185,129,0.5)';
  if (wasteRatio > 0.3) return 'rgba(239,68,68,0.5)';
  return 'var(--neutral)';
}

function getCellOpacity(total: number, maxTotal: number): number {
  if (total === 0) return 0.15;
  return Math.max(0.3, total / Math.max(maxTotal, 1));
}

function formatHour(h: number): string {
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

function formatDur(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function HourlyHeatmap({ data }: Props) {
  const [hoverHour, setHoverHour] = useState<number | null>(null);

  // Build a full 24-hour grid
  const grid = useMemo(() => {
    const map = new Map<number, HourlyProductivity>();
    for (const d of data) map.set(d.hour, d);

    const hours: (HourlyProductivity & { total: number })[] = [];
    for (let h = 0; h < 24; h++) {
      const d = map.get(h) ?? { hour: h, productive_seconds: 0, wasted_seconds: 0, neutral_seconds: 0 };
      hours.push({ ...d, total: d.productive_seconds + d.wasted_seconds + d.neutral_seconds });
    }
    return hours;
  }, [data]);

  const maxTotal = Math.max(...grid.map((h) => h.total), 1);
  const hoverData = hoverHour !== null ? grid[hoverHour] : null;

  return (
    <div>
      <h3 className="text-xs font-medium text-txt-secondary uppercase tracking-wider mb-4">
        Hourly Activity
      </h3>

      <div className="grid grid-cols-12 gap-1">
        {grid.map((h) => {
          const color = getCellColor(h.productive_seconds, h.wasted_seconds, h.total);
          const opacity = getCellOpacity(h.total, maxTotal);

          return (
            <div
              key={h.hour}
              className="relative group"
              onMouseEnter={() => setHoverHour(h.hour)}
              onMouseLeave={() => setHoverHour(null)}
            >
              <div
                className="aspect-square rounded-sm transition-transform duration-100 hover:scale-110 cursor-default"
                style={{ backgroundColor: color, opacity }}
              />
              <div className="text-center mt-0.5">
                <span className="text-[8px] font-mono text-txt-muted">{formatHour(h.hour)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hover info */}
      <div className="mt-3 h-8 flex items-center">
        {hoverData ? (
          <div className="flex items-center gap-3 text-xs text-txt-secondary">
            <span className="font-mono font-medium">{formatHour(hoverData.hour)}</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-productive" />
              {formatDur(hoverData.productive_seconds)}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-wasted" />
              {formatDur(hoverData.wasted_seconds)}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-neutral" />
              {formatDur(hoverData.neutral_seconds)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-txt-muted">Hover over an hour to see details</span>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 text-[10px] text-txt-muted">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-productive" /> Productive</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-wasted" /> Wasted</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-neutral" /> Neutral</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: 'var(--border-subtle)' }} /> No data</span>
      </div>
    </div>
  );
}

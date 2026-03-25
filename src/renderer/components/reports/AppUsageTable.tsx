import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { Classification } from '../../../../shared/types';

interface AppRow {
  app_name: string;
  total: number;
  productive: number;
  wasted: number;
  dominant: Classification;
}

interface Props {
  data: AppRow[];
}

type SortKey = 'app_name' | 'total' | 'productive' | 'wasted';

const badgeStyles: Record<Classification, { bg: string; text: string; label: string }> = {
  productive: { bg: 'rgba(16,185,129,0.15)', text: 'text-productive', label: 'Productive' },
  'non-productive': { bg: 'rgba(239,68,68,0.15)', text: 'text-wasted', label: 'Wasted' },
  neutral: { bg: 'rgba(107,114,128,0.15)', text: 'text-neutral', label: 'Neutral' },
  unclassified: { bg: 'rgba(51,65,85,0.3)', text: 'text-txt-muted', label: 'Unknown' },
};

function formatDur(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function AppUsageTable({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [data, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const headerClass = 'text-[10px] font-medium text-txt-muted uppercase tracking-wider cursor-pointer hover:text-txt-secondary transition-colors select-none flex items-center gap-1';

  return (
    <div>
      <h3 className="text-xs font-medium text-txt-secondary uppercase tracking-wider mb-4">
        App Usage
      </h3>

      {data.length === 0 ? (
        <p className="text-xs text-txt-muted py-8 text-center">No data</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left pb-2 pr-2">
                  <span className={headerClass} onClick={() => toggleSort('app_name')}>
                    App <SortIcon col="app_name" />
                  </span>
                </th>
                <th className="text-right pb-2 px-2">
                  <span className={`${headerClass} justify-end`} onClick={() => toggleSort('total')}>
                    Total <SortIcon col="total" />
                  </span>
                </th>
                <th className="text-right pb-2 px-2">
                  <span className={`${headerClass} justify-end`} onClick={() => toggleSort('productive')}>
                    Productive <SortIcon col="productive" />
                  </span>
                </th>
                <th className="text-right pb-2 px-2">
                  <span className={`${headerClass} justify-end`} onClick={() => toggleSort('wasted')}>
                    Wasted <SortIcon col="wasted" />
                  </span>
                </th>
                <th className="text-right pb-2 pl-2">
                  <span className={`${headerClass} justify-end`}>Class</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const badge = badgeStyles[row.dominant];
                return (
                  <tr
                    key={row.app_name}
                    className={`border-b border-border-subtle ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}
                  >
                    <td className="py-2 pr-2 text-txt-primary font-medium truncate max-w-[180px]">
                      {row.app_name}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-txt-secondary">
                      {formatDur(row.total)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-productive">
                      {formatDur(row.productive)}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-wasted">
                      {formatDur(row.wasted)}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.text}`}
                        style={{ backgroundColor: badge.bg }}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export type { AppRow };

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, FolderOpen, Loader2 } from 'lucide-react';
import { ipc } from '../../lib/ipc';
import GlassCard from '../shared/GlassCard';
import ProductivityTrendChart from './ProductivityTrendChart';
import type { DayData } from './ProductivityTrendChart';
import CategoryDonut from './CategoryDonut';
import type { CategoryData } from './CategoryDonut';
import AppUsageTable from './AppUsageTable';
import type { AppRow } from './AppUsageTable';
import HourlyHeatmap from './HourlyHeatmap';
import type { Activity, Session, SessionStats, HourlyProductivity, Category, Classification } from '../../../../shared/types';

// ─── Date range helpers ──────────────────────────────────────────────

type RangePreset = 'today' | 'week' | 'month' | 'custom';

function todayStr() { return new Date().toISOString().slice(0, 10); }

function startOfWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const d = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  while (d <= e) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// ─── Stagger animation ──────────────────────────────────────────────

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

// ─── Component ───────────────────────────────────────────────────────

export default function ReportsPage() {
  const [preset, setPreset] = useState<RangePreset>('today');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyProductivity[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ filePath: string | null; message: string } | null>(null);

  // Apply preset
  useEffect(() => {
    switch (preset) {
      case 'today':
        setStartDate(todayStr());
        setEndDate(todayStr());
        break;
      case 'week':
        setStartDate(startOfWeek());
        setEndDate(todayStr());
        break;
      case 'month':
        setStartDate(startOfMonth());
        setEndDate(todayStr());
        break;
    }
  }, [preset]);

  // Fetch data
  useEffect(() => {
    const load = async () => {
      const start = startDate + 'T00:00:00.000Z';
      const end = endDate + 'T23:59:59.999Z';

      const [acts, cats, session] = await Promise.all([
        ipc<Activity[]>('activities:by-date-range', start, end),
        ipc<Category[]>('categories:list'),
        ipc<Session | null>('session:current'),
      ]);

      setActivities(acts ?? []);
      setCategories(cats ?? []);

      // Hourly data for today's session
      if (session) {
        const hourly = await ipc<HourlyProductivity[]>('activities:hourly', session.id);
        setHourlyData(hourly ?? []);
      }
    };
    load();
  }, [startDate, endDate]);

  // ── Derived data for charts ──

  const trendData: DayData[] = useMemo(() => {
    const days = daysBetween(startDate, endDate);
    return days.map((day) => {
      const dayActs = activities.filter((a) => a.started_at.startsWith(day));
      const total = dayActs.reduce((s, a) => s + a.duration_seconds, 0);
      const prod = dayActs.filter((a) => a.classification === 'productive').reduce((s, a) => s + a.duration_seconds, 0);
      const score = total > 0 ? (prod / total) * 100 : 0;
      const d = new Date(day + 'T12:00:00');
      return {
        date: day,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: Math.round(score * 10) / 10,
        totalHours: Math.round((total / 3600) * 10) / 10,
      };
    });
  }, [activities, startDate, endDate]);

  const categoryData: CategoryData[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const act of activities) {
      const cat = act.category || 'Uncategorized';
      map.set(cat, (map.get(cat) || 0) + act.duration_seconds);
    }
    const catColors = new Map(categories.map((c) => [c.name, c.color]));
    return Array.from(map.entries())
      .map(([name, seconds]) => ({
        name,
        seconds,
        color: catColors.get(name) || '#475569',
      }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [activities, categories]);

  const totalSeconds = activities.reduce((s, a) => s + a.duration_seconds, 0);

  const appData: AppRow[] = useMemo(() => {
    const map = new Map<string, { total: number; productive: number; wasted: number; counts: Record<Classification, number> }>();
    for (const act of activities) {
      const existing = map.get(act.app_name) || { total: 0, productive: 0, wasted: 0, counts: { productive: 0, 'non-productive': 0, neutral: 0, unclassified: 0 } };
      existing.total += act.duration_seconds;
      if (act.classification === 'productive') existing.productive += act.duration_seconds;
      if (act.classification === 'non-productive') existing.wasted += act.duration_seconds;
      existing.counts[act.classification] += act.duration_seconds;
      map.set(act.app_name, existing);
    }
    return Array.from(map.entries()).map(([app_name, d]) => {
      const dominant = (Object.entries(d.counts) as [Classification, number][])
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unclassified';
      return { app_name, total: d.total, productive: d.productive, wasted: d.wasted, dominant };
    });
  }, [activities]);

  // ── Export ──

  const handleExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const result = await ipc<{ ok: boolean; filePath: string | null; message: string }>(
        'export:report', startDate, endDate,
      );
      setExportResult(result);
    } catch {
      setExportResult({ filePath: null, message: 'Export failed' });
    }
    setExporting(false);
  };

  // ── Preset buttons ──

  const presets: { value: RangePreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
      {/* ── Header: range picker ── */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold mr-4">Reports</h1>
        <div className="flex gap-1">
          {presets.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer
                ${preset === p.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border-subtle text-txt-muted hover:text-txt-secondary hover:border-border-active'
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        <div className="flex items-center gap-2 ml-4 text-xs">
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setPreset('custom'); setStartDate(e.target.value); }}
            className="bg-surface border border-border-subtle rounded-lg px-2 py-1 text-txt-secondary text-xs focus:border-border-active focus:outline-none"
          />
          <span className="text-txt-muted">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setPreset('custom'); setEndDate(e.target.value); }}
            className="bg-surface border border-border-subtle rounded-lg px-2 py-1 text-txt-secondary text-xs focus:border-border-active focus:outline-none"
          />
        </div>
      </div>

      {/* ── Charts grid (2 columns) ── */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div variants={fadeUp}>
          <GlassCard className="p-5">
            <ProductivityTrendChart data={trendData} />
          </GlassCard>
        </motion.div>

        <motion.div variants={fadeUp}>
          <GlassCard className="p-5">
            <CategoryDonut data={categoryData} totalSeconds={totalSeconds} />
          </GlassCard>
        </motion.div>

        <motion.div variants={fadeUp}>
          <GlassCard className="p-5">
            <AppUsageTable data={appData} />
          </GlassCard>
        </motion.div>

        <motion.div variants={fadeUp}>
          <GlassCard className="p-5">
            <HourlyHeatmap data={hourlyData} />
          </GlassCard>
        </motion.div>
      </div>

      {/* ── Export button ── */}
      <motion.div variants={fadeUp} className="flex items-center justify-end gap-3">
        {exportResult && (
          <span className="text-xs text-txt-muted">{exportResult.message}</span>
        )}

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent/90
                     text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
        >
          {exporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          Export to Excel
        </button>
      </motion.div>
    </motion.div>
  );
}

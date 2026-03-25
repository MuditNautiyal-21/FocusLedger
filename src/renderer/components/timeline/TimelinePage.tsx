import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { ipc } from '../../lib/ipc';
import ActivityBlock from './ActivityBlock';
import type { Activity, Classification } from '../../../../shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = todayStr();
  if (dateStr === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getHourLabel(iso: string): string {
  const h = new Date(iso).getHours();
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display} ${suffix}`;
}

function formatIdleGap(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ─── Filter types ────────────────────────────────────────────────────

type ClassFilter = 'all' | Classification;

const classFilters: { value: ClassFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'productive', label: 'Productive' },
  { value: 'non-productive', label: 'Wasted' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'unclassified', label: 'Unclassified' },
];

// ─── Group activities by hour ────────────────────────────────────────

interface HourGroup {
  hour: string;
  activities: Activity[];
}

function groupByHour(activities: Activity[]): HourGroup[] {
  const map = new Map<string, Activity[]>();
  for (const act of activities) {
    const label = getHourLabel(act.started_at);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(act);
  }
  return Array.from(map.entries()).map(([hour, activities]) => ({ hour, activities }));
}

// ─── Idle gap detection ──────────────────────────────────────────────

interface TimelineItem {
  type: 'activity' | 'idle';
  activity?: Activity;
  idleSeconds?: number;
}

function buildTimelineItems(activities: Activity[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];

    // Check for idle gap before this activity
    if (i > 0) {
      const prev = activities[i - 1];
      if (prev.ended_at) {
        const prevEnd = new Date(prev.ended_at).getTime();
        const curStart = new Date(act.started_at).getTime();
        const gap = Math.floor((curStart - prevEnd) / 1000);
        if (gap > 30) { // only show gaps > 30s
          items.push({ type: 'idle', idleSeconds: gap });
        }
      }
    }

    items.push({ type: 'activity', activity: act });
  }
  return items;
}

// ─── Page limit ──────────────────────────────────────────────────────

const PAGE_SIZE = 50;

// ─── Component ───────────────────────────────────────────────────────

export default function TimelinePage() {
  const [date, setDate] = useState(todayStr);
  const [classFilter, setClassFilter] = useState<ClassFilter>('all');
  const [search, setSearch] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true); // start as true so first render shows loading, not "no data"
  const offsetRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchIdRef = useRef(0); // guard against stale async responses

  const fetchActivities = useCallback(async (reset = false) => {
    if (reset) {
      offsetRef.current = 0;
      setHasMore(true);
    }
    setLoading(true);

    const fetchId = ++fetchIdRef.current; // tag this fetch

    const result = await ipc<Activity[]>('activities:filtered', {
      date,
      classification: classFilter === 'all' ? undefined : classFilter,
      search: search || undefined,
      limit: PAGE_SIZE,
      offset: offsetRef.current,
    });

    // Discard result if a newer fetch has started (prevents race conditions)
    if (fetchId !== fetchIdRef.current) return;

    const fetched = result ?? [];
    if (reset) {
      setActivities(fetched);
    } else {
      setActivities((prev) => [...prev, ...fetched]);
    }
    if (fetched.length < PAGE_SIZE) setHasMore(false);
    offsetRef.current += fetched.length;
    setLoading(false);
  }, [date, classFilter, search]);

  // Reload when fetchActivities changes (which changes when date/classFilter/search change)
  useEffect(() => {
    fetchActivities(true);
  }, [fetchActivities]);

  // Infinite scroll
  const handleScroll = () => {
    if (!scrollRef.current || !hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      fetchActivities(false);
    }
  };

  // Reclassify handler
  const handleReclassify = (id: string, cls: Classification, cat: string | null) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, classification: cls, category: cat } : a)),
    );
  };

  const timelineItems = buildTimelineItems(activities);

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      {/* ── Header: Date Picker + Filters ── */}
      <div className="shrink-0 mb-4 space-y-3">
        {/* Date picker */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDate((d) => shiftDate(d, -1))}
            className="p-1.5 rounded-lg hover:bg-white/5 text-txt-muted hover:text-txt-secondary transition-colors cursor-pointer"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-xl font-semibold min-w-[140px] text-center">
            {formatDateDisplay(date)}
          </h1>
          <button
            onClick={() => { if (date < todayStr()) setDate((d) => shiftDate(d, 1)); }}
            disabled={date >= todayStr()}
            className="p-1.5 rounded-lg hover:bg-white/5 text-txt-muted hover:text-txt-secondary transition-colors cursor-pointer disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
          <span className="text-xs text-txt-muted font-mono ml-2">{date}</span>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-3">
          {/* Classification pills */}
          <div className="flex gap-1">
            {classFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setClassFilter(f.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer
                  ${classFilter === f.value
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border-subtle text-txt-muted hover:text-txt-secondary hover:border-border-active'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-[260px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted" />
            <input
              type="text"
              placeholder="Search apps..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-border-subtle
                         text-xs text-txt-primary placeholder:text-txt-muted
                         focus:border-border-active focus:outline-none transition-colors"
            />
          </div>

          <span className="text-xs text-txt-muted ml-auto">
            {activities.length} activit{activities.length === 1 ? 'y' : 'ies'}
          </span>
        </div>
      </div>

      {/* ── Activity list ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-2 pr-1"
      >
        {activities.length === 0 && !loading && (
          <div className="flex items-center justify-center h-40 text-txt-muted text-sm">
            No activities for this day
          </div>
        )}

        {timelineItems.map((item, i) => {
          if (item.type === 'idle') {
            return (
              <div key={`idle-${i}`} className="flex items-center gap-3 py-1 px-2">
                <div className="flex-1 border-t border-dashed border-border-subtle" />
                <span className="text-[10px] text-txt-muted shrink-0">
                  Idle — {formatIdleGap(item.idleSeconds!)}
                </span>
                <div className="flex-1 border-t border-dashed border-border-subtle" />
              </div>
            );
          }

          const act = item.activity!;
          // Show hour marker if first activity or hour changed
          const prevAct = i > 0 ? timelineItems[i - 1] : null;
          const showHour =
            !prevAct ||
            prevAct.type === 'idle' ||
            (prevAct.activity &&
              getHourLabel(prevAct.activity.started_at) !== getHourLabel(act.started_at));

          return (
            <motion.div
              key={act.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.5), duration: 0.2 }}
            >
              {showHour && (
                <div className="flex items-center gap-2 mt-3 mb-1.5">
                  <span className="text-[10px] font-mono text-txt-muted font-medium uppercase">
                    {getHourLabel(act.started_at)}
                  </span>
                  <div className="flex-1 border-t border-border-subtle" />
                </div>
              )}
              <ActivityBlock activity={act} onReclassify={handleReclassify} />
            </motion.div>
          );
        })}

        {loading && (
          <div className="text-center py-4 text-xs text-txt-muted">Loading...</div>
        )}
      </div>
    </div>
  );
}

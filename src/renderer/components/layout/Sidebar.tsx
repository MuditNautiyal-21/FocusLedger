import { useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Clock,
  BarChart3,
  ShieldCheck,
  Settings,
  Pause,
  Play,
} from 'lucide-react';

// ─── Nav items ───────────────────────────────────────────────────────

interface NavItem {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Clock, label: 'Timeline', path: '/timeline' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: ShieldCheck, label: 'Rules', path: '/rules' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

// ─── Tracking status type ────────────────────────────────────────────

type TrackingState = 'tracking' | 'paused' | 'stopped';

const statusColors: Record<TrackingState, string> = {
  tracking: 'bg-productive',
  paused: 'bg-yellow-400',
  stopped: 'bg-wasted',
};

const statusLabels: Record<TrackingState, string> = {
  tracking: 'Tracking',
  paused: 'Paused',
  stopped: 'Stopped',
};

// ─── Sidebar ─────────────────────────────────────────────────────────

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [trackingState, setTrackingState] = useState<TrackingState>('tracking');

  const toggleTracking = () => {
    setTrackingState((s) => (s === 'tracking' ? 'paused' : 'tracking'));
  };

  return (
    <aside className="flex flex-col items-center w-16 h-full bg-surface border-r border-border-subtle shrink-0">
      {/* ── Logo ── */}
      <div className="mt-4 mb-6">
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
          <span className="text-white font-bold text-sm tracking-tight select-none">FL</span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <div key={item.path} className="relative group">
              <motion.button
                onClick={() => navigate(item.path)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  relative w-10 h-10 rounded-lg flex items-center justify-center
                  transition-colors duration-150 cursor-pointer
                  ${isActive
                    ? 'text-accent bg-accent/10'
                    : 'text-txt-muted hover:text-txt-secondary hover:bg-white/[0.03]'
                  }
                `}
              >
                {/* Active left indicator */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute left-[-12px] w-[3px] h-5 rounded-r-full bg-accent"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}

                <Icon size={20} />

                {/* Glow on active */}
                {isActive && (
                  <div className="absolute inset-0 rounded-lg bg-accent/5 blur-sm pointer-events-none" />
                )}
              </motion.button>

              {/* Tooltip */}
              <div className="
                absolute left-full ml-3 top-1/2 -translate-y-1/2
                px-2.5 py-1 rounded-md bg-elevated text-xs text-txt-primary font-medium
                opacity-0 pointer-events-none group-hover:opacity-100
                transition-opacity duration-150 whitespace-nowrap z-50
                border border-border-subtle shadow-lg
              ">
                {item.label}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Bottom: tracking status ── */}
      <div className="mb-4 flex flex-col items-center gap-2">
        {/* Pause/Resume button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTracking}
          className="relative group w-9 h-9 rounded-lg flex items-center justify-center
                     text-txt-muted hover:text-txt-secondary hover:bg-white/[0.03]
                     transition-colors duration-150 cursor-pointer"
        >
          {trackingState === 'tracking' ? <Pause size={16} /> : <Play size={16} />}

          {/* Tooltip */}
          <div className="
            absolute left-full ml-3 top-1/2 -translate-y-1/2
            px-2.5 py-1 rounded-md bg-elevated text-xs text-txt-primary font-medium
            opacity-0 pointer-events-none group-hover:opacity-100
            transition-opacity duration-150 whitespace-nowrap z-50
            border border-border-subtle shadow-lg
          ">
            {trackingState === 'tracking' ? 'Pause Tracking' : 'Resume Tracking'}
          </div>
        </motion.button>

        {/* Status dot */}
        <div className="relative group">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColors[trackingState]}`}>
            {trackingState === 'tracking' && (
              <div className="absolute inset-0 rounded-full bg-productive animate-ping opacity-40" />
            )}
          </div>

          {/* Tooltip */}
          <div className="
            absolute left-full ml-3 top-1/2 -translate-y-1/2
            px-2.5 py-1 rounded-md bg-elevated text-xs text-txt-primary font-medium
            opacity-0 pointer-events-none group-hover:opacity-100
            transition-opacity duration-150 whitespace-nowrap z-50
            border border-border-subtle shadow-lg
          ">
            {statusLabels[trackingState]}
          </div>
        </div>
      </div>
    </aside>
  );
}

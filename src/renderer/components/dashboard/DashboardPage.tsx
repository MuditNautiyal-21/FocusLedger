import { motion } from 'framer-motion';
import { useDashboard } from '../../hooks/useDashboard';
import GlassCard from '../shared/GlassCard';
import SessionTimer from './SessionTimer';
import ProductivityGauge from './ProductivityGauge';
import FocusStreak from './FocusStreak';
import TimelineBar from './TimelineBar';
import TopApps from './TopApps';
import LiveActivity from './LiveActivity';

const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export default function DashboardPage() {
  useDashboard();

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {/* Row 1: 3 stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div variants={fadeUp}>
          <GlassCard className="p-5">
            <SessionTimer />
          </GlassCard>
        </motion.div>

        <motion.div variants={fadeUp}>
          <GlassCard className="p-5">
            <ProductivityGauge />
          </GlassCard>
        </motion.div>

        <motion.div variants={fadeUp}>
          <GlassCard className="p-5">
            <FocusStreak />
          </GlassCard>
        </motion.div>
      </div>

      {/* Row 2: Timeline (60%) + Top Apps (40%) */}
      <div className="grid grid-cols-5 gap-4">
        <motion.div variants={fadeUp} className="col-span-3">
          <GlassCard className="p-5">
            <TimelineBar />
          </GlassCard>
        </motion.div>

        <motion.div variants={fadeUp} className="col-span-2">
          <GlassCard className="p-5">
            <TopApps />
          </GlassCard>
        </motion.div>
      </div>

      {/* Row 3: Live Activity */}
      <motion.div variants={fadeUp}>
        <GlassCard className="p-5">
          <LiveActivity />
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}

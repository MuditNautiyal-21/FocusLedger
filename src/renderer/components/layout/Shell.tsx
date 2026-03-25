import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';

export default function Shell() {
  const location = useLocation();

  return (
    <div className="flex h-screen w-screen bg-base overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {/*
          Use key={pathname} to force remount on route change.
          Each page handles its own entry animation via framer-motion stagger.
          No AnimatePresence — it conflicts with Outlet by rendering the new
          route inside the exiting container, causing double-mount + data loss.
        */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="min-h-full p-6"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSessionStore } from '../../stores/sessionStore';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTime(totalSeconds: number): [string, string, string] {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [pad(h), pad(m), pad(s)];
}

function Digit({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`inline-block relative ${className}`}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export default function SessionTimer() {
  const session = useSessionStore((s) => s.session);
  const stats = useSessionStore((s) => s.stats);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!session) return;

    const updateElapsed = () => {
      const start = new Date(session.started_at).getTime();
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [session]);

  const [hh, mm, ss] = formatTime(elapsed);
  const startTime = session
    ? new Date(session.started_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '--:--';

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">&#9201;</span>
        <span className="text-xs font-medium text-txt-secondary uppercase tracking-wider">
          Active Time
        </span>
      </div>

      <div className="font-mono text-3xl font-semibold text-txt-primary tracking-wider">
        <Digit value={hh} />
        <span className="text-txt-muted mx-0.5">:</span>
        <Digit value={mm} />
        <span className="text-txt-muted mx-0.5">:</span>
        <Digit value={ss} />
      </div>

      <p className="text-xs text-txt-muted mt-2">
        since {startTime}
      </p>
    </div>
  );
}

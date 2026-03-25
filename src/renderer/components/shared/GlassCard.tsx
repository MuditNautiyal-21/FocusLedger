import { motion } from 'framer-motion';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  /** Override the default blue glow — pass a CSS color value */
  glowColor?: string;
}

export default function GlassCard({
  children,
  className = '',
  glowColor,
}: GlassCardProps) {
  const shadowStyle = glowColor
    ? { boxShadow: `0 0 30px ${glowColor}` }
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`
        glass rounded-xl
        border border-border-subtle
        shadow-glow
        transition-[border-color] duration-200
        hover:border-border-active
        ${className}
      `}
      style={shadowStyle}
    >
      {children}
    </motion.div>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { Rule, Classification } from '../../../../shared/types';

const dotColors: Record<Classification, string> = {
  productive: 'bg-productive',
  'non-productive': 'bg-wasted',
  neutral: 'bg-neutral',
  unclassified: 'bg-txt-muted',
};

const typeBadge: Record<string, string> = {
  domain: 'Domain',
  app: 'App',
  title_keyword: 'Keyword',
  regex: 'Regex',
  time_based: 'Time-based',
};

interface Props {
  rule: Rule;
  onEdit: (rule: Rule) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}

export default function RuleCard({ rule, onEdit, onDelete, onToggle, onMove, isFirst, isLast }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(rule.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`glass rounded-xl border border-border-subtle hover:border-border-active transition-all duration-200 px-4 py-3
        ${!rule.is_active ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3">
        {/* Priority arrows */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={() => onMove(rule.id, 'up')}
            disabled={isFirst}
            className="text-txt-muted hover:text-txt-secondary disabled:opacity-20 cursor-pointer"
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={() => onMove(rule.id, 'down')}
            disabled={isLast}
            className="text-txt-muted hover:text-txt-secondary disabled:opacity-20 cursor-pointer"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        {/* Classification dot */}
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColors[rule.classification]}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-txt-primary font-mono truncate">
              {rule.pattern}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-txt-muted border border-border-subtle shrink-0">
              {typeBadge[rule.type] || rule.type}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-txt-muted">
            <span className="capitalize">{rule.classification}</span>
            {rule.category && (
              <>
                <span>·</span>
                <span>{rule.category}</span>
              </>
            )}
            <span>·</span>
            <span>Matched {rule.times_matched}×</span>
            <span>·</span>
            <span>Pri {rule.priority}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onEdit(rule)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-txt-muted hover:text-txt-secondary transition-colors cursor-pointer"
            title="Edit"
          >
            <Pencil size={14} />
          </button>

          <button
            onClick={handleDelete}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              confirmDelete
                ? 'bg-wasted/20 text-wasted'
                : 'hover:bg-white/5 text-txt-muted hover:text-wasted'
            }`}
            title={confirmDelete ? 'Click again to confirm' : 'Delete'}
          >
            <Trash2 size={14} />
          </button>

          {/* Toggle switch */}
          <button
            onClick={() => onToggle(rule.id, !rule.is_active)}
            className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer ml-1
              ${rule.is_active ? 'bg-accent' : 'bg-elevated'}`}
          >
            <div
              className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform
                ${rule.is_active ? 'translate-x-[16px]' : 'translate-x-[2px]'}`}
            />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { ipc } from '../../lib/ipc';
import GlassCard from '../shared/GlassCard';
import RuleCard from './RuleCard';
import AddRuleModal from './AddRuleModal';
import type { Rule, RuleType, Category } from '../../../../shared/types';

type TabFilter = 'all' | RuleType;

const tabs: { value: TabFilter; label: string }[] = [
  { value: 'all', label: 'All Rules' },
  { value: 'domain', label: 'Domain' },
  { value: 'app', label: 'App' },
  { value: 'title_keyword', label: 'Keyword' },
  { value: 'regex', label: 'Regex' },
  { value: 'time_based', label: 'Time-based' },
];

interface Suggestion {
  type: RuleType;
  pattern: string;
  occurrences: number;
  totalDuration: number;
  suggestedClassification: string | null;
}

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2 } } };

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [tab, setTab] = useState<TabFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const loadRules = useCallback(async () => {
    const [r, c, s] = await Promise.all([
      ipc<Rule[]>('rules:list'),
      ipc<Category[]>('categories:list'),
      ipc<Suggestion[]>('rules:suggest'),
    ]);
    setRules(r ?? []);
    setCategories(c ?? []);
    setSuggestions(s ?? []);
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const filtered = tab === 'all' ? rules : rules.filter((r) => r.type === tab);
  const activeCount = rules.filter((r) => r.is_active).length;
  const totalMatched = rules.reduce((s, r) => s + r.times_matched, 0);

  const handleDelete = async (id: string) => {
    await ipc('rules:delete', id);
    loadRules();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await ipc('rules:update', id, { is_active: active });
    loadRules();
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const idx = filtered.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= filtered.length) return;

    const pairs = [
      { id: filtered[idx].id, priority: filtered[swapIdx].priority },
      { id: filtered[swapIdx].id, priority: filtered[idx].priority },
    ];
    await ipc('rules:reorder', pairs);
    loadRules();
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingRule(null);
    setModalOpen(true);
  };

  const handleAcceptSuggestion = async (s: Suggestion) => {
    await ipc('rules:create', {
      type: s.type,
      pattern: s.pattern,
      classification: 'neutral',
      priority: 10,
    });
    loadRules();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Classification Rules</h1>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent/90
                     text-white text-sm font-medium transition-colors cursor-pointer"
        >
          <Plus size={16} />
          Add Rule
        </button>
      </div>

      {/* Stats bar */}
      <div className="text-xs text-txt-muted">
        {activeCount} active rules · {totalMatched} activities auto-classified
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer
              ${tab === t.value
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border-subtle text-txt-muted hover:text-txt-secondary hover:border-border-active'
              }`}
          >
            {t.label}
            {t.value !== 'all' && (
              <span className="ml-1 text-txt-muted">
                ({rules.filter((r) => r.type === t.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Rule list */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((rule, i) => (
            <motion.div key={rule.id} variants={fadeUp}>
              <RuleCard
                rule={rule}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onToggle={handleToggle}
                onMove={handleMove}
                isFirst={i === 0}
                isLast={i === filtered.length - 1}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-txt-muted text-sm">
            No rules in this category
          </div>
        )}
      </motion.div>

      {/* Suggested Rules */}
      {suggestions.length > 0 && (
        <GlassCard className="p-4">
          <button
            onClick={() => setSuggestionsOpen(!suggestionsOpen)}
            className="flex items-center gap-2 text-sm font-medium text-txt-secondary hover:text-txt-primary
                       transition-colors cursor-pointer w-full"
          >
            <Sparkles size={16} className="text-accent" />
            Suggested Rules ({suggestions.length})
            {suggestionsOpen ? <ChevronDown size={14} className="ml-auto" /> : <ChevronRight size={14} className="ml-auto" />}
          </button>

          <AnimatePresence>
            {suggestionsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-2">
                  {suggestions.map((s, i) => (
                    <div
                      key={`${s.type}-${s.pattern}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-border-subtle"
                    >
                      <div>
                        <span className="text-sm font-mono text-txt-primary">{s.pattern}</span>
                        <span className="text-xs text-txt-muted ml-2">
                          {s.type} · {s.occurrences} occurrences
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAcceptSuggestion(s)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-accent/10 text-accent border border-accent/30
                                     hover:bg-accent/20 transition-colors cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => setSuggestions((prev) => prev.filter((_, j) => j !== i))}
                          className="text-xs px-2.5 py-1 rounded-lg text-txt-muted border border-border-subtle
                                     hover:border-border-active transition-colors cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      )}

      {/* Modal */}
      <AddRuleModal
        isOpen={modalOpen}
        editingRule={editingRule}
        categories={categories}
        onClose={() => { setModalOpen(false); setEditingRule(null); }}
        onSave={loadRules}
      />
    </div>
  );
}

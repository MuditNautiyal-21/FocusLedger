import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertCircle } from 'lucide-react';
import { ipc } from '../../lib/ipc';
import type { Rule, RuleType, Classification, Category } from '../../../../shared/types';

interface Props {
  isOpen: boolean;
  editingRule: Rule | null;
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}

const ruleTypes: { value: RuleType; label: string; placeholder: string }[] = [
  { value: 'domain', label: 'Domain', placeholder: 'e.g., youtube.com' },
  { value: 'app', label: 'App', placeholder: 'e.g., VS Code' },
  { value: 'title_keyword', label: 'Keyword', placeholder: 'e.g., Netflix' },
  { value: 'regex', label: 'Regex', placeholder: 'e.g., github\\.com/.*/pull/' },
  { value: 'time_based', label: 'Time-based', placeholder: '{"match":"youtube.com","after":"18:00","before":"09:00"}' },
];

const classifications: { value: Classification; label: string; color: string }[] = [
  { value: 'productive', label: '✅ Productive', color: 'border-productive text-productive bg-productive-glow' },
  { value: 'neutral', label: '⚪ Neutral', color: 'border-neutral text-neutral bg-white/5' },
  { value: 'non-productive', label: '❌ Non-Productive', color: 'border-wasted text-wasted bg-wasted-glow' },
];

export default function AddRuleModal({ isOpen, editingRule, categories, onClose, onSave }: Props) {
  const [type, setType] = useState<RuleType>('domain');
  const [pattern, setPattern] = useState('');
  const [classification, setClassification] = useState<Classification>('productive');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState(10);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<boolean | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (editingRule) {
      setType(editingRule.type);
      setPattern(editingRule.pattern);
      setClassification(editingRule.classification);
      setCategory(editingRule.category ?? '');
      setPriority(editingRule.priority);
    } else {
      setType('domain');
      setPattern('');
      setClassification('productive');
      setCategory('');
      setPriority(10);
    }
    setTestInput('');
    setTestResult(null);
  }, [editingRule, isOpen]);

  // Live test
  useEffect(() => {
    if (!testInput || !pattern) { setTestResult(null); return; }
    const timer = setTimeout(async () => {
      const result = await ipc<{ matches: boolean }>('rules:test', {
        type,
        pattern,
        appName: testInput,
        domain: testInput.includes('.') ? testInput : null,
        windowTitle: testInput,
        url: testInput.startsWith('http') ? testInput : null,
      });
      setTestResult(result?.matches ?? false);
    }, 300);
    return () => clearTimeout(timer);
  }, [testInput, pattern, type]);

  const handleSave = async () => {
    if (!pattern.trim()) return;
    if (editingRule) {
      await ipc('rules:update', editingRule.id, {
        type, pattern, classification,
        category: category || null,
        priority,
      });
    } else {
      await ipc('rules:create', {
        type, pattern, classification,
        category: category || null,
        priority,
      });
    }
    onSave();
    onClose();
  };

  const currentPlaceholder = ruleTypes.find((r) => r.value === type)?.placeholder ?? '';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[480px] glass rounded-xl border border-border-subtle shadow-glow p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">
                {editingRule ? 'Edit Rule' : 'Add Rule'}
              </h2>
              <button onClick={onClose} className="text-txt-muted hover:text-txt-secondary cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Rule type */}
            <div className="mb-4">
              <label className="text-xs text-txt-muted block mb-2">Rule Type</label>
              <div className="flex gap-1.5 flex-wrap">
                {ruleTypes.map((rt) => (
                  <button
                    key={rt.value}
                    onClick={() => setType(rt.value)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer
                      ${type === rt.value
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border-subtle text-txt-muted hover:border-border-active'
                      }`}
                  >
                    {rt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pattern */}
            <div className="mb-4">
              <label className="text-xs text-txt-muted block mb-1.5">Pattern</label>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder={currentPlaceholder}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border-subtle text-sm text-txt-primary
                           placeholder:text-txt-muted focus:border-border-active focus:outline-none font-mono"
              />
            </div>

            {/* Classification */}
            <div className="mb-4">
              <label className="text-xs text-txt-muted block mb-2">Classification</label>
              <div className="flex gap-2">
                {classifications.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setClassification(c.value)}
                    className={`flex-1 text-xs py-2 rounded-lg border transition-colors cursor-pointer text-center
                      ${classification === c.value ? c.color : 'border-border-subtle text-txt-muted'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category + Priority row */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="text-xs text-txt-muted block mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border-subtle text-sm text-txt-secondary
                             focus:border-border-active focus:outline-none cursor-pointer"
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="text-xs text-txt-muted block mb-1.5">Priority</label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border-subtle text-sm text-txt-primary
                             font-mono focus:border-border-active focus:outline-none"
                />
              </div>
            </div>

            {/* Test rule */}
            <div className="mb-5 p-3 rounded-lg bg-void/50 border border-border-subtle">
              <label className="text-xs text-txt-muted block mb-1.5">Test Rule</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Type an app name, domain, or URL to test..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-xs text-txt-primary
                             placeholder:text-txt-muted focus:border-border-active focus:outline-none"
                />
                {testResult !== null && (
                  <span className={`text-xs font-medium flex items-center gap-1 ${testResult ? 'text-productive' : 'text-wasted'}`}>
                    {testResult ? <Check size={14} /> : <AlertCircle size={14} />}
                    {testResult ? 'Match' : 'No match'}
                  </span>
                )}
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs rounded-lg border border-border-subtle text-txt-muted hover:text-txt-secondary
                           hover:border-border-active transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!pattern.trim()}
                className="px-4 py-2 text-xs rounded-lg bg-accent hover:bg-accent/90 text-white font-medium
                           transition-colors disabled:opacity-40 cursor-pointer"
              >
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

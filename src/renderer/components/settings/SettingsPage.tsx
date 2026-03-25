import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Trash2, Download, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { ipc } from '../../lib/ipc';
import { useSettingsStore } from '../../stores/settingsStore';
import GlassCard from '../shared/GlassCard';

// ─── Helpers ─────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer shrink-0
        ${value ? 'bg-accent' : 'bg-elevated'}`}
    >
      <div
        className={`absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white transition-transform
          ${value ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
      />
    </button>
  );
}

function Slider({ value, min, max, step, label, onChange }: {
  value: number; min: number; max: number; step: number; label: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-txt-muted">{label}</span>
        <span className="text-xs font-mono text-txt-secondary">{value}{step >= 60 ? 's' : 'ms'}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent h-1 cursor-pointer"
      />
    </div>
  );
}

function SettingRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm text-txt-primary">{label}</p>
        {description && <p className="text-xs text-txt-muted mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <GlassCard className="p-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left cursor-pointer"
      >
        {open ? <ChevronDown size={16} className="text-txt-muted" /> : <ChevronRight size={16} className="text-txt-muted" />}
        <h2 className="text-sm font-semibold text-txt-secondary uppercase tracking-wider">{title}</h2>
      </button>
      {open && <div className="mt-3 divide-y divide-border-subtle">{children}</div>}
    </GlassCard>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

export default function SettingsPage() {
  const { settings, isLoaded, load, update } = useSettingsStore();
  const [dbPath, setDbPath] = useState('');
  const [dbSize, setDbSize] = useState('');
  const [clearConfirm, setClearConfirm] = useState(0); // 0=idle, 1=first, 2=typing
  const [deleteText, setDeleteText] = useState('');
  const [excludeInput, setExcludeInput] = useState('');

  useEffect(() => { load(); }, []);

  useEffect(() => {
    ipc<{ hasSession: boolean; sessionId: string | null }>('db:status').then(() => {
      // Show DB path from Electron
      setDbPath('focusledger.db (in app data)');
      setDbSize('—');
    });
  }, []);

  const handlePickFolder = async () => {
    const result = await ipc<{ path: string | null }>('settings:pick-folder');
    if (result?.path) update('defaultExportFolder', result.path);
  };

  const handleClearHistory = async () => {
    if (clearConfirm === 0) { setClearConfirm(1); return; }
    if (clearConfirm === 1) { setClearConfirm(2); return; }
    if (deleteText === 'DELETE') {
      await ipc('settings:clear-history');
      setClearConfirm(0);
      setDeleteText('');
    }
  };

  const handleExportJson = async () => {
    await ipc('settings:export-json');
  };

  const handleResetRules = async () => {
    await ipc('settings:reset-rules');
  };

  const addExcludedApp = () => {
    if (!excludeInput.trim()) return;
    const updated = [...settings.excludedApps, excludeInput.trim()];
    update('excludedApps', updated);
    setExcludeInput('');
  };

  const removeExcludedApp = (app: string) => {
    update('excludedApps', settings.excludedApps.filter((a) => a !== app));
  };

  if (!isLoaded) {
    return <div className="text-txt-muted text-sm p-8">Loading settings...</div>;
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4 pb-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* General */}
      <motion.div variants={fadeUp}>
        <Section title="General">
          <SettingRow label="Auto-launch on startup" description="Start FocusLedger when you log in">
            <Toggle value={settings.autoLaunch} onChange={(v) => update('autoLaunch', v)} />
          </SettingRow>
          <SettingRow label="Minimize to tray on close" description="Keep running in the system tray">
            <Toggle value={settings.minimizeToTray} onChange={(v) => update('minimizeToTray', v)} />
          </SettingRow>
          <SettingRow label="Start tracking automatically" description="Begin tracking when the app launches">
            <Toggle value={settings.autoTrack} onChange={(v) => update('autoTrack', v)} />
          </SettingRow>
        </Section>
      </motion.div>

      {/* Tracking */}
      <motion.div variants={fadeUp}>
        <Section title="Tracking">
          <div className="py-2">
            <Slider
              label="Polling interval" value={settings.pollInterval}
              min={500} max={3000} step={100}
              onChange={(v) => update('pollInterval', v)}
            />
          </div>
          <div className="py-2">
            <Slider
              label="Idle detection threshold" value={settings.idleThreshold}
              min={60} max={1800} step={60}
              onChange={(v) => update('idleThreshold', v)}
            />
          </div>
          <div className="py-3">
            <p className="text-sm text-txt-primary mb-2">Excluded apps</p>
            <div className="flex gap-2 mb-2">
              <input
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExcludedApp()}
                placeholder="App name..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-xs text-txt-primary
                           placeholder:text-txt-muted focus:border-border-active focus:outline-none"
              />
              <button
                onClick={addExcludedApp}
                className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs border border-accent/30
                           hover:bg-accent/20 transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {settings.excludedApps.map((app) => (
                <span key={app} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-border-subtle text-xs text-txt-secondary">
                  {app}
                  <button onClick={() => removeExcludedApp(app)} className="text-txt-muted hover:text-wasted cursor-pointer">&times;</button>
                </span>
              ))}
              {settings.excludedApps.length === 0 && (
                <span className="text-xs text-txt-muted">No excluded apps</span>
              )}
            </div>
          </div>
        </Section>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={fadeUp}>
        <Section title="Notifications">
          <div className="py-2">
            <p className="text-sm text-txt-primary mb-2">Prompt style</p>
            <div className="flex gap-2">
              {(['modal', 'badge', 'disabled'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => update('promptStyle', style)}
                  className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors cursor-pointer
                    ${settings.promptStyle === style
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border-subtle text-txt-muted hover:border-border-active'
                    }`}
                >
                  {style === 'modal' ? 'Modal popup' : style === 'badge' ? 'Floating badge' : 'Disabled'}
                </button>
              ))}
            </div>
          </div>
          <div className="py-2">
            <Slider
              label="Auto-collapse timeout" value={settings.autoCollapseTimeout}
              min={5} max={30} step={1}
              onChange={(v) => update('autoCollapseTimeout', v)}
            />
          </div>
          <SettingRow label="Sound on prompt">
            <Toggle value={settings.soundOnPrompt} onChange={(v) => update('soundOnPrompt', v)} />
          </SettingRow>
        </Section>
      </motion.div>

      {/* Export */}
      <motion.div variants={fadeUp}>
        <Section title="Export">
          <SettingRow label="Default export folder" description={settings.defaultExportFolder || 'Not set'}>
            <button
              onClick={handlePickFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle text-xs text-txt-muted
                         hover:border-border-active hover:text-txt-secondary transition-colors cursor-pointer"
            >
              <FolderOpen size={14} /> Browse
            </button>
          </SettingRow>
          <div className="py-2">
            <p className="text-sm text-txt-primary mb-2">Auto-export schedule</p>
            <div className="flex gap-2">
              {(['disabled', 'daily', 'weekly'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => update('autoExport', opt)}
                  className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors cursor-pointer
                    ${settings.autoExport === opt
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border-subtle text-txt-muted hover:border-border-active'
                    }`}
                >
                  {opt === 'disabled' ? 'Disabled' : opt === 'daily' ? 'Daily at session end' : 'Weekly on Sunday'}
                </button>
              ))}
            </div>
          </div>
          <SettingRow label="Include neutral time in reports">
            <Toggle value={settings.includeNeutral} onChange={(v) => update('includeNeutral', v)} />
          </SettingRow>
          <SettingRow label="Include idle time in reports">
            <Toggle value={settings.includeIdle} onChange={(v) => update('includeIdle', v)} />
          </SettingRow>
        </Section>
      </motion.div>

      {/* Data */}
      <motion.div variants={fadeUp}>
        <Section title="Data" defaultOpen={false}>
          <SettingRow label="Database location" description={dbPath}>
            <span className="text-xs font-mono text-txt-muted">{dbSize}</span>
          </SettingRow>

          <div className="py-3 space-y-2">
            {/* Clear History */}
            <div>
              {clearConfirm === 0 && (
                <button
                  onClick={handleClearHistory}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-wasted/30 text-wasted text-xs
                             hover:bg-wasted/10 transition-colors cursor-pointer"
                >
                  <Trash2 size={14} /> Clear All History
                </button>
              )}
              {clearConfirm === 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-wasted">Are you sure?</span>
                  <button onClick={handleClearHistory} className="text-xs px-2 py-1 rounded bg-wasted/20 text-wasted cursor-pointer">
                    Yes, continue
                  </button>
                  <button onClick={() => setClearConfirm(0)} className="text-xs px-2 py-1 rounded border border-border-subtle text-txt-muted cursor-pointer">
                    Cancel
                  </button>
                </div>
              )}
              {clearConfirm === 2 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-wasted">Type DELETE to confirm:</span>
                  <input
                    value={deleteText}
                    onChange={(e) => setDeleteText(e.target.value)}
                    className="px-2 py-1 rounded bg-surface border border-wasted/30 text-xs text-wasted font-mono w-20
                               focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleClearHistory}
                    disabled={deleteText !== 'DELETE'}
                    className="text-xs px-2 py-1 rounded bg-wasted text-white disabled:opacity-30 cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button onClick={() => { setClearConfirm(0); setDeleteText(''); }} className="text-xs text-txt-muted cursor-pointer">
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Export JSON */}
            <button
              onClick={handleExportJson}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-subtle text-txt-muted text-xs
                         hover:border-border-active hover:text-txt-secondary transition-colors cursor-pointer"
            >
              <Download size={14} /> Export All Data as JSON
            </button>

            {/* Reset Rules */}
            <button
              onClick={handleResetRules}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-subtle text-txt-muted text-xs
                         hover:border-border-active hover:text-txt-secondary transition-colors cursor-pointer"
            >
              <RotateCcw size={14} /> Reset Default Rules
            </button>
          </div>
        </Section>
      </motion.div>
    </motion.div>
  );
}

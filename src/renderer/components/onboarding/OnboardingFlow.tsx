import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, FolderOpen, Globe, Loader2, CheckCircle2 } from 'lucide-react';
import { ipc } from '../../lib/ipc';
import type { Classification } from '../../../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────

interface AppItem {
  name: string;
  type: 'app' | 'domain';
  default: Classification;
  current: Classification;
}

interface Props {
  onComplete: () => void;
}

// ─── Default apps for step 2 ─────────────────────────────────────────

const defaultApps: Omit<AppItem, 'current'>[] = [
  { name: 'VS Code', type: 'app', default: 'productive' },
  { name: 'Terminal', type: 'app', default: 'productive' },
  { name: 'github.com', type: 'domain', default: 'productive' },
  { name: 'stackoverflow.com', type: 'domain', default: 'productive' },
  { name: 'figma.com', type: 'domain', default: 'productive' },
  { name: 'notion.so', type: 'domain', default: 'productive' },
  { name: 'Slack', type: 'app', default: 'neutral' },
  { name: 'Discord', type: 'app', default: 'neutral' },
  { name: 'Spotify', type: 'app', default: 'neutral' },
  { name: 'mail.google.com', type: 'domain', default: 'neutral' },
  { name: 'youtube.com', type: 'domain', default: 'non-productive' },
  { name: 'reddit.com', type: 'domain', default: 'non-productive' },
  { name: 'twitter.com', type: 'domain', default: 'non-productive' },
  { name: 'instagram.com', type: 'domain', default: 'non-productive' },
  { name: 'netflix.com', type: 'domain', default: 'non-productive' },
  { name: 'tiktok.com', type: 'domain', default: 'non-productive' },
];

const clsColors: Record<Classification, { bg: string; border: string; text: string }> = {
  productive: { bg: 'bg-productive/15', border: 'border-productive/40', text: 'text-productive' },
  neutral: { bg: 'bg-neutral/15', border: 'border-neutral/40', text: 'text-neutral' },
  'non-productive': { bg: 'bg-wasted/15', border: 'border-wasted/40', text: 'text-wasted' },
  unclassified: { bg: 'bg-white/5', border: 'border-border-subtle', text: 'text-txt-muted' },
};

const clsLabels: Record<Classification, string> = {
  productive: 'Productive', neutral: 'Neutral', 'non-productive': 'Wasted', unclassified: '',
};

function cycleCls(current: Classification): Classification {
  if (current === 'productive') return 'neutral';
  if (current === 'neutral') return 'non-productive';
  return 'productive';
}

// ─── Slide animation ─────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
};

// ─── Component ───────────────────────────────────────────────────────

export default function OnboardingFlow({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [apps, setApps] = useState<AppItem[]>(
    defaultApps.map((a) => ({ ...a, current: a.default })),
  );
  const [exportFolder, setExportFolder] = useState('');

  // Extension setup state
  const [extSetupRunning, setExtSetupRunning] = useState(false);
  const [extSetupDone, setExtSetupDone] = useState(false);
  const [extPath, setExtPath] = useState('');

  const goNext = () => { setDirection(1); setStep((s) => s + 1); };

  const toggleApp = (i: number) => {
    setApps((prev) =>
      prev.map((a, j) => (j === i ? { ...a, current: cycleCls(a.current) } : a)),
    );
  };

  // ── Extension one-click setup ──
  const handleExtensionSetup = async () => {
    setExtSetupRunning(true);
    try {
      const result = await ipc<{ extensionPath: string; success: boolean }>('ext:setup-run');
      if (result?.success) {
        setExtSetupDone(true);
        setExtPath(result.extensionPath);
      }
    } catch { /* ignore */ }
    setExtSetupRunning(false);
  };

  const handleOpenChrome = async () => {
    await ipc('ext:open-browser', 'chrome');
  };

  const handleOpenEdge = async () => {
    await ipc('ext:open-browser', 'edge');
  };

  const handleOpenExtFolder = async () => {
    await ipc('ext:open-folder');
  };

  const handlePickFolder = async () => {
    const result = await ipc<{ path: string | null }>('settings:pick-folder');
    if (result?.path) {
      setExportFolder(result.path);
      await ipc('settings:update', 'defaultExportFolder', result.path);
    }
  };

  const handleFinish = async () => {
    await ipc('settings:update', 'onboarding_complete', 'true');
    onComplete();
  };

  const totalSteps = 4;

  return (
    <div className="fixed inset-0 z-50 bg-void flex items-center justify-center">
      <div className="w-[540px] relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="glass rounded-2xl border border-border-subtle shadow-glow p-8">
              {/* ── Step 0: Welcome ── */}
              {step === 0 && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5">
                    <span className="text-white font-bold text-2xl">FL</span>
                  </div>
                  <h1 className="text-2xl font-bold mb-2">Welcome to FocusLedger</h1>
                  <p className="text-txt-secondary text-sm mb-8">
                    See exactly where your time goes. Track your productivity, classify your activities, and generate detailed reports.
                  </p>
                  <button
                    onClick={goNext}
                    className="flex items-center gap-2 mx-auto px-6 py-2.5 rounded-lg bg-accent hover:bg-accent/90
                               text-white font-medium transition-colors cursor-pointer"
                  >
                    Get Started <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {/* ── Step 1: Classify apps ── */}
              {step === 1 && (
                <div>
                  <h2 className="text-xl font-bold mb-1">Quick Setup</h2>
                  <p className="text-txt-secondary text-sm mb-5">
                    Click each app to cycle: <span className="text-productive">Productive</span> {' \u2192 '}
                    <span className="text-neutral">Neutral</span> {' \u2192 '}
                    <span className="text-wasted">Wasted</span>
                  </p>
                  <div className="grid grid-cols-4 gap-2 mb-6 max-h-[280px] overflow-y-auto">
                    {apps.map((a, i) => {
                      const c = clsColors[a.current];
                      return (
                        <button
                          key={a.name}
                          onClick={() => toggleApp(i)}
                          className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${c.bg} ${c.border}`}
                        >
                          <div className="text-xs font-medium text-txt-primary truncate">{a.name}</div>
                          <div className={`text-[10px] mt-0.5 ${c.text}`}>{clsLabels[a.current]}</div>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={goNext}
                    className="flex items-center gap-2 ml-auto px-5 py-2 rounded-lg bg-accent hover:bg-accent/90
                               text-white text-sm font-medium transition-colors cursor-pointer"
                  >
                    Continue <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* ── Step 2: Browser Extension (one-click setup) ── */}
              {step === 2 && (
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <Globe size={22} className="text-accent" />
                    <h2 className="text-xl font-bold">Browser Extension</h2>
                  </div>
                  <p className="text-txt-secondary text-sm mb-5">
                    Get URL-level tracking for every browser tab. Two quick steps:
                  </p>

                  {/* Step A: One-click setup */}
                  <div className="space-y-3 mb-5">
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-border-subtle">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-txt-primary flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">1</span>
                          Prepare extension files
                        </span>
                        {extSetupDone && <CheckCircle2 size={16} className="text-productive" />}
                      </div>
                      <p className="text-xs text-txt-muted mb-3">
                        This copies the extension and registers the communication bridge automatically.
                      </p>
                      <button
                        onClick={handleExtensionSetup}
                        disabled={extSetupRunning || extSetupDone}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
                          ${extSetupDone
                            ? 'bg-productive/15 text-productive border border-productive/30'
                            : 'bg-accent hover:bg-accent/90 text-white'
                          } disabled:opacity-60`}
                      >
                        {extSetupRunning ? (
                          <><Loader2 size={14} className="animate-spin" /> Setting up...</>
                        ) : extSetupDone ? (
                          <><Check size={14} /> Done!</>
                        ) : (
                          <><Check size={14} /> Set Up Automatically</>
                        )}
                      </button>
                    </div>

                    {/* Step B: Load in browser */}
                    <div className={`p-4 rounded-xl border transition-opacity ${extSetupDone ? 'bg-white/[0.02] border-border-subtle' : 'bg-white/[0.01] border-border-subtle opacity-50'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-bold">2</span>
                        <span className="text-sm font-medium text-txt-primary">Load in your browser</span>
                      </div>
                      <p className="text-xs text-txt-muted mb-3">
                        Click your browser below. On the extensions page, enable <strong>Developer Mode</strong>, click <strong>"Load unpacked"</strong>, and select the folder that opens.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => { handleOpenExtFolder(); handleOpenChrome(); }}
                          disabled={!extSetupDone}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-subtle text-xs text-txt-secondary
                                     hover:border-accent/30 hover:text-accent transition-colors cursor-pointer disabled:opacity-40"
                        >
                          <Globe size={14} /> Open Chrome
                        </button>
                        <button
                          onClick={async () => { handleOpenExtFolder(); handleOpenEdge(); }}
                          disabled={!extSetupDone}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-subtle text-xs text-txt-secondary
                                     hover:border-accent/30 hover:text-accent transition-colors cursor-pointer disabled:opacity-40"
                        >
                          <Globe size={14} /> Open Edge
                        </button>
                        <button
                          onClick={handleOpenExtFolder}
                          disabled={!extSetupDone}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-subtle text-xs text-txt-muted
                                     hover:border-border-active transition-colors cursor-pointer disabled:opacity-40"
                        >
                          <FolderOpen size={14} /> Open Folder
                        </button>
                      </div>
                      {extPath && (
                        <p className="text-[10px] text-txt-muted font-mono mt-2 truncate">{extPath}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={goNext}
                      className="px-5 py-2 rounded-lg border border-border-subtle text-txt-muted text-sm
                                 hover:border-border-active hover:text-txt-secondary transition-colors cursor-pointer"
                    >
                      Skip for now
                    </button>
                    <button
                      onClick={goNext}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent hover:bg-accent/90
                                 text-white text-sm font-medium transition-colors cursor-pointer"
                    >
                      Continue <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Export location ── */}
              {step === 3 && (
                <div>
                  <h2 className="text-xl font-bold mb-1">Export Location</h2>
                  <p className="text-txt-secondary text-sm mb-5">
                    Choose where your Excel reports will be saved.
                  </p>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1 px-3 py-2 rounded-lg bg-surface border border-border-subtle text-xs text-txt-secondary font-mono truncate">
                      {exportFolder || '~/Documents (default)'}
                    </div>
                    <button
                      onClick={handlePickFolder}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-subtle text-xs text-txt-muted
                                 hover:border-border-active hover:text-txt-secondary transition-colors cursor-pointer shrink-0"
                    >
                      <FolderOpen size={14} /> Browse
                    </button>
                  </div>
                  <button
                    onClick={handleFinish}
                    className="flex items-center gap-2 ml-auto px-6 py-2.5 rounded-lg bg-accent hover:bg-accent/90
                               text-white font-medium transition-colors cursor-pointer"
                  >
                    Start Tracking <Check size={16} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Step indicators ── */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-accent' : i < step ? 'bg-accent/40' : 'bg-border-subtle'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

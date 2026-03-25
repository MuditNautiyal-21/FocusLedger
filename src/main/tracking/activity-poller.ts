import { EventEmitter } from 'events';
import { dialog, systemPreferences } from 'electron';
import activeWin from 'active-win';
import { logActivity, endActivity, updateActivity } from '../database/queries';
import type { RulesEngine } from '../classification/rules-engine';
import type { BrowserBridge, TabChangeMessage } from './browser-bridge';
import type { Activity, Classification } from '../../shared/types';

// macOS accessibility permission check
let macAccessibilityWarned = false;
async function checkMacAccessibility(): Promise<boolean> {
  if (process.platform !== 'darwin') return true;
  // systemPreferences.isTrustedAccessibilityClient(false) checks without prompting
  const trusted = systemPreferences.isTrustedAccessibilityClient(false);
  if (!trusted && !macAccessibilityWarned) {
    macAccessibilityWarned = true;
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Accessibility Permission Required',
      message: 'FocusLedger needs Accessibility access to detect which app you\'re using.',
      detail: 'Go to System Settings → Privacy & Security → Accessibility → Enable FocusLedger.\n\nAfter enabling, restart FocusLedger.',
      buttons: ['Open System Settings', 'Later'],
      defaultId: 0,
    });
    if (result.response === 0) {
      // Prompt macOS to show the accessibility dialog
      systemPreferences.isTrustedAccessibilityClient(true);
    }
  }
  return trusted;
}

// ─── Constants ───────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 1000;

const BROWSER_NAMES = [
  'chrome', 'google chrome', 'chromium',
  'edge', 'microsoft edge', 'msedge',
  'firefox', 'mozilla firefox',
  'safari',
  'brave', 'brave browser',
  'arc',
  'opera', 'opera gx', 'vivaldi',
];

// ─── Helpers ─────────────────────────────────────────────────────────

function isBrowser(appName: string): boolean {
  const lower = appName.toLowerCase();
  return BROWSER_NAMES.some((b) => lower.includes(b));
}

function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function windowFingerprint(
  appName: string,
  title: string,
  domain: string | null,
): string {
  return `${appName}::${title}::${domain ?? ''}`;
}

function classificationKey(appName: string, domain: string | null): string {
  return domain ? `domain::${domain}` : `app::${appName}`;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface PollResult {
  appName: string;
  windowTitle: string;
  url: string | undefined;
  domain: string | null;
}

export interface ActivityPollerEvents {
  'activity-started': (activity: Activity) => void;
  'activity-ended': (activity: Activity) => void;
  'classification-needed': (activity: Activity) => void;
  'poll-error': (error: Error) => void;
  'idle': () => void;
  'resume-from-idle': () => void;
}

// ─── ActivityPoller ──────────────────────────────────────────────────

export class ActivityPoller extends EventEmitter {
  private sessionId: string;
  private rulesEngine: RulesEngine;
  private browserBridge: BrowserBridge | null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private currentActivity: Activity | null = null;
  private lastFingerprint: string = '';
  private isRunning = false;
  private isPaused = false;
  private wasIdle = false;

  /**
   * Tracks classifications already assigned in this session.
   * Key: "domain::example.com" or "app::Code.exe"
   * Value: the classification that was assigned (by rule or user)
   */
  private sessionClassifications = new Map<
    string,
    { classification: Classification; category: string | null }
  >();

  constructor(
    sessionId: string,
    rulesEngine: RulesEngine,
    browserBridge?: BrowserBridge | null,
  ) {
    super();
    this.sessionId = sessionId;
    this.rulesEngine = rulesEngine;
    this.browserBridge = browserBridge ?? null;
  }

  // ── Public API ────────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    console.log('[Poller] Started polling every', POLL_INTERVAL_MS, 'ms');
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.endCurrentActivity();
    console.log('[Poller] Stopped');
  }

  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.endCurrentActivity();
    console.log('[Poller] Paused');
  }

  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.lastFingerprint = '';
    console.log('[Poller] Resumed');
  }

  getCurrentActivity(): Activity | null {
    return this.currentActivity;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Called externally when the user classifies an activity
   * (from prompt or IPC). Updates the DB record and session memory.
   */
  applyClassification(
    activityId: string,
    classification: Classification,
    category: string | null,
  ): void {
    const updated: Activity = updateActivity(activityId, {
      classification,
      category,
      was_prompted: true,
    });

    const key = classificationKey(updated.app_name, updated.domain);
    this.sessionClassifications.set(key, { classification, category });

    if (this.currentActivity && this.currentActivity.id === activityId) {
      this.currentActivity = updated;
    }

    // Notify the browser extension of the classification
    if (this.browserBridge && updated.domain) {
      this.browserBridge.sendClassification(updated.domain, classification);
    }
  }

  // ── Internals ─────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    if (this.isPaused) return;

    // On macOS, check accessibility permissions before polling
    if (process.platform === 'darwin') {
      const hasAccess = await checkMacAccessibility();
      if (!hasAccess) return;
    }

    try {
      const win = await activeWin();

      // ── No active window → idle ──
      if (!win) {
        if (!this.wasIdle) {
          this.wasIdle = true;
          this.endCurrentActivity();
          this.emit('idle');
        }
        return;
      }

      // ── Resumed from idle ──
      if (this.wasIdle) {
        this.wasIdle = false;
        this.lastFingerprint = '';
        this.emit('resume-from-idle');
      }

      const appName = win.owner.name;
      const windowTitle = win.title;

      // Skip our own classification prompt window
      if (windowTitle === 'Classify Activity') return;

      // ── Determine URL and domain ──
      // If the active window is a browser AND the extension has sent tab data,
      // prefer the extension data (more accurate than parsing window titles)
      let url: string | null = null;
      let domain: string | null = null;

      if (isBrowser(appName)) {
        const bridgeData = this.getBridgeDataIfFresh();
        if (bridgeData) {
          url = bridgeData.url;
          domain = bridgeData.domain || extractDomain(bridgeData.url);
        } else {
          // Fallback: use active-win data
          const rawUrl = (win as { url?: string }).url;
          url = rawUrl ?? null;
          domain = extractDomain(rawUrl);
        }
      }

      const fp = windowFingerprint(appName, windowTitle, domain);

      // ── Same window as before → nothing to do ──
      if (fp === this.lastFingerprint) return;

      // ── Window changed → end previous, start new ──
      this.endCurrentActivity();
      this.lastFingerprint = fp;

      // ── Check rules engine (in-memory, fast) ──
      const rule = this.rulesEngine.match(appName, domain, windowTitle, url);

      let classification: Classification = 'unclassified';
      let category: string | null = null;
      let ruleMatchedId: string | null = null;
      let needsPrompt = false;

      if (rule) {
        classification = rule.classification;
        category = rule.category;
        ruleMatchedId = rule.id;
      } else {
        const key = classificationKey(appName, domain);
        const remembered = this.sessionClassifications.get(key);

        if (remembered) {
          classification = remembered.classification;
          category = remembered.category;
        } else {
          needsPrompt = true;
        }
      }

      const activity = logActivity({
        session_id: this.sessionId,
        app_name: appName,
        window_title: windowTitle,
        url,
        domain,
        started_at: new Date().toISOString(),
        classification,
        category,
        was_prompted: false,
        rule_matched_id: ruleMatchedId,
      });

      this.currentActivity = activity;
      this.emit('activity-started', activity);

      // Notify extension of classification
      if (this.browserBridge && domain) {
        this.browserBridge.sendClassification(domain, classification);
      }

      if (needsPrompt) {
        this.emit('classification-needed', activity);
      }
    } catch (err) {
      this.emit('poll-error', err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Get bridge data only if it's recent (within last 3 seconds).
   * Stale data means the extension might not be reporting for the current tab.
   */
  private getBridgeDataIfFresh(): TabChangeMessage | null {
    if (!this.browserBridge?.isConnected()) return null;
    const data = this.browserBridge.getLatestTabData();
    if (!data) return null;

    const age = Date.now() - data.timestamp;
    if (age > 3000) return null; // stale

    return data;
  }

  private endCurrentActivity(): void {
    if (!this.currentActivity) return;

    const now = new Date().toISOString();
    const startedMs = new Date(this.currentActivity.started_at).getTime();
    const durationSeconds = Math.round((Date.now() - startedMs) / 1000);

    const ended = endActivity(this.currentActivity.id, now, durationSeconds);
    this.emit('activity-ended', ended);
    this.currentActivity = null;
  }
}

import {
  createSession,
  endSession as dbEndSession,
  getSessionByDate,
  getSessionStats,
  getActivitiesBySession,
} from '../database/queries';
import { getDb } from '../database/connection';
import { ActivityPoller } from './activity-poller';
import { IdleDetector } from './idle-detector';
import { BrowserBridge } from './browser-bridge';
import { ClassificationPromptManager } from '../classification/prompt-window';
import type { RulesEngine } from '../classification/rules-engine';
import type { Session, SessionStats, Activity, Classification } from '../../shared/types';

// ─── Constants ───────────────────────────────────────────────────────

const STATS_FLUSH_INTERVAL_MS = 30_000;

// ─── Helpers ─────────────────────────────────────────────────────────

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ─── SessionManager ──────────────────────────────────────────────────

export class SessionManager {
  private session: Session | null = null;
  private poller: ActivityPoller | null = null;
  private idleDetector: IdleDetector | null = null;
  private browserBridge: BrowserBridge;
  private promptManager: ClassificationPromptManager;
  private rulesEngine: RulesEngine;
  private statsTimer: ReturnType<typeof setInterval> | null = null;

  constructor(rulesEngine: RulesEngine) {
    this.rulesEngine = rulesEngine;
    this.promptManager = new ClassificationPromptManager(rulesEngine);
    this.browserBridge = new BrowserBridge();
  }

  // ── Public API ────────────────────────────────────────────────────

  startSession(): Session {
    const today = todayDateStr();
    const existing = getSessionByDate(today);

    if (existing && !existing.ended_at) {
      console.log(`[Session] Resuming existing session ${existing.id} for ${today}`);
      this.session = existing;
    } else {
      const now = new Date().toISOString();
      this.session = createSession({ date: today, started_at: now });
      console.log(`[Session] Created new session ${this.session.id} for ${today}`);
    }

    // Boot the browser bridge (for extension communication)
    this.browserBridge.start();

    // Boot the activity poller with the shared rules engine + bridge
    this.poller = new ActivityPoller(this.session.id, this.rulesEngine, this.browserBridge);
    this.wirePollerEvents();
    this.poller.start();

    // Boot the idle detector
    this.idleDetector = new IdleDetector();
    this.wireIdleDetectorEvents();
    this.idleDetector.start();

    // Periodic stats flush
    this.statsTimer = setInterval(() => this.flushStats(), STATS_FLUSH_INTERVAL_MS);

    return this.session;
  }

  endSession(): Session | null {
    if (!this.session) return null;

    this.poller?.stop();
    this.idleDetector?.stop();
    this.browserBridge.stop();
    this.promptManager.destroy();
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }

    const stats = this.flushStats();
    const now = new Date().toISOString();
    const ended = dbEndSession(this.session.id, now, stats);
    console.log(`[Session] Ended session ${this.session.id} — score: ${stats.productivity_score}%`);

    this.session = ended;
    const result = this.session;
    this.session = null;
    this.poller = null;
    this.idleDetector = null;
    return result;
  }

  getStats(): SessionStats | null {
    if (!this.session) return null;
    return getSessionStats(this.session.id);
  }

  getSession(): Session | null {
    return this.session;
  }

  getActivities(): Activity[] {
    if (!this.session) return [];
    return getActivitiesBySession(this.session.id);
  }

  pauseTracking(): void {
    this.poller?.pause();
    console.log('[Session] Tracking paused');
  }

  resumeTracking(): void {
    this.poller?.resume();
    console.log('[Session] Tracking resumed');
  }

  isTracking(): boolean {
    return this.poller?.getIsRunning() ?? false;
  }

  isPaused(): boolean {
    return this.poller?.getIsPaused() ?? false;
  }

  getCurrentActivity(): Activity | null {
    return this.poller?.getCurrentActivity() ?? null;
  }

  classifyActivity(activityId: string, classification: Classification, category: string | null): void {
    this.poller?.applyClassification(activityId, classification, category);
  }

  // ── Internals ─────────────────────────────────────────────────────

  private flushStats(): SessionStats {
    if (!this.session) {
      return {
        total_seconds: 0, productive_seconds: 0, wasted_seconds: 0,
        neutral_seconds: 0, productivity_score: 0,
      };
    }

    const stats = getSessionStats(this.session.id);

    const db = getDb();
    db.prepare(`
      UPDATE sessions
      SET total_seconds = ?, productive_seconds = ?, wasted_seconds = ?,
          neutral_seconds = ?, productivity_score = ?
      WHERE id = ?
    `).run(
      stats.total_seconds, stats.productive_seconds, stats.wasted_seconds,
      stats.neutral_seconds, stats.productivity_score, this.session.id,
    );

    return stats;
  }

  private wirePollerEvents(): void {
    if (!this.poller) return;

    this.poller.on('activity-started', (activity: Activity) => {
      console.log(`[Poller] ▶ ${activity.app_name} — ${(activity.window_title ?? '').substring(0, 60)}`);
    });

    this.poller.on('activity-ended', (activity: Activity) => {
      console.log(
        `[Poller] ■ ${activity.app_name} — ${activity.duration_seconds}s [${activity.classification}]`,
      );
    });

    this.poller.on('classification-needed', (activity: Activity) => {
      console.log(`[Prompt] Showing classification prompt for: ${activity.app_name} (${activity.domain ?? 'no domain'})`);

      this.promptManager.showPrompt(activity).then((result) => {
        console.log(
          `[Prompt] User classified ${activity.app_name} as: ${result.classification}` +
            (result.shouldRemember ? ' (remembered)' : '') +
            (result.shouldExclude ? ' (excluded)' : ''),
        );

        this.poller?.applyClassification(
          result.activityId,
          result.classification,
          result.category,
        );
      }).catch((err) => {
        console.error('[Prompt] Error:', err);
      });
    });

    this.poller.on('poll-error', (err: Error) => {
      console.error('[Poller] Poll error:', err.message);
    });
  }

  private wireIdleDetectorEvents(): void {
    if (!this.idleDetector) return;

    this.idleDetector.on('idle-start', (idleSeconds: number) => {
      console.log(`[Idle] System idle for ${idleSeconds}s — pausing poller`);
      this.poller?.pause();
    });

    this.idleDetector.on('idle-end', (awaySeconds: number) => {
      console.log(`[Idle] User returned after ${awaySeconds}s`);
      this.poller?.resume();
    });
  }
}

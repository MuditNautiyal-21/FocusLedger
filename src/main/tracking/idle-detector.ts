import { EventEmitter } from 'events';
import { powerMonitor } from 'electron';

// ─── Constants ───────────────────────────────────────────────────────

const DEFAULT_IDLE_THRESHOLD_SECONDS = 300; // 5 minutes
const CHECK_INTERVAL_MS = 10_000;           // check every 10s

// ─── IdleDetector ────────────────────────────────────────────────────

export interface IdleDetectorEvents {
  /**
   * Fired once when idle time exceeds the threshold.
   * @param idleSeconds — how many seconds the system has been idle
   */
  'idle-start': (idleSeconds: number) => void;

  /**
   * Fired when the user comes back from an idle period.
   * @param awaySeconds — total seconds the user was away
   */
  'idle-end': (awaySeconds: number) => void;

  /** Fired on lock-screen */
  'lock': () => void;

  /** Fired when the screen is unlocked */
  'unlock': () => void;
}

export class IdleDetector extends EventEmitter {
  private thresholdSeconds: number;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private isIdle = false;
  private idleStartedAt: number | null = null;
  private isRunning = false;

  constructor(thresholdSeconds: number = DEFAULT_IDLE_THRESHOLD_SECONDS) {
    super();
    this.thresholdSeconds = thresholdSeconds;
  }

  // ── Public API ────────────────────────────────────────────────────

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Poll system idle time
    this.checkTimer = setInterval(() => this.checkIdle(), CHECK_INTERVAL_MS);

    // Lock/unlock events
    powerMonitor.on('lock-screen', this.onLock);
    powerMonitor.on('unlock-screen', this.onUnlock);
    powerMonitor.on('suspend', this.onLock);
    powerMonitor.on('resume', this.onUnlock);

    console.log(`[Idle] Detector started (threshold: ${this.thresholdSeconds}s)`);
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    powerMonitor.off('lock-screen', this.onLock);
    powerMonitor.off('unlock-screen', this.onUnlock);
    powerMonitor.off('suspend', this.onLock);
    powerMonitor.off('resume', this.onUnlock);

    console.log('[Idle] Detector stopped');
  }

  getIsIdle(): boolean {
    return this.isIdle;
  }

  setThreshold(seconds: number): void {
    this.thresholdSeconds = seconds;
  }

  // ── Internals ─────────────────────────────────────────────────────

  private checkIdle(): void {
    const idleSeconds = powerMonitor.getSystemIdleTime();

    if (!this.isIdle && idleSeconds >= this.thresholdSeconds) {
      // Just went idle
      this.isIdle = true;
      this.idleStartedAt = Date.now() - idleSeconds * 1000;
      this.emit('idle-start', idleSeconds);
    } else if (this.isIdle && idleSeconds < this.thresholdSeconds) {
      // Came back from idle
      const awaySeconds = this.idleStartedAt
        ? Math.round((Date.now() - this.idleStartedAt) / 1000)
        : idleSeconds;
      this.isIdle = false;
      this.idleStartedAt = null;
      this.emit('idle-end', awaySeconds);
    }
  }

  private onLock = (): void => {
    if (!this.isIdle) {
      this.isIdle = true;
      this.idleStartedAt = Date.now();
      this.emit('lock');
      this.emit('idle-start', 0);
    }
  };

  private onUnlock = (): void => {
    if (this.isIdle) {
      const awaySeconds = this.idleStartedAt
        ? Math.round((Date.now() - this.idleStartedAt) / 1000)
        : 0;
      this.isIdle = false;
      this.idleStartedAt = null;
      this.emit('unlock');
      this.emit('idle-end', awaySeconds);
    }
  };
}

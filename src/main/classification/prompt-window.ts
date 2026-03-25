import { BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { getAllCategories } from '../database/queries';
import type { RulesEngine } from './rules-engine';
import type { Activity, Classification, Category } from '../../shared/types';

// ─── Types ───────────────────────────────────────────────────────────

export interface PromptResult {
  activityId: string;
  classification: Classification;
  category: string | null;
  shouldRemember: boolean;
  shouldExclude: boolean;
}

interface QueueItem {
  activity: Activity;
  resolve: (result: PromptResult) => void;
}

// ─── Constants ───────────────────────────────────────────────────────

const PROMPT_WIDTH = 400;
const PROMPT_HEIGHT = 340;
const BADGE_SIZE = 48;
const DISMISS_TIMEOUT_MS = 30_000; // force-dismiss after 30s if no interaction at all

// ─── ClassificationPromptManager ─────────────────────────────────────

export class ClassificationPromptManager {
  private rulesEngine: RulesEngine;
  private queue: QueueItem[] = [];
  private currentWindow: BrowserWindow | null = null;
  private isShowingPrompt = false;
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private cachedCategories: Category[] | null = null;

  constructor(rulesEngine: RulesEngine) {
    this.rulesEngine = rulesEngine;
  }

  /**
   * Show a classification prompt for the given activity.
   * Returns a Promise that resolves when the user responds.
   * If a prompt is already showing, this queues the request.
   */
  showPrompt(activity: Activity): Promise<PromptResult> {
    return new Promise<PromptResult>((resolve) => {
      this.queue.push({ activity, resolve });

      if (!this.isShowingPrompt) {
        this.processQueue();
      }
    });
  }

  /** Destroy any open prompt windows (used on app quit) */
  destroy(): void {
    this.clearDismissTimer();
    if (this.currentWindow && !this.currentWindow.isDestroyed()) {
      this.currentWindow.destroy();
    }
    this.currentWindow = null;
    this.isShowingPrompt = false;

    // Resolve any queued prompts with neutral default
    for (const item of this.queue) {
      item.resolve({
        activityId: item.activity.id,
        classification: 'neutral',
        category: null,
        shouldRemember: false,
        shouldExclude: false,
      });
    }
    this.queue = [];
  }

  // ── Queue processing ──────────────────────────────────────────────

  private processQueue(): void {
    if (this.queue.length === 0) {
      this.isShowingPrompt = false;
      return;
    }

    this.isShowingPrompt = true;
    const item = this.queue[0]; // peek, don't shift yet
    this.openPromptWindow(item);
  }

  // ── Window creation ───────────────────────────────────────────────

  private openPromptWindow(item: QueueItem): void {
    const { x, y } = this.getPromptPosition(PROMPT_WIDTH, PROMPT_HEIGHT);

    // Load categories for the dropdown
    if (!this.cachedCategories) {
      this.cachedCategories = getAllCategories();
    }

    const win = new BrowserWindow({
      width: PROMPT_WIDTH,
      height: PROMPT_HEIGHT,
      x,
      y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      focusable: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    this.currentWindow = win;

    // Build query params for the HTML
    const params = new URLSearchParams({
      activityId: item.activity.id,
      appName: item.activity.app_name,
      windowTitle: item.activity.window_title ?? '',
      domain: item.activity.domain ?? '',
      categories: encodeURIComponent(JSON.stringify(this.cachedCategories)),
    });

    // Load the prompt HTML (copied to dist/main/classification/ alongside compiled JS)
    const htmlPath = path.join(__dirname, 'prompt.html');
    win.loadFile(htmlPath, { query: Object.fromEntries(params) });

    win.once('ready-to-show', () => {
      win.show();
    });

    // ── Listen for hash navigation (how the HTML communicates back) ──
    win.webContents.on('did-navigate-in-page', (_event, url) => {
      const hash = new URL(url).hash;

      if (hash.startsWith('#result=')) {
        this.clearDismissTimer();
        try {
          const json = decodeURIComponent(hash.slice('#result='.length));
          const result: PromptResult = JSON.parse(json);

          // If user wants to remember → create a persistent rule
          if (result.shouldRemember || result.shouldExclude) {
            this.createPersistentRule(item.activity, result);
          }

          // Resolve the Promise and advance the queue
          this.queue.shift();
          item.resolve(result);
        } catch (err) {
          console.error('[Prompt] Failed to parse result:', err);
          this.queue.shift();
          item.resolve({
            activityId: item.activity.id,
            classification: 'neutral',
            category: null,
            shouldRemember: false,
            shouldExclude: false,
          });
        }

        this.closeCurrentWindow();
        // Small delay before showing next prompt
        setTimeout(() => this.processQueue(), 300);
      }

      if (hash === '#minimise') {
        this.minimiseTooltip(win);
      }

      if (hash === '#expand') {
        this.expandFromBadge(win);
      }
    });

    // ── Force dismiss timer ──
    this.dismissTimer = setTimeout(() => {
      console.log('[Prompt] Auto-dismissing after timeout');
      this.queue.shift();
      item.resolve({
        activityId: item.activity.id,
        classification: 'neutral',
        category: null,
        shouldRemember: false,
        shouldExclude: false,
      });
      this.closeCurrentWindow();
      setTimeout(() => this.processQueue(), 300);
    }, DISMISS_TIMEOUT_MS);

    // ── Handle window closed manually ──
    win.on('closed', () => {
      if (this.currentWindow === win) {
        this.currentWindow = null;
      }
    });
  }

  // ── Minimise / expand ─────────────────────────────────────────────

  private minimiseTooltip(win: BrowserWindow): void {
    if (win.isDestroyed()) return;
    const { x, y } = this.getPromptPosition(BADGE_SIZE, BADGE_SIZE);
    win.setBounds({ x, y, width: BADGE_SIZE, height: BADGE_SIZE });
  }

  private expandFromBadge(win: BrowserWindow): void {
    if (win.isDestroyed()) return;
    const { x, y } = this.getPromptPosition(PROMPT_WIDTH, PROMPT_HEIGHT);
    win.setBounds({ x, y, width: PROMPT_WIDTH, height: PROMPT_HEIGHT });
  }

  // ── Position calculation ──────────────────────────────────────────

  private getPromptPosition(width: number, height: number): { x: number; y: number } {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
    const { x: workX, y: workY } = primaryDisplay.workArea;

    // Bottom-right on Windows, top-right on macOS
    const margin = 12;
    const x = workX + screenW - width - margin;
    const y = process.platform === 'darwin'
      ? workY + margin
      : workY + screenH - height - margin;

    return { x, y };
  }

  // ── Rule creation ─────────────────────────────────────────────────

  private createPersistentRule(activity: Activity, result: PromptResult): void {
    const hasDomain = !!activity.domain;

    if (result.shouldExclude) {
      this.rulesEngine.addRule({
        type: hasDomain ? 'domain' : 'app',
        pattern: hasDomain ? activity.domain! : activity.app_name,
        classification: 'neutral',
        category: null,
        priority: 50,
      });
      console.log(`[Prompt] Created exclusion rule for: ${hasDomain ? activity.domain : activity.app_name}`);
    } else if (result.shouldRemember) {
      this.rulesEngine.addRule({
        type: hasDomain ? 'domain' : 'app',
        pattern: hasDomain ? activity.domain! : activity.app_name,
        classification: result.classification,
        category: result.category,
        priority: 20,
      });
      console.log(
        `[Prompt] Created rule: ${hasDomain ? activity.domain : activity.app_name} → ${result.classification}`,
      );
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  private closeCurrentWindow(): void {
    this.clearDismissTimer();
    if (this.currentWindow && !this.currentWindow.isDestroyed()) {
      this.currentWindow.destroy();
    }
    this.currentWindow = null;
  }

  private clearDismissTimer(): void {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  }
}

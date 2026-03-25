import { Tray, Menu, app, BrowserWindow, nativeImage, Notification } from 'electron';
import * as path from 'path';
import { ExcelReportBuilder } from './export/excel-builder';
import { logExport } from './database/queries';
import { getDb } from './database/connection';
import type { SessionManager } from './tracking/session-manager';

let tray: Tray | null = null;
let updateTimer: ReturnType<typeof setInterval> | null = null;
let trayNotificationShown = false;

function fmtHM(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getTrayIconPath(state: 'tracking' | 'paused' | 'stopped'): string {
  // macOS uses "Template" images — the OS auto-colors them for light/dark menu bar
  if (process.platform === 'darwin') {
    return path.join(__dirname, '../../resources/tray-iconTemplate.png');
  }
  return path.join(__dirname, '../../resources/tray-icon.png');
}

export function createTray(
  mainWindow: BrowserWindow,
  sessionManager: SessionManager,
): void {
  const iconPath = getTrayIconPath('tracking');
  tray = new Tray(iconPath);
  tray.setToolTip('FocusLedger — Tracking');

  // ── Click to toggle window ──
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // ── Build and update context menu ──
  function rebuildMenu() {
    if (!tray) return;

    const isTracking = sessionManager.isTracking();
    const isPaused = sessionManager.isPaused();
    const stats = sessionManager.getStats();
    const prodTime = stats ? fmtHM(stats.productive_seconds) : '0m';
    const score = stats ? Math.round(stats.productivity_score) : 0;

    const state = !isTracking ? 'stopped' : isPaused ? 'paused' : 'tracking';
    tray.setToolTip(`FocusLedger — ${state === 'tracking' ? 'Tracking' : state === 'paused' ? 'Paused' : 'Stopped'}`);

    const menu = Menu.buildFromTemplate([
      { label: 'FocusLedger', enabled: false },
      { type: 'separator' },
      {
        label: 'Open Dashboard',
        click: () => { mainWindow.show(); mainWindow.focus(); },
      },
      {
        label: isPaused ? 'Resume Tracking' : 'Pause Tracking',
        click: () => {
          if (isPaused) sessionManager.resumeTracking();
          else sessionManager.pauseTracking();
          rebuildMenu();
        },
      },
      {
        label: `Today: ${prodTime} productive (${score}%)`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: "Export Today's Report",
        click: () => {
          // Trigger export via the same path as IPC
          try {
            const today = new Date().toISOString().slice(0, 10);
            const db = getDb();
            const setting = db.prepare(`SELECT value FROM settings WHERE key = 'defaultExportFolder'`).get() as { value: string } | undefined;
            const folder = setting?.value || app.getPath('documents');
            const outputPath = path.join(folder, `FocusLedger_Report_${today}.xlsx`);
            const builder = new ExcelReportBuilder();
            builder.generateReport({ start: today, end: today }, outputPath).then(() => {
              const session = sessionManager.getSession();
              logExport(session?.id ?? null, outputPath);
              new Notification({ title: 'FocusLedger', body: `Report exported to ${outputPath}` }).show();
            });
          } catch (err) {
            console.error('[Tray] Export failed:', err);
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit FocusLedger',
        click: () => {
          (app as any).isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(menu);
  }

  rebuildMenu();

  // Update stats in menu every 30 seconds
  updateTimer = setInterval(rebuildMenu, 30_000);
}

/**
 * Show a one-time notification when the window is hidden to tray.
 */
export function showTrayNotification(): void {
  if (trayNotificationShown) return;
  trayNotificationShown = true;

  new Notification({
    title: 'FocusLedger',
    body: 'FocusLedger is still tracking in the background. Click the tray icon to reopen.',
  }).show();
}

export function destroyTray(): void {
  if (updateTimer) { clearInterval(updateTimer); updateTimer = null; }
  if (tray) { tray.destroy(); tray = null; }
}


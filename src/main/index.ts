import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { initLogger, backupDatabase } from './logger';
import { runMigrations } from './database/migrations';
import { closeDb } from './database/connection';
import { seedDefaultRules } from './classification/defaults';
import { RulesEngine } from './classification/rules-engine';
import { SessionManager } from './tracking/session-manager';
import { registerIpcHandlers } from './ipc/handlers';
import { createTray, showTrayNotification, destroyTray } from './tray';
import { createAppMenu } from './menu';
import { registerNativeHost, installExtensionFiles } from './extension-setup';

let mainWindow: BrowserWindow | null = null;
let sessionManager: SessionManager | null = null;
let rulesEngine: RulesEngine | null = null;

// Check if launched with --hidden flag (auto-launch minimized)
const startHidden = process.argv.includes('--hidden');

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'FocusLedger',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (!startHidden) {
      mainWindow?.show();
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // ── Minimize to tray on close (don't quit) ──
  mainWindow.on('close', (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
      showTrayNotification();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // ── 1. Logger + backup ──
  initLogger();
  backupDatabase();

  // ── 2. Database ──
  console.log('[App] Initializing database...');
  runMigrations();
  console.log('[App] Database ready.');

  // ── 3. Seed default rules ──
  seedDefaultRules();

  // ── 4. Rules engine ──
  rulesEngine = new RulesEngine();

  // ── 5. Session + tracking ──
  sessionManager = new SessionManager(rulesEngine);
  const session = sessionManager.startSession();
  console.log(`[App] Session active: ${session.id} (${session.date})`);

  // ── 6. IPC handlers ──
  registerIpcHandlers(sessionManager, rulesEngine);

  // ── 7. App menu ──
  createAppMenu();

  // ── 8. Window ──
  createWindow();

  // ── 9. System tray ──
  if (mainWindow) {
    createTray(mainWindow, sessionManager);
  }

  // ── 10. Auto-launch setup ──
  setupAutoLaunch();

  // ── 11. Auto-register native messaging host + install extension files ──
  registerNativeHost();
  installExtensionFiles();
});

app.on('window-all-closed', () => {
  // On macOS, keep app running; on others, this shouldn't fire due to close prevention
  if (process.platform !== 'darwin') {
    // Don't quit — tray keeps the app alive
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('before-quit', () => {
  (app as any).isQuitting = true;
  if (sessionManager) {
    console.log('[App] Shutting down — ending session...');
    sessionManager.endSession();
  }
  destroyTray();
  closeDb();
});

// ─── Auto-launch ─────────────────────────────────────────────────────

function setupAutoLaunch(): void {
  try {
    const AutoLaunch = require('auto-launch');
    const launcher = new AutoLaunch({
      name: 'FocusLedger',
      path: app.getPath('exe'),
      isHidden: true, // adds --hidden flag
    });

    // Check current setting
    const { getDb } = require('./database/connection');
    const db = getDb();
    const row = db.prepare(`SELECT value FROM settings WHERE key = 'autoLaunch'`).get() as { value: string } | undefined;
    const enabled = row?.value === 'true';

    launcher.isEnabled().then((isEnabled: boolean) => {
      if (enabled && !isEnabled) {
        launcher.enable();
        console.log('[AutoLaunch] Enabled');
      } else if (!enabled && isEnabled) {
        launcher.disable();
        console.log('[AutoLaunch] Disabled');
      }
    }).catch((err: Error) => {
      console.error('[AutoLaunch] Error:', err.message);
    });
  } catch (err) {
    console.error('[AutoLaunch] Setup failed:', err);
  }
}

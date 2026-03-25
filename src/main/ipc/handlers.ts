import { ipcMain, dialog, app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { SessionManager } from '../tracking/session-manager';
import type { RulesEngine, TestRuleInput } from '../classification/rules-engine';
import {
  getActivitiesByDateRange,
  getTopApps,
  getProductivityByHour,
  getActivitiesBySession,
  getFilteredActivities,
  updateActivity,
  getAllCategories,
  logExport,
} from '../database/queries';
import type { FilteredActivitiesParams } from '../database/queries';
import { getDb } from '../database/connection';
import { ExcelReportBuilder } from '../export/excel-builder';
import { seedDefaultRules } from '../classification/defaults';
import {
  runFullExtensionSetup,
  getExtensionSetupStatus,
  openBrowserExtensionPage,
  openExtensionFolder,
} from '../extension-setup';
import { IpcChannel } from '../../shared/types';
import type { Classification, CreateRuleParams, UpdateRuleParams } from '../../shared/types';

/**
 * Register all IPC handlers that the renderer process can invoke.
 */
export function registerIpcHandlers(
  sessionManager: SessionManager,
  rulesEngine: RulesEngine,
): void {
  // ── Tracking control ──────────────────────────────────────────────

  ipcMain.handle(IpcChannel.TRACKING_START, () => {
    sessionManager.resumeTracking();
    return { ok: true };
  });

  ipcMain.handle(IpcChannel.TRACKING_STOP, () => {
    sessionManager.pauseTracking();
    return { ok: true };
  });

  ipcMain.handle(IpcChannel.TRACKING_STATUS, () => {
    const current = sessionManager.getCurrentActivity();
    return {
      isTracking: sessionManager.isTracking(),
      isPaused: sessionManager.isPaused(),
      currentActivity: current,
    };
  });

  // ── Session ───────────────────────────────────────────────────────

  ipcMain.handle(IpcChannel.SESSION_CURRENT, () => {
    return sessionManager.getSession();
  });

  ipcMain.handle(IpcChannel.SESSION_STATS, () => {
    return sessionManager.getStats();
  });

  // ── Activities ────────────────────────────────────────────────────

  ipcMain.handle(
    IpcChannel.ACTIVITIES_LIST,
    (_event, sessionId: string) => {
      return getActivitiesBySession(sessionId);
    },
  );

  ipcMain.handle(
    IpcChannel.ACTIVITIES_BY_DATE_RANGE,
    (_event, startDate: string, endDate: string) => {
      return getActivitiesByDateRange(startDate, endDate);
    },
  );

  ipcMain.handle(
    IpcChannel.ACTIVITIES_TOP_APPS,
    (_event, sessionId: string, limit?: number) => {
      return getTopApps(sessionId, limit);
    },
  );

  ipcMain.handle(
    IpcChannel.ACTIVITIES_HOURLY,
    (_event, sessionId: string) => {
      return getProductivityByHour(sessionId);
    },
  );

  // ── Rules (via RulesEngine — modifies DB + reloads cache) ─────────

  ipcMain.handle(IpcChannel.RULES_LIST, () => {
    return rulesEngine.getAll();
  });

  ipcMain.handle(
    IpcChannel.RULES_CREATE,
    (_event, params: CreateRuleParams) => {
      return rulesEngine.addRule(params);
    },
  );

  ipcMain.handle(
    IpcChannel.RULES_UPDATE,
    (_event, id: string, params: UpdateRuleParams) => {
      return rulesEngine.modifyRule(id, params);
    },
  );

  ipcMain.handle(
    IpcChannel.RULES_DELETE,
    (_event, id: string) => {
      rulesEngine.removeRule(id);
      return { ok: true };
    },
  );

  ipcMain.handle(
    IpcChannel.RULES_REORDER,
    (_event, pairs: { id: string; priority: number }[]) => {
      rulesEngine.reorderRules(pairs);
      return { ok: true };
    },
  );

  ipcMain.handle(IpcChannel.RULES_SUGGEST, () => {
    return rulesEngine.suggestRules();
  });

  ipcMain.handle(
    IpcChannel.RULES_TEST,
    (_event, input: TestRuleInput) => {
      return { matches: rulesEngine.testRule(input) };
    },
  );

  // ── Categories ────────────────────────────────────────────────────

  ipcMain.handle(IpcChannel.CATEGORIES_LIST, () => {
    return getAllCategories();
  });

  // ── Classification from renderer ──────────────────────────────────

  ipcMain.handle(
    IpcChannel.CLASSIFY_ACTIVITY,
    (_event, activityId: string, classification: Classification, category: string | null) => {
      sessionManager.classifyActivity(activityId, classification, category);
      return { ok: true };
    },
  );

  // ── Filtered activities (timeline) ──────────────────────────────────

  ipcMain.handle(
    IpcChannel.ACTIVITIES_FILTERED,
    (_event, params: FilteredActivitiesParams) => {
      return getFilteredActivities(params);
    },
  );

  ipcMain.handle(
    IpcChannel.ACTIVITIES_RECLASSIFY,
    (_event, activityId: string, classification: Classification, category: string | null) => {
      return updateActivity(activityId, { classification, category });
    },
  );

  // ── Export ─────────────────────────────────────────────────────────

  ipcMain.handle(
    IpcChannel.EXPORT_REPORT,
    async (_event, startDate: string, endDate: string) => {
      try {
        // Determine output folder
        const db = getDb();
        const setting = db.prepare(`SELECT value FROM settings WHERE key = 'defaultExportFolder'`).get() as { value: string } | undefined;
        let folder = setting?.value;
        if (!folder) {
          folder = app.getPath('documents');
        }

        const fileName = `FocusLedger_Report_${startDate}_to_${endDate}.xlsx`;
        const outputPath = path.join(folder, fileName);

        const builder = new ExcelReportBuilder();
        await builder.generateReport({ start: startDate, end: endDate }, outputPath);

        // Log export in DB
        const session = sessionManager.getSession();
        logExport(session?.id ?? null, outputPath);

        return { ok: true, filePath: outputPath, message: `Report saved to ${outputPath}` };
      } catch (err: any) {
        console.error('[Export] Failed:', err);
        return { ok: false, filePath: null, message: err.message ?? 'Export failed' };
      }
    },
  );

  ipcMain.handle(IpcChannel.OPEN_FILE, async (_event, filePath: string) => {
    await shell.openPath(filePath);
    return { ok: true };
  });

  ipcMain.handle(IpcChannel.OPEN_FOLDER, (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return { ok: true };
  });

  // ── Settings ───────────────────────────────────────────────────────

  ipcMain.handle(IpcChannel.SETTINGS_GET, () => {
    const db = getDb();
    const rows = db.prepare(`SELECT key, value FROM settings`).all() as { key: string; value: string }[];
    const obj: Record<string, string> = {};
    for (const r of rows) obj[r.key] = r.value;
    return obj;
  });

  ipcMain.handle(IpcChannel.SETTINGS_UPDATE, (_event, key: string, value: string) => {
    const db = getDb();
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, value);
    return { ok: true };
  });

  ipcMain.handle(IpcChannel.SETTINGS_PICK_FOLDER, async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths.length) return { path: null };
    return { path: result.filePaths[0] };
  });

  ipcMain.handle(IpcChannel.SETTINGS_CLEAR_HISTORY, () => {
    const db = getDb();
    db.exec(`DELETE FROM activities; DELETE FROM sessions;`);
    return { ok: true };
  });

  ipcMain.handle(IpcChannel.SETTINGS_EXPORT_JSON, async () => {
    const db = getDb();
    const data = {
      sessions: db.prepare(`SELECT * FROM sessions`).all(),
      activities: db.prepare(`SELECT * FROM activities`).all(),
      rules: db.prepare(`SELECT * FROM rules`).all(),
      categories: db.prepare(`SELECT * FROM categories`).all(),
      settings: db.prepare(`SELECT * FROM settings`).all(),
    };
    const result = await dialog.showSaveDialog({
      defaultPath: `focusledger-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, message: 'Cancelled' };
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
    return { ok: true, filePath: result.filePath };
  });

  ipcMain.handle(IpcChannel.SETTINGS_RESET_RULES, () => {
    const db = getDb();
    db.exec(`DELETE FROM rules`);
    db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('default_rules_seeded', '0')`).run();
    seedDefaultRules();
    rulesEngine.reload();
    return { ok: true };
  });

  // ── DB status (debug) ─────────────────────────────────────────────

  // ── Extension setup ──────────────────────────────────────────────────

  ipcMain.handle(IpcChannel.EXT_SETUP_STATUS, () => {
    return getExtensionSetupStatus();
  });

  ipcMain.handle(IpcChannel.EXT_SETUP_RUN, () => {
    return runFullExtensionSetup();
  });

  ipcMain.handle(IpcChannel.EXT_OPEN_BROWSER, (_event, browser?: string) => {
    openBrowserExtensionPage((browser as 'chrome' | 'edge') ?? 'chrome');
    return { ok: true };
  });

  ipcMain.handle(IpcChannel.EXT_OPEN_FOLDER, () => {
    openExtensionFolder();
    return { ok: true };
  });

  // ── DB status (debug) ─────────────────────────────────────────────

  ipcMain.handle(IpcChannel.DB_STATUS, () => {
    const session = sessionManager.getSession();
    return {
      hasSession: !!session,
      sessionId: session?.id ?? null,
      isTracking: sessionManager.isTracking(),
      isPaused: sessionManager.isPaused(),
    };
  });

  console.log('[IPC] All handlers registered');
}

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = 'focusledger.log';
let logStream: fs.WriteStream | null = null;

function getLogPath(): string {
  return path.join(app.getPath('userData'), LOG_FILE);
}

export function initLogger(): void {
  const logPath = getLogPath();
  logStream = fs.createWriteStream(logPath, { flags: 'a' });

  // Redirect console.log and console.error to both terminal and file
  const origLog = console.log.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    origLog(...args);
    writeLog('INFO', args);
  };

  console.error = (...args: unknown[]) => {
    origError(...args);
    writeLog('ERROR', args);
  };

  // Catch uncaught exceptions
  process.on('uncaughtException', (err) => {
    writeLog('FATAL', [`Uncaught exception: ${err.message}`, err.stack]);
    origError('FATAL:', err);
  });

  process.on('unhandledRejection', (reason) => {
    writeLog('FATAL', [`Unhandled rejection: ${reason}`]);
    origError('FATAL unhandled rejection:', reason);
  });

  console.log(`[Logger] Logging to ${logPath}`);
}

function writeLog(level: string, args: unknown[]): void {
  if (!logStream) return;
  const ts = new Date().toISOString();
  const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  logStream.write(`[${ts}] [${level}] ${msg}\n`);
}

export function getLogFilePath(): string {
  return getLogPath();
}

/**
 * Auto-backup the database file (called on startup).
 */
export function backupDatabase(): void {
  try {
    const dbPath = path.join(app.getPath('userData'), 'focusledger.db');
    const backupPath = dbPath + '.bak';

    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      // Only backup if DB > 4KB (has real data) and backup is > 24h old
      if (stats.size > 4096) {
        let shouldBackup = true;
        if (fs.existsSync(backupPath)) {
          const bakStats = fs.statSync(backupPath);
          const ageMs = Date.now() - bakStats.mtimeMs;
          if (ageMs < 24 * 60 * 60 * 1000) shouldBackup = false; // less than 24h
        }
        if (shouldBackup) {
          fs.copyFileSync(dbPath, backupPath);
          console.log('[Backup] Database backed up');
        }
      }
    }
  } catch (err) {
    console.error('[Backup] Failed:', err);
  }
}

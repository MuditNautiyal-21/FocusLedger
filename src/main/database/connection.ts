import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';

let db: Database.Database | null = null;

/**
 * Returns the singleton database connection.
 * Creates and configures it on first call.
 */
export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'focusledger.db');
  console.log(`[DB] Opening database at: ${dbPath}`);

  db = new Database(dbPath);

  // ── Performance pragmas ──
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  console.log('[DB] Database connection established (WAL mode)');
  return db;
}

/**
 * Gracefully close the database connection.
 * Call this on app quit.
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database connection closed');
  }
}

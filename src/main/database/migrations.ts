import Database from 'better-sqlite3';
import { getDb } from './connection';

// ─── Migration Registry ─────────────────────────────────────────────

interface Migration {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Create core tables, indexes, and seed default categories',
    up: (db) => {
      // ── Sessions ──
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id                  TEXT PRIMARY KEY,
          date                TEXT NOT NULL,
          started_at          TEXT NOT NULL,
          ended_at            TEXT,
          total_seconds       INTEGER DEFAULT 0,
          productive_seconds  INTEGER DEFAULT 0,
          wasted_seconds      INTEGER DEFAULT 0,
          neutral_seconds     INTEGER DEFAULT 0,
          productivity_score  REAL    DEFAULT 0.0
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
      `);

      // ── Activities ──
      db.exec(`
        CREATE TABLE IF NOT EXISTS activities (
          id                TEXT PRIMARY KEY,
          session_id        TEXT NOT NULL,
          app_name          TEXT NOT NULL,
          window_title      TEXT,
          url               TEXT,
          domain            TEXT,
          started_at        TEXT NOT NULL,
          ended_at          TEXT,
          duration_seconds  INTEGER DEFAULT 0,
          classification    TEXT    DEFAULT 'unclassified'
                            CHECK (classification IN ('productive','non-productive','neutral','unclassified')),
          category          TEXT,
          was_prompted      INTEGER DEFAULT 0,
          rule_matched_id   TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (rule_matched_id) REFERENCES rules(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_activities_session   ON activities(session_id);
        CREATE INDEX IF NOT EXISTS idx_activities_domain    ON activities(domain);
        CREATE INDEX IF NOT EXISTS idx_activities_started   ON activities(started_at);
      `);

      // ── Rules ──
      db.exec(`
        CREATE TABLE IF NOT EXISTS rules (
          id              TEXT PRIMARY KEY,
          type            TEXT NOT NULL
                          CHECK (type IN ('domain','app','title_keyword','regex','time_based')),
          pattern         TEXT NOT NULL,
          classification  TEXT NOT NULL
                          CHECK (classification IN ('productive','non-productive','neutral','unclassified')),
          category        TEXT,
          priority        INTEGER DEFAULT 0,
          is_active       INTEGER DEFAULT 1,
          created_at      TEXT NOT NULL,
          times_matched   INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_rules_type_active ON rules(type, is_active);
      `);

      // ── Categories ──
      db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
          id    TEXT PRIMARY KEY,
          name  TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL,
          icon  TEXT
        );
      `);

      // ── Exports ──
      db.exec(`
        CREATE TABLE IF NOT EXISTS exports (
          id          TEXT PRIMARY KEY,
          session_id  TEXT,
          file_path   TEXT NOT NULL,
          exported_at TEXT NOT NULL,
          format      TEXT DEFAULT 'xlsx',
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
        );
      `);

      // ── Seed default categories ──
      const insertCat = db.prepare(`
        INSERT OR IGNORE INTO categories (id, name, color, icon) VALUES (?, ?, ?, ?)
      `);

      const defaultCategories: [string, string, string, string | null][] = [
        ['cat_coding',        'Coding',        '#10B981', null],
        ['cat_communication', 'Communication', '#3B82F6', null],
        ['cat_design',        'Design',        '#8B5CF6', null],
        ['cat_research',      'Research',      '#F59E0B', null],
        ['cat_entertainment', 'Entertainment', '#EF4444', null],
        ['cat_social_media',  'Social Media',  '#EC4899', null],
        ['cat_browsing',      'Browsing',      '#6B7280', null],
        ['cat_system',        'System',        '#94A3B8', null],
      ];

      for (const [id, name, color, icon] of defaultCategories) {
        insertCat.run(id, name, color, icon);
      }
    },
  },
  {
    version: 2,
    description: 'Create settings table with defaults',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      const ins = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
      const defaults: [string, string][] = [
        ['autoLaunch', 'false'],
        ['minimizeToTray', 'true'],
        ['autoTrack', 'true'],
        ['pollInterval', '1000'],
        ['idleThreshold', '300'],
        ['excludedApps', '[]'],
        ['promptStyle', 'modal'],
        ['autoCollapseTimeout', '10'],
        ['soundOnPrompt', 'false'],
        ['defaultExportFolder', ''],
        ['autoExport', 'disabled'],
        ['includeNeutral', 'true'],
        ['includeIdle', 'false'],
      ];
      for (const [k, v] of defaults) {
        ins.run(k, v);
      }
    },
  },
];

// ─── Migration Runner ────────────────────────────────────────────────

/**
 * Ensures the meta table exists, then runs any pending migrations
 * inside a transaction. Safe to call on every app start.
 */
export function runMigrations(): void {
  const db = getDb();

  // Create meta table for tracking schema version
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const getVersion = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`);
  const setVersion = db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)`);

  const row = getVersion.get() as { value: string } | undefined;
  let currentVersion = row ? parseInt(row.value, 10) : 0;

  const pending = migrations.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    console.log(`[DB] Schema is up-to-date (version ${currentVersion})`);
    return;
  }

  console.log(`[DB] Running ${pending.length} migration(s) from v${currentVersion}...`);

  for (const migration of pending) {
    const runOne = db.transaction(() => {
      console.log(`[DB]   → v${migration.version}: ${migration.description}`);
      migration.up(db);
      setVersion.run(String(migration.version));
    });
    runOne();
    currentVersion = migration.version;
  }

  console.log(`[DB] Migrations complete — now at version ${currentVersion}`);
}

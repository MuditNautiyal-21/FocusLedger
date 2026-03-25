import { randomUUID } from 'crypto';
import { getDb } from './connection';
import type {
  Session,
  Activity,
  ActivityRow,
  Rule,
  RuleRow,
  Category,
  ExportRecord,
  Classification,
  CreateSessionParams,
  LogActivityParams,
  UpdateActivityParams,
  CreateRuleParams,
  UpdateRuleParams,
  SessionStats,
  TopApp,
  HourlyProductivity,
} from '../../shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────

function activityFromRow(row: ActivityRow): Activity {
  return {
    ...row,
    was_prompted: row.was_prompted === 1,
  };
}

function ruleFromRow(row: RuleRow): Rule {
  return {
    ...row,
    is_active: row.is_active === 1,
  };
}

// =====================================================================
//  SESSIONS
// =====================================================================

export function createSession(params: CreateSessionParams): Session {
  const db = getDb();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO sessions (id, date, started_at)
    VALUES (?, ?, ?)
  `).run(id, params.date, params.started_at);

  return db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as Session;
}

export function endSession(
  id: string,
  ended_at: string,
  stats: SessionStats,
): Session {
  const db = getDb();

  db.prepare(`
    UPDATE sessions
    SET ended_at            = ?,
        total_seconds       = ?,
        productive_seconds  = ?,
        wasted_seconds      = ?,
        neutral_seconds     = ?,
        productivity_score  = ?
    WHERE id = ?
  `).run(
    ended_at,
    stats.total_seconds,
    stats.productive_seconds,
    stats.wasted_seconds,
    stats.neutral_seconds,
    stats.productivity_score,
    id,
  );

  return db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as Session;
}

export function getSessionByDate(date: string): Session | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM sessions WHERE date = ? ORDER BY started_at DESC LIMIT 1`).get(date);
  return (row as Session) ?? null;
}

export function getSessionStats(sessionId: string): SessionStats {
  const db = getDb();

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(duration_seconds), 0)                                                      AS total_seconds,
      COALESCE(SUM(CASE WHEN classification = 'productive'     THEN duration_seconds ELSE 0 END), 0) AS productive_seconds,
      COALESCE(SUM(CASE WHEN classification = 'non-productive' THEN duration_seconds ELSE 0 END), 0) AS wasted_seconds,
      COALESCE(SUM(CASE WHEN classification = 'neutral'        THEN duration_seconds ELSE 0 END), 0) AS neutral_seconds
    FROM activities
    WHERE session_id = ?
  `).get(sessionId) as {
    total_seconds: number;
    productive_seconds: number;
    wasted_seconds: number;
    neutral_seconds: number;
  };

  const total = row.total_seconds || 1; // avoid division by zero
  const productivity_score = Math.round((row.productive_seconds / total) * 100 * 100) / 100;

  return { ...row, productivity_score };
}

// =====================================================================
//  ACTIVITIES
// =====================================================================

export function logActivity(params: LogActivityParams): Activity {
  const db = getDb();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO activities
      (id, session_id, app_name, window_title, url, domain,
       started_at, classification, category, was_prompted, rule_matched_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.session_id,
    params.app_name,
    params.window_title ?? null,
    params.url ?? null,
    params.domain ?? null,
    params.started_at,
    params.classification ?? 'unclassified',
    params.category ?? null,
    params.was_prompted ? 1 : 0,
    params.rule_matched_id ?? null,
  );

  const row = db.prepare(`SELECT * FROM activities WHERE id = ?`).get(id) as ActivityRow;
  return activityFromRow(row);
}

export function updateActivity(id: string, params: UpdateActivityParams): Activity {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (params.ended_at !== undefined) {
    sets.push('ended_at = ?');
    values.push(params.ended_at);
  }
  if (params.duration_seconds !== undefined) {
    sets.push('duration_seconds = ?');
    values.push(params.duration_seconds);
  }
  if (params.classification !== undefined) {
    sets.push('classification = ?');
    values.push(params.classification);
  }
  if (params.category !== undefined) {
    sets.push('category = ?');
    values.push(params.category);
  }
  if (params.was_prompted !== undefined) {
    sets.push('was_prompted = ?');
    values.push(params.was_prompted ? 1 : 0);
  }
  if (params.rule_matched_id !== undefined) {
    sets.push('rule_matched_id = ?');
    values.push(params.rule_matched_id);
  }

  if (sets.length > 0) {
    values.push(id);
    db.prepare(`UPDATE activities SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  const row = db.prepare(`SELECT * FROM activities WHERE id = ?`).get(id) as ActivityRow;
  return activityFromRow(row);
}

export function endActivity(id: string, ended_at: string, duration_seconds: number): Activity {
  return updateActivity(id, { ended_at, duration_seconds });
}

export function getActivitiesBySession(sessionId: string): Activity[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM activities WHERE session_id = ? ORDER BY started_at ASC
  `).all(sessionId) as ActivityRow[];
  return rows.map(activityFromRow);
}

export function getActivitiesByDateRange(startDate: string, endDate: string): Activity[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM activities
    WHERE started_at >= ? AND started_at <= ?
    ORDER BY started_at ASC
  `).all(startDate, endDate) as ActivityRow[];
  return rows.map(activityFromRow);
}

export interface FilteredActivitiesParams {
  date: string;                       // YYYY-MM-DD
  classification?: Classification;    // null = all
  search?: string;                    // substring match on app_name or window_title
  limit?: number;
  offset?: number;
}

export function getFilteredActivities(params: FilteredActivitiesParams): Activity[] {
  const db = getDb();
  const conditions = [`date(started_at) = ?`];
  const values: unknown[] = [params.date];

  if (params.classification) {
    conditions.push(`classification = ?`);
    values.push(params.classification);
  }

  if (params.search) {
    conditions.push(`(app_name LIKE ? OR window_title LIKE ?)`);
    const like = `%${params.search}%`;
    values.push(like, like);
  }

  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;
  values.push(limit, offset);

  const rows = db.prepare(`
    SELECT * FROM activities
    WHERE ${conditions.join(' AND ')}
    ORDER BY started_at ASC
    LIMIT ? OFFSET ?
  `).all(...values) as ActivityRow[];

  return rows.map(activityFromRow);
}

export function getTopApps(sessionId: string, limit: number = 10): TopApp[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      app_name,
      SUM(duration_seconds) AS total_duration,
      classification
    FROM activities
    WHERE session_id = ?
    GROUP BY app_name
    ORDER BY total_duration DESC
    LIMIT ?
  `).all(sessionId, limit) as TopApp[];
}

export function getProductivityByHour(sessionId: string): HourlyProductivity[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      CAST(strftime('%H', started_at) AS INTEGER) AS hour,
      COALESCE(SUM(CASE WHEN classification = 'productive'     THEN duration_seconds ELSE 0 END), 0) AS productive_seconds,
      COALESCE(SUM(CASE WHEN classification = 'non-productive' THEN duration_seconds ELSE 0 END), 0) AS wasted_seconds,
      COALESCE(SUM(CASE WHEN classification = 'neutral'        THEN duration_seconds ELSE 0 END), 0) AS neutral_seconds
    FROM activities
    WHERE session_id = ?
    GROUP BY hour
    ORDER BY hour ASC
  `).all(sessionId) as HourlyProductivity[];
}

// =====================================================================
//  RULES
// =====================================================================

export function createRule(params: CreateRuleParams): Rule {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO rules (id, type, pattern, classification, category, priority, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.type,
    params.pattern,
    params.classification,
    params.category ?? null,
    params.priority ?? 0,
    now,
  );

  const row = db.prepare(`SELECT * FROM rules WHERE id = ?`).get(id) as RuleRow;
  return ruleFromRow(row);
}

export function updateRule(id: string, params: UpdateRuleParams): Rule {
  const db = getDb();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (params.type !== undefined) {
    sets.push('type = ?');
    values.push(params.type);
  }
  if (params.pattern !== undefined) {
    sets.push('pattern = ?');
    values.push(params.pattern);
  }
  if (params.classification !== undefined) {
    sets.push('classification = ?');
    values.push(params.classification);
  }
  if (params.category !== undefined) {
    sets.push('category = ?');
    values.push(params.category);
  }
  if (params.priority !== undefined) {
    sets.push('priority = ?');
    values.push(params.priority);
  }
  if (params.is_active !== undefined) {
    sets.push('is_active = ?');
    values.push(params.is_active ? 1 : 0);
  }

  if (sets.length > 0) {
    values.push(id);
    db.prepare(`UPDATE rules SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  const row = db.prepare(`SELECT * FROM rules WHERE id = ?`).get(id) as RuleRow;
  return ruleFromRow(row);
}

export function deleteRule(id: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM rules WHERE id = ?`).run(id);
}

export function getAllRules(): Rule[] {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM rules ORDER BY priority DESC, created_at ASC`).all() as RuleRow[];
  return rows.map(ruleFromRow);
}

/**
 * Find the highest-priority active rule matching the given activity context.
 * Checks rules in priority order:  domain → app → title_keyword → regex
 */
export function findMatchingRule(
  appName: string,
  domain: string | null,
  windowTitle: string | null,
): Rule | null {
  const db = getDb();

  const activeRules = db.prepare(`
    SELECT * FROM rules WHERE is_active = 1 ORDER BY priority DESC
  `).all() as RuleRow[];

  for (const row of activeRules) {
    let matched = false;

    switch (row.type) {
      case 'domain':
        if (domain && domain.toLowerCase().includes(row.pattern.toLowerCase())) {
          matched = true;
        }
        break;

      case 'app':
        if (appName.toLowerCase().includes(row.pattern.toLowerCase())) {
          matched = true;
        }
        break;

      case 'title_keyword':
        if (windowTitle && windowTitle.toLowerCase().includes(row.pattern.toLowerCase())) {
          matched = true;
        }
        break;

      case 'regex':
        try {
          const regex = new RegExp(row.pattern, 'i');
          const target = windowTitle ?? appName;
          if (regex.test(target)) {
            matched = true;
          }
        } catch {
          // Invalid regex — skip
        }
        break;

      case 'time_based':
        // Time-based rules need external context; skip in simple matching
        break;
    }

    if (matched) {
      // Increment times_matched counter
      db.prepare(`UPDATE rules SET times_matched = times_matched + 1 WHERE id = ?`).run(row.id);
      return ruleFromRow(row);
    }
  }

  return null;
}

// =====================================================================
//  CATEGORIES
// =====================================================================

export function getAllCategories(): Category[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM categories ORDER BY name ASC`).all() as Category[];
}

export function getCategoryById(id: string): Category | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM categories WHERE id = ?`).get(id);
  return (row as Category) ?? null;
}

// =====================================================================
//  EXPORTS
// =====================================================================

export function logExport(sessionId: string | null, filePath: string): ExportRecord {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO exports (id, session_id, file_path, exported_at, format)
    VALUES (?, ?, ?, ?, 'xlsx')
  `).run(id, sessionId, filePath, now);

  return db.prepare(`SELECT * FROM exports WHERE id = ?`).get(id) as ExportRecord;
}

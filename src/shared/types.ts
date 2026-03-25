// ─── Shared types between main and renderer processes ───

// ─── Union Types ───

export type Classification = 'productive' | 'non-productive' | 'neutral' | 'unclassified';

export type RuleType = 'domain' | 'app' | 'title_keyword' | 'regex' | 'time_based';

export type ExportFormat = 'xlsx';

// ─── Entity Interfaces ───

export interface Session {
  id: string;
  date: string;
  started_at: string;
  ended_at: string | null;
  total_seconds: number;
  productive_seconds: number;
  wasted_seconds: number;
  neutral_seconds: number;
  productivity_score: number;
}

export interface Activity {
  id: string;
  session_id: string;
  app_name: string;
  window_title: string | null;
  url: string | null;
  domain: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  classification: Classification;
  category: string | null;
  was_prompted: boolean;
  rule_matched_id: string | null;
}

export interface Rule {
  id: string;
  type: RuleType;
  pattern: string;
  classification: Classification;
  category: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  times_matched: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

export interface ExportRecord {
  id: string;
  session_id: string | null;
  exported_at: string;
  file_path: string;
  format: ExportFormat;
}

// ─── Row types (as stored in SQLite — booleans are 0/1 integers) ───

export interface ActivityRow {
  id: string;
  session_id: string;
  app_name: string;
  window_title: string | null;
  url: string | null;
  domain: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  classification: Classification;
  category: string | null;
  was_prompted: number;       // 0 | 1
  rule_matched_id: string | null;
}

export interface RuleRow {
  id: string;
  type: RuleType;
  pattern: string;
  classification: Classification;
  category: string | null;
  priority: number;
  is_active: number;          // 0 | 1
  created_at: string;
  times_matched: number;
}

// ─── Query Parameter Types ───

export interface CreateSessionParams {
  date: string;
  started_at: string;
}

export interface LogActivityParams {
  session_id: string;
  app_name: string;
  window_title?: string | null;
  url?: string | null;
  domain?: string | null;
  started_at: string;
  classification?: Classification;
  category?: string | null;
  was_prompted?: boolean;
  rule_matched_id?: string | null;
}

export interface UpdateActivityParams {
  ended_at?: string | null;
  duration_seconds?: number;
  classification?: Classification;
  category?: string | null;
  was_prompted?: boolean;
  rule_matched_id?: string | null;
}

export interface CreateRuleParams {
  type: RuleType;
  pattern: string;
  classification: Classification;
  category?: string | null;
  priority?: number;
}

export interface UpdateRuleParams {
  type?: RuleType;
  pattern?: string;
  classification?: Classification;
  category?: string | null;
  priority?: number;
  is_active?: boolean;
}

export interface SessionStats {
  total_seconds: number;
  productive_seconds: number;
  wasted_seconds: number;
  neutral_seconds: number;
  productivity_score: number;
}

export interface TopApp {
  app_name: string;
  total_duration: number;
  classification: Classification;
}

export interface HourlyProductivity {
  hour: number;
  productive_seconds: number;
  wasted_seconds: number;
  neutral_seconds: number;
}

// ─── IPC Channel Constants ───

export const IpcChannel = {
  // Tracking
  TRACKING_START: 'tracking:start',
  TRACKING_STOP: 'tracking:stop',
  TRACKING_STATUS: 'tracking:status',

  // Sessions
  SESSION_CURRENT: 'session:current',
  SESSION_STATS: 'session:stats',

  // Activities
  ACTIVITIES_LIST: 'activities:list',
  ACTIVITIES_BY_DATE_RANGE: 'activities:by-date-range',
  ACTIVITIES_TOP_APPS: 'activities:top-apps',
  ACTIVITIES_HOURLY: 'activities:hourly',

  // Rules
  RULES_LIST: 'rules:list',
  RULES_CREATE: 'rules:create',
  RULES_UPDATE: 'rules:update',
  RULES_DELETE: 'rules:delete',
  RULES_REORDER: 'rules:reorder',
  RULES_SUGGEST: 'rules:suggest',
  RULES_TEST: 'rules:test',

  // Classification
  CLASSIFY_ACTIVITY: 'classify-activity',

  // Categories
  CATEGORIES_LIST: 'categories:list',

  // Filtered activities (for timeline)
  ACTIVITIES_FILTERED: 'activities:filtered',
  ACTIVITIES_RECLASSIFY: 'activities:reclassify',

  // Export
  EXPORT_EXCEL: 'export:excel',
  EXPORT_REPORT: 'export:report',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_PICK_FOLDER: 'settings:pick-folder',
  SETTINGS_CLEAR_HISTORY: 'settings:clear-history',
  SETTINGS_EXPORT_JSON: 'settings:export-json',
  SETTINGS_RESET_RULES: 'settings:reset-rules',

  // Extension setup
  EXT_SETUP_STATUS: 'ext:setup-status',
  EXT_SETUP_RUN: 'ext:setup-run',
  EXT_OPEN_BROWSER: 'ext:open-browser',
  EXT_OPEN_FOLDER: 'ext:open-folder',

  // File operations
  OPEN_FILE: 'open-file',
  OPEN_FOLDER: 'open-folder',

  // Database
  DB_STATUS: 'db:status',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];

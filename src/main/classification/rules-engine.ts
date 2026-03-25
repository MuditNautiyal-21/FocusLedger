import { getDb } from '../database/connection';
import {
  createRule as dbCreateRule,
  updateRule as dbUpdateRule,
  deleteRule as dbDeleteRule,
} from '../database/queries';
import type {
  Rule,
  RuleRow,
  RuleType,
  Classification,
  CreateRuleParams,
  UpdateRuleParams,
} from '../../shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────

function ruleFromRow(row: RuleRow): Rule {
  return { ...row, is_active: row.is_active === 1 };
}

/** Parse time-based pattern JSON: { match, after, before } */
interface TimeBasedPattern {
  match: string;
  after: string;   // "HH:MM"
  before: string;  // "HH:MM"
}

function parseTimeBased(pattern: string): TimeBasedPattern | null {
  try {
    const parsed = JSON.parse(pattern);
    if (parsed && typeof parsed.match === 'string' && parsed.after && parsed.before) {
      return parsed as TimeBasedPattern;
    }
  } catch { /* ignore */ }
  return null;
}

/** Check if current time falls within an inverted range like after:18:00, before:09:00 */
function isInTimeRange(after: string, before: string): boolean {
  const [aH, aM] = after.split(':').map(Number);
  const [bH, bM] = before.split(':').map(Number);
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const afterMins = aH * 60 + aM;
  const beforeMins = bH * 60 + bM;

  if (afterMins <= beforeMins) {
    // Simple range: e.g. 09:00 - 17:00
    return nowMins >= afterMins && nowMins < beforeMins;
  } else {
    // Inverted range: e.g. 18:00 - 09:00 (evening to morning)
    return nowMins >= afterMins || nowMins < beforeMins;
  }
}

// ─── Suggested rule type ─────────────────────────────────────────────

export interface SuggestedRule {
  type: RuleType;
  pattern: string;
  occurrences: number;
  totalDuration: number;
  suggestedClassification: Classification | null;
}

// ─── TestRuleInput ───────────────────────────────────────────────────

export interface TestRuleInput {
  type: RuleType;
  pattern: string;
  appName: string;
  domain: string | null;
  windowTitle: string;
  url: string | null;
}

// ─── RulesEngine ─────────────────────────────────────────────────────

export class RulesEngine {
  /** In-memory cache of active rules sorted by priority DESC */
  private rules: Rule[] = [];

  constructor() {
    this.reload();
  }

  // ── Matching ──────────────────────────────────────────────────────

  /**
   * Find the first matching rule for the given activity context.
   * Rules are checked in priority order (highest first).
   * Returns null if nothing matches.
   */
  match(
    appName: string,
    domain: string | null,
    windowTitle: string,
    url: string | null,
  ): Rule | null {
    for (const rule of this.rules) {
      if (this.doesRuleMatch(rule, appName, domain, windowTitle, url)) {
        this.incrementTimesMatched(rule.id);
        return rule;
      }
    }
    return null;
  }

  /**
   * Test whether a rule specification would match a given input
   * (for the rule editor preview — no DB side-effects).
   */
  testRule(input: TestRuleInput): boolean {
    const fakeRule: Rule = {
      id: '_test',
      type: input.type,
      pattern: input.pattern,
      classification: 'neutral',
      category: null,
      priority: 0,
      is_active: true,
      created_at: '',
      times_matched: 0,
    };
    return this.doesRuleMatch(fakeRule, input.appName, input.domain, input.windowTitle, input.url);
  }

  // ── CRUD (modify DB + reload cache) ───────────────────────────────

  addRule(params: CreateRuleParams): Rule {
    const rule = dbCreateRule(params);
    this.reload();
    return rule;
  }

  modifyRule(id: string, params: UpdateRuleParams): Rule {
    const rule = dbUpdateRule(id, params);
    this.reload();
    return rule;
  }

  removeRule(id: string): void {
    dbDeleteRule(id);
    this.reload();
  }

  /** Bulk update priorities. Accepts [{id, priority}, ...] */
  reorderRules(pairs: { id: string; priority: number }[]): void {
    const db = getDb();
    const stmt = db.prepare(`UPDATE rules SET priority = ? WHERE id = ?`);
    const reorder = db.transaction(() => {
      for (const { id, priority } of pairs) {
        stmt.run(priority, id);
      }
    });
    reorder();
    this.reload();
  }

  // ── Cache management ──────────────────────────────────────────────

  /** Reload the in-memory rule cache from DB */
  reload(): void {
    const db = getDb();
    const rows = db.prepare(
      `SELECT * FROM rules WHERE is_active = 1 ORDER BY priority DESC, created_at ASC`,
    ).all() as RuleRow[];
    this.rules = rows.map(ruleFromRow);
    console.log(`[Rules] Loaded ${this.rules.length} active rules into cache`);
  }

  /** Return all rules (including inactive) for UI display */
  getAll(): Rule[] {
    const db = getDb();
    const rows = db.prepare(
      `SELECT * FROM rules ORDER BY priority DESC, created_at ASC`,
    ).all() as RuleRow[];
    return rows.map(ruleFromRow);
  }

  // ── Rule suggestions ──────────────────────────────────────────────

  /**
   * Analyse recent unclassified activities and suggest rules
   * based on frequency patterns.
   */
  suggestRules(): SuggestedRule[] {
    const db = getDb();

    // Find frequently-seen unclassified domains
    const domainRows = db.prepare(`
      SELECT
        domain,
        COUNT(*)              AS occurrences,
        SUM(duration_seconds) AS total_duration
      FROM activities
      WHERE classification = 'unclassified'
        AND domain IS NOT NULL
        AND domain != ''
      GROUP BY domain
      HAVING occurrences >= 2
      ORDER BY occurrences DESC
      LIMIT 20
    `).all() as { domain: string; occurrences: number; total_duration: number }[];

    // Find frequently-seen unclassified apps (without domain)
    const appRows = db.prepare(`
      SELECT
        app_name,
        COUNT(*)              AS occurrences,
        SUM(duration_seconds) AS total_duration
      FROM activities
      WHERE classification = 'unclassified'
        AND (domain IS NULL OR domain = '')
      GROUP BY app_name
      HAVING occurrences >= 2
      ORDER BY occurrences DESC
      LIMIT 20
    `).all() as { app_name: string; occurrences: number; total_duration: number }[];

    const suggestions: SuggestedRule[] = [];

    for (const row of domainRows) {
      // Skip if a rule already exists for this domain
      if (this.rules.some((r) => r.type === 'domain' && r.pattern === row.domain)) continue;
      suggestions.push({
        type: 'domain',
        pattern: row.domain,
        occurrences: row.occurrences,
        totalDuration: row.total_duration,
        suggestedClassification: null,
      });
    }

    for (const row of appRows) {
      if (this.rules.some((r) => r.type === 'app' && r.pattern === row.app_name)) continue;
      suggestions.push({
        type: 'app',
        pattern: row.app_name,
        occurrences: row.occurrences,
        totalDuration: row.total_duration,
        suggestedClassification: null,
      });
    }

    return suggestions.sort((a, b) => b.occurrences - a.occurrences);
  }

  // ── Matching internals ────────────────────────────────────────────

  private doesRuleMatch(
    rule: Rule,
    appName: string,
    domain: string | null,
    windowTitle: string,
    url: string | null,
  ): boolean {
    switch (rule.type) {
      case 'domain':
        return this.matchDomain(rule.pattern, domain);

      case 'app':
        return this.matchApp(rule.pattern, appName);

      case 'title_keyword':
        return this.matchTitleKeyword(rule.pattern, windowTitle);

      case 'regex':
        return this.matchRegex(rule.pattern, url, windowTitle);

      case 'time_based':
        return this.matchTimeBased(rule.pattern, appName, domain);

      default:
        return false;
    }
  }

  /** domain: "youtube.com" matches "youtube.com" and "www.youtube.com" */
  private matchDomain(pattern: string, domain: string | null): boolean {
    if (!domain) return false;
    const d = domain.toLowerCase();
    const p = pattern.toLowerCase();
    return d === p || d.endsWith('.' + p);
  }

  /** app: case-insensitive contains */
  private matchApp(pattern: string, appName: string): boolean {
    return appName.toLowerCase().includes(pattern.toLowerCase());
  }

  /** title_keyword: case-insensitive substring */
  private matchTitleKeyword(pattern: string, windowTitle: string): boolean {
    return windowTitle.toLowerCase().includes(pattern.toLowerCase());
  }

  /** regex: test against URL first, then window title */
  private matchRegex(pattern: string, url: string | null, windowTitle: string): boolean {
    try {
      const re = new RegExp(pattern, 'i');
      if (url && re.test(url)) return true;
      return re.test(windowTitle);
    } catch {
      return false; // invalid regex
    }
  }

  /** time_based: JSON pattern with match + time range */
  private matchTimeBased(pattern: string, appName: string, domain: string | null): boolean {
    const parsed = parseTimeBased(pattern);
    if (!parsed) return false;

    // First check if the match string hits the domain or app
    const matchTarget = parsed.match.toLowerCase();
    const domainHit = domain ? (domain.toLowerCase() === matchTarget || domain.toLowerCase().endsWith('.' + matchTarget)) : false;
    const appHit = appName.toLowerCase().includes(matchTarget);

    if (!domainHit && !appHit) return false;

    // Then check time range
    return isInTimeRange(parsed.after, parsed.before);
  }

  /** Increment the times_matched counter in DB (fire and forget) */
  private incrementTimesMatched(ruleId: string): void {
    try {
      const db = getDb();
      db.prepare(`UPDATE rules SET times_matched = times_matched + 1 WHERE id = ?`).run(ruleId);
    } catch {
      // non-critical
    }
  }
}

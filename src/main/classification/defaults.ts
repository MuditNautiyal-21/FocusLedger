import { randomUUID } from 'crypto';
import { getDb } from '../database/connection';
import type { Classification } from '../../shared/types';

// ─── Default Rule Definitions ────────────────────────────────────────

interface DefaultRule {
  type: 'domain' | 'app';
  pattern: string;
  classification: Classification;
  category: string | null;
  priority: number;
}

const NON_PRODUCTIVE_DOMAINS: string[] = [
  'youtube.com', 'netflix.com', 'reddit.com', 'twitter.com', 'x.com',
  'instagram.com', 'tiktok.com', 'twitch.tv', 'facebook.com', '9gag.com',
  'buzzfeed.com', 'hulu.com', 'disneyplus.com', 'primevideo.com',
  'crunchyroll.com',
];

const PRODUCTIVE_DOMAINS: string[] = [
  'github.com', 'stackoverflow.com', 'docs.google.com', 'notion.so',
  'linear.app', 'gitlab.com', 'bitbucket.org', 'jira.atlassian.net',
  'confluence.atlassian.net', 'figma.com', 'vercel.com',
  'aws.amazon.com', 'console.cloud.google.com',
];

const PRODUCTIVE_APPS: string[] = [
  'Code', 'Visual Studio Code', 'Visual Studio',
  'IntelliJ IDEA', 'WebStorm', 'PyCharm', 'Xcode',
  'Terminal', 'iTerm2', 'Windows Terminal', 'PowerShell',
  'Postman', 'Docker Desktop', 'pgAdmin', 'DataGrip',
];

const NEUTRAL_DOMAINS: string[] = [
  'mail.google.com', 'outlook.com', 'outlook.live.com',
];

const NEUTRAL_APPS: string[] = [
  'Slack', 'Discord', 'Microsoft Teams', 'Teams',
  'Spotify', 'Apple Music',
  'Finder', 'Explorer', 'File Explorer',
];

// ─── Build full list ─────────────────────────────────────────────────

function buildDefaultRules(): DefaultRule[] {
  const rules: DefaultRule[] = [];

  for (const domain of NON_PRODUCTIVE_DOMAINS) {
    rules.push({
      type: 'domain',
      pattern: domain,
      classification: 'non-productive',
      category: 'Entertainment',
      priority: 10,
    });
  }

  for (const domain of PRODUCTIVE_DOMAINS) {
    rules.push({
      type: 'domain',
      pattern: domain,
      classification: 'productive',
      category: 'Coding',
      priority: 10,
    });
  }

  for (const app of PRODUCTIVE_APPS) {
    rules.push({
      type: 'app',
      pattern: app,
      classification: 'productive',
      category: 'Coding',
      priority: 5,
    });
  }

  for (const domain of NEUTRAL_DOMAINS) {
    rules.push({
      type: 'domain',
      pattern: domain,
      classification: 'neutral',
      category: 'Communication',
      priority: 10,
    });
  }

  for (const app of NEUTRAL_APPS) {
    rules.push({
      type: 'app',
      pattern: app,
      classification: 'neutral',
      category: 'Communication',
      priority: 5,
    });
  }

  return rules;
}

// ─── Seed function ───────────────────────────────────────────────────

const META_KEY = 'default_rules_seeded';

/**
 * Seeds default classification rules into the database.
 * Only runs once — checks a flag in the meta table.
 */
export function seedDefaultRules(): void {
  const db = getDb();

  const row = db.prepare(`SELECT value FROM meta WHERE key = ?`).get(META_KEY) as
    | { value: string }
    | undefined;

  if (row?.value === '1') {
    console.log('[Defaults] Default rules already seeded');
    return;
  }

  const rules = buildDefaultRules();
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT OR IGNORE INTO rules (id, type, pattern, classification, category, priority, is_active, created_at, times_matched)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0)
  `);

  const seedAll = db.transaction(() => {
    for (const rule of rules) {
      insert.run(
        randomUUID(),
        rule.type,
        rule.pattern,
        rule.classification,
        rule.category,
        rule.priority,
        now,
      );
    }
    db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, '1')`).run(META_KEY);
  });

  seedAll();
  console.log(`[Defaults] Seeded ${rules.length} default classification rules`);
}

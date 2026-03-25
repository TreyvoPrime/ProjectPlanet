import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

export type GuildSettings = {
  guildId: string;
  defaultModel: string;
  fastMode: boolean;
  maxTokens: number;
  temperature: number;
  languageLevel: 'beginner' | 'intermediate' | 'advanced';
  gradingRubricJson: string;
  createdAt: string;
  updatedAt: string;
};

export type GuildSettingsInput = {
  defaultModel?: string;
  fastMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  languageLevel?: 'beginner' | 'intermediate' | 'advanced';
  gradingRubricJson?: string;
};

export type UsageLogInput = {
  guildId: string | null;
  userId: string | null;
  command: string;
  tokensIn: number;
  tokensOut: number;
  costEstimate: number;
};

export type UserRecord = {
  discordId: string;
  username: string;
};

export type GuildRecord = {
  guildId: string;
  name: string;
};

export type UsageStats = {
  callsThisMonth: number;
  tokensThisMonth: number;
  estimatedCostThisMonth: number;
};

const DEFAULT_GRADING_RUBRIC = JSON.stringify(
  {
    clarity: 'Explains ideas clearly and stays on topic.',
    accuracy: 'Uses correct facts, terminology, and reasoning.',
    completeness: 'Addresses the full prompt with enough supporting detail.',
    organization: 'Structures ideas logically with smooth progression.'
  },
  null,
  2
);

export const DEFAULT_GUILD_SETTINGS = {
  defaultModel: 'deepseek-chat',
  fastMode: true,
  maxTokens: 700,
  temperature: 0.7,
  languageLevel: 'intermediate' as const,
  gradingRubricJson: DEFAULT_GRADING_RUBRIC
};

export class AppDatabase {
  private readonly db: DatabaseSync;

  constructor(sqlitePath: string) {
    const directory = path.dirname(sqlitePath);
    fs.mkdirSync(directory, { recursive: true });
    this.db = new DatabaseSync(sqlitePath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
  }

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS guilds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS guild_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL UNIQUE,
        default_model TEXT NOT NULL DEFAULT 'deepseek-chat',
        fast_mode INTEGER NOT NULL DEFAULT 1,
        max_tokens INTEGER NOT NULL DEFAULT 700,
        temperature REAL NOT NULL DEFAULT 0.7,
        language_level TEXT NOT NULL DEFAULT 'intermediate',
        grading_rubric_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        user_id TEXT,
        command TEXT NOT NULL,
        tokens_in INTEGER NOT NULL DEFAULT 0,
        tokens_out INTEGER NOT NULL DEFAULT 0,
        cost_estimate REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guild_id) REFERENCES guilds(guild_id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS web_sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_usage_logs_guild_month ON usage_logs (guild_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_expire_at ON web_sessions (expire_at);
    `);
  }

  close(): void {
    this.db.close();
  }

  upsertUser(user: UserRecord): void {
    this.db
      .prepare(
        `
          INSERT INTO users (discord_id, username)
          VALUES (?, ?)
          ON CONFLICT(discord_id) DO UPDATE SET username = excluded.username
        `
      )
      .run(user.discordId, user.username);
  }

  upsertGuild(guild: GuildRecord): void {
    this.db
      .prepare(
        `
          INSERT INTO guilds (guild_id, name)
          VALUES (?, ?)
          ON CONFLICT(guild_id) DO UPDATE SET name = excluded.name
        `
      )
      .run(guild.guildId, guild.name);
  }

  ensureGuildSettings(guildId: string, guildName = 'Unknown Server'): GuildSettings {
    this.upsertGuild({ guildId, name: guildName });
    const existing = this.getGuildSettings(guildId);
    if (existing) {
      return existing;
    }

    this.db
      .prepare(
        `
          INSERT INTO guild_settings (
            guild_id,
            default_model,
            fast_mode,
            max_tokens,
            temperature,
            language_level,
            grading_rubric_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        guildId,
        DEFAULT_GUILD_SETTINGS.defaultModel,
        DEFAULT_GUILD_SETTINGS.fastMode ? 1 : 0,
        DEFAULT_GUILD_SETTINGS.maxTokens,
        DEFAULT_GUILD_SETTINGS.temperature,
        DEFAULT_GUILD_SETTINGS.languageLevel,
        DEFAULT_GUILD_SETTINGS.gradingRubricJson
      );

    return this.getGuildSettings(guildId)!;
  }

  getGuildSettings(guildId: string): GuildSettings | null {
    const row = this.db
      .prepare(
        `
          SELECT
            guild_id as guildId,
            default_model as defaultModel,
            fast_mode as fastMode,
            max_tokens as maxTokens,
            temperature,
            language_level as languageLevel,
            grading_rubric_json as gradingRubricJson,
            created_at as createdAt,
            updated_at as updatedAt
          FROM guild_settings
          WHERE guild_id = ?
        `
      )
      .get(guildId) as GuildSettings | undefined;

    if (!row) {
      return null;
    }

    return {
      ...row,
      fastMode: Boolean(row.fastMode)
    };
  }

  updateGuildSettings(guildId: string, updates: GuildSettingsInput): GuildSettings {
    const current = this.ensureGuildSettings(guildId);
    const merged = {
      ...current,
      ...updates,
      fastMode: updates.fastMode ?? current.fastMode
    };

    this.db
      .prepare(
        `
          UPDATE guild_settings
          SET
            default_model = ?,
            fast_mode = ?,
            max_tokens = ?,
            temperature = ?,
            language_level = ?,
            grading_rubric_json = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE guild_id = ?
        `
      )
      .run(
        merged.defaultModel,
        merged.fastMode ? 1 : 0,
        merged.maxTokens,
        merged.temperature,
        merged.languageLevel,
        merged.gradingRubricJson,
        guildId
      );

    return this.getGuildSettings(guildId)!;
  }

  logUsage(entry: UsageLogInput): void {
    this.db
      .prepare(
        `
          INSERT INTO usage_logs (guild_id, user_id, command, tokens_in, tokens_out, cost_estimate)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(entry.guildId, entry.userId, entry.command, entry.tokensIn, entry.tokensOut, entry.costEstimate);
  }

  getUsageStatsForGuild(guildId: string): UsageStats {
    const row = this.db
      .prepare(
        `
          SELECT
            COUNT(*) as callsThisMonth,
            COALESCE(SUM(tokens_in + tokens_out), 0) as tokensThisMonth,
            COALESCE(SUM(cost_estimate), 0) as estimatedCostThisMonth
          FROM usage_logs
          WHERE guild_id = ?
            AND created_at >= datetime('now', 'start of month')
        `
      )
      .get(guildId) as UsageStats;

    return row;
  }

  getSessionRow(sid: string): { sid: string; sess: string; expire_at: number } | undefined {
    this.pruneExpiredSessions();
    return this.db.prepare(`SELECT sid, sess, expire_at FROM web_sessions WHERE sid = ?`).get(sid) as
      | { sid: string; sess: string; expire_at: number }
      | undefined;
  }

  setSessionRow(sid: string, sess: string, expireAt: number): void {
    this.db
      .prepare(
        `
          INSERT INTO web_sessions (sid, sess, expire_at)
          VALUES (?, ?, ?)
          ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire_at = excluded.expire_at
        `
      )
      .run(sid, sess, expireAt);
  }

  destroySessionRow(sid: string): void {
    this.db.prepare(`DELETE FROM web_sessions WHERE sid = ?`).run(sid);
  }

  pruneExpiredSessions(): void {
    const now = Date.now();
    this.db.prepare(`DELETE FROM web_sessions WHERE expire_at < ?`).run(now);
  }
}
